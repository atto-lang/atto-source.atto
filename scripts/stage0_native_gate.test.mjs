// These are validation tests of the Stage-0 runner's failure behavior.
// They do NOT compile/execute Atto source and are NOT self-hosting proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const script = fileURLToPath(new URL('./stage0_native_gate.mjs', import.meta.url));
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const blobSha = b => crypto.createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex');

const runGate = args => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 5000 });
function notVerified(result) {
  assert.equal(result.status, 2);
  const evidence = JSON.parse(result.stderr);
  assert.equal(evidence.result, 'not-verified');
  assert.equal(evidence.native_guest_executed, false);
  assert.equal(evidence.self_hosted, false);
  assert.equal(result.stdout, '');
}

test('missing real compiler pin rejects, never reports a guest pass', () => {
  notVerified(runGate([]));
});

test('invalid pin syntax rejects before touching files', () => {
  notVerified(runGate([
    '--compiler=/does-not-exist',
    '--compiler-sha256=bad',
    '--source=/does-not-exist',
    '--source-blob=bad',
  ]));
});

test('wrong compiler SHA-256 rejects before executing the compiler', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'atto-stage0-gate-test-'));
  try {
    const fake = path.join(dir, 'not-a-compiler');
    const source = path.join(dir, 'seed.atto');
    const content = Buffer.from('some Atto source\n');
    writeFileSync(fake, '#!/bin/sh\nexit 0\n');
    writeFileSync(source, content);
    const r = runGate([
      '--compiler=' + fake,
      '--compiler-sha256=' + '0'.repeat(64),
      '--source=' + source,
      '--source-blob=' + blobSha(content),
    ]);
    notVerified(r);
    assert.match(r.stderr, /Compiler SHA-256 mismatch/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('wrong source Git blob SHA rejects even with pinned compiler bytes', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'atto-stage0-source-test-'));
  try {
    const fake = path.join(dir, 'not-a-compiler');
    const source = path.join(dir, 'seed.atto');
    const executableBytes = Buffer.from('#!/bin/sh\nexit 0\n');
    writeFileSync(fake, executableBytes);
    writeFileSync(source, Buffer.from('something\n'));
    const r = runGate([
      '--compiler=' + fake,
      '--compiler-sha256=' + sha256(executableBytes),
      '--source=' + source,
      '--source-blob=' + '0'.repeat(40),
    ]);
    notVerified(r);
    assert.match(r.stderr, /Atto seed Git blob SHA mismatch/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
