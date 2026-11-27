#!/usr/bin/env node
// Real native Stage-0 guest execution. NO mock compilers, token fetches or skip-as-pass.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const digest = (b, algo = 'sha256') => crypto.createHash(algo).update(b).digest('hex');
const gitBlob = b => crypto.createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex');
const fail = message => { throw new Error(message); };
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const m = /^--([a-z0-9-]+)=(.*)$/.exec(arg);
  if (!m) fail('Bad CLI argument ' + arg);
  return [m[1], m[2]];
}));
function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  if (r.error) fail(cmd + ': ' + r.error.message);
  return r;
}
function check(r, purpose, expected = 0) {
  if (r.status !== expected || r.signal) {
    fail(purpose + ' exit=' + r.status + ', signal=' + r.signal + ': ' + (r.stderr || '').slice(0, 2000));
  }
}
function sourceWithoutMain(text) {
  const m = /\n(?:define )?pub fnc main\(\): int \{[\s\S]*?\n\}\s*$/.exec(text);
  if (!m || !text.includes('pub fnc compile_ascii_triplet(')) fail('Seed source shape changed; review harness');
  return text.slice(0, m.index).trimEnd() + '\n';
}
function expected(left, op, right) {
  const a = left - 48, b = right - 48;
  const value = op === 42 ? a * b : op === 43 ? a + b : a - b;
  if (value < -64) return -5;
  if (value > 63) return -6;
  return 66 + (value < 0 ? 128 + value : value) * 256 + 11 * 65536;
}
function matrix() {
  const checks = [];
  for (const op of [42, 43, 45])
    for (let a = 48; a <= 57; a++)
      for (let b = 48; b <= 57; b++)
        checks.push(['compile_ascii_triplet(' + a + ', ' + op + ', ' + b + ')', expected(a, op, b)]);
  checks.push(
    ['compile_ascii_triplet(47, 43, 49)', -1],
    ['compile_ascii_triplet(49, 43, 58)', -2],
    ['compile_ascii_triplet(49, 47, 49)', -3],
    ['compile_ascii_triplet(0, 47, 0)', -1],
    ['compile_ascii_triplet(49, 47, 0)', -2],
    ['evaluate_digit_binary(-1, 1, 9)', -1000],
    ['evaluate_digit_binary(10, 1, 9)', -1000],
    ['evaluate_digit_binary(9, 1, 10)', -1000],
    ['evaluate_digit_binary(9, 1, -1)', -1000],
    ['evaluate_digit_binary(9, 99, 9)', -1000],
    ['signed_leb128_byte(-65)', -1001],
    ['signed_leb128_byte(64)', -1001],
    ['ascii_digit_value(-1)', -1],
    ['ascii_digit_value(58)', -1],
    // Public helpers must not overflow when given extreme host i64 values.
    ['evaluate_digit_binary(9223372036854775807, 1, 9)', -1000],
    ['evaluate_digit_binary(-9223372036854775807, 1, 9)', -1000],
    ['evaluate_digit_binary(9, 1, 9223372036854775807)', -1000],
    ['evaluate_digit_binary(9, 1, -9223372036854775807)', -1000],
    ['ascii_digit_value(9223372036854775807)', -1],
    ['ascii_digit_value(-9223372036854775807)', -1],
    ['signed_leb128_byte(9223372036854775807)', -1001],
    ['signed_leb128_byte(-9223372036854775807)', -1001],
    ['compile_ascii_triplet(9223372036854775807, 43, 49)', -1],
    ['compile_ascii_triplet(49, 43, -9223372036854775807)', -2]
  );
  // Normalized compiler fact decisions, never a public guest tag ABI.
  // Independent truth-table oracle for both sum families.
  for (const family of [1, 2]) {
    for (const [success, discard, closed, decision] of [
      [0,0,0,0], [0,0,1,0], [0,1,0,0], [0,1,1,2],
      [1,0,0,0], [1,0,1,1], [1,1,0,0], [1,1,1,1]
    ]) checks.push(['checked_unwrap_fold_decision('+
      [family,success,discard,closed].join(', ')+')',decision]);
  }
  for (const bad of ['-9223372036854775808','-1','3','9223372036854775807']) {
    for (let field=0;field<4;field++) {
      const args=['1','1','1','1'];args[field]=bad;
      checks.push(['checked_unwrap_fold_decision('+args.join(', ')+')',0]);
    }
  }
  // Exact ABI matrix: 5 nominal unit IDs and every ASCII digit pair.
  if(options['quantity-seed']==='1'){
  const dimensions=[0,1,1,2,1,1],scales=[0,1,1000,1,1,1000];
  for(let a=0;a<=9;a++)for(let b=0;b<=9;b++)for(let u=1;u<=5;u++)for(let v=1;v<=5;v++){
    const result=dimensions[u]!==dimensions[v]?-8:scales[u]!==scales[v]?-9:b===0?-10:
      66+Math.floor(a/b)*256+11*65536;
    checks.push([`compile_quantity_digit_ratio(${a+48}, ${u}, ${b+48}, ${v})`,result]);
  }
  checks.push(
    ['compile_quantity_digit_ratio(47, 1, 49, 1)',-1],
    ['compile_quantity_digit_ratio(49, 1, 58, 1)',-2],
    ['compile_quantity_digit_ratio(49, 0, 48, 1)',-7],
    ['compile_quantity_digit_ratio(49, 1, 48, 9223372036854775807)',-7],
    ['compile_quantity_digit_ratio(49, -9223372036854775807, 49, 1)',-7],
    ['quantity_seed_digit_ratio(9223372036854775807, 1)',-4],
    ['quantity_seed_digit_ratio(1, -9223372036854775807)',-4],
    ['quantity_seed_digit_ratio(1, 0)',-4]
  );
  }
  if(options['contract-seed']==='1'){
    const bodies=['20212223142425','26212223142427','2826212223142427','2829212223142427'];
    const layouts=[
      ['11121314151719','11121314161819','0','0'],
      ['0','0','12141517','12141618'],
      ['11121314151719','0','0','12141618'],
      ['11121314161819','0','12141517','0']
    ];
    for(const b of bodies)for(const p of layouts){
      for(let arg=49;arg<=57;arg++)checks.push([`compile_contract_digit_helper(${p.join(', ')}, ${b}, ${arg})`,66+Math.floor(6/(arg-48))*256+11*65536]);
      for(const arg of [48,47,58,9223372036854775807n])checks.push([`compile_contract_digit_helper(${p.join(', ')}, ${b}, ${arg})`,-14]);
    }
    for(const b of ['29212223142427','26212223142425','262122231424','282626212223142427','0','9223372036854775807'])
      checks.push([`compile_contract_digit_helper(11121314151719, 0, 0, 12141618, ${b}, 50)`,-12]);
    checks.push(
      ['compile_contract_digit_helper(111213141517, 0, 0, 12141618, 20212223142425, 50)',-11],
      ['compile_contract_digit_helper(11121314151719, 0, 12141517, 0, 20212223142425, 50)',-13],
      ['compile_contract_digit_helper(11121314151719, 0, 0, 0, 20212223142425, 50)',-13],
      ['compile_contract_digit_helper(0, 0, 0, 0, 20212223142425, 50)',-13],
      ['compile_contract_digit_helper(11121314151719, 0, 12141517, 12141618, 20212223142425, 50)',-13]);
  }
  return checks;
}
function runNativeGate() {
  for (const key of ['compiler', 'compiler-sha256', 'source', 'source-blob']) {
    if (!options[key]) fail('Missing --' + key + '; real compiler and source pins required');
  }
  if (!/^[a-f0-9]{64}$/.test(options['compiler-sha256']) ||
      !/^[a-f0-9]{40}$/.test(options['source-blob'])) fail('Invalid compiler or source pin');
  const compiler = path.resolve(options.compiler);
  const compilerBytes = fs.readFileSync(compiler);
  const sourceBytes = fs.readFileSync(path.resolve(options.source));
  if (digest(compilerBytes) !== options['compiler-sha256']) fail('Compiler SHA-256 mismatch');
  if (gitBlob(sourceBytes) !== options['source-blob']) fail('Atto seed Git blob SHA mismatch');
  const source = sourceBytes.toString('utf8');
  const base = sourceWithoutMain(source);
  const cases = matrix();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'atto-stage0-'));
  const clang = options.clang || 'clang';
  const receipt = {
    schema: 'atto-stage0-native-guest-v1',
    result: 'not-verified', self_hosted: false,
    source_sha256: digest(sourceBytes), source_blob: gitBlob(sourceBytes),
    compiler_sha256: digest(compilerBytes),
    compiler_source_commit: options['compiler-source-commit'] || 'UNKNOWN',
    cases: cases.length, fixtures: []
  };
  try {
    const cv = run(clang, ['--version'], work);
    check(cv, 'clang version');
    receipt.clang_version = (cv.stdout || '').split('\n')[0];
    const compileRun = (name, text, code) => {
      const input = path.join(work, name + '.atto');
      const ll = path.join(work, name + '.ll');
      const exe = path.join(work, name);
      fs.writeFileSync(input, text, { flag: 'wx' });
      const c = run(compiler, [input], work);
      check(c, 'real Atto compile ' + name);
      if (!(c.stdout || '').includes('define ')) fail('Compiler did not emit LLVM IR for ' + name);
      fs.writeFileSync(ll, c.stdout, { flag: 'wx' });
      const link = run(clang, ['-x', 'ir', ll, '-o', exe], work);
      check(link, 'native link ' + name);
      const guest = run(exe, [], work);
      check(guest, 'executed native Atto guest ' + name, code);
      receipt.fixtures.push({
        name, input_sha256: digest(Buffer.from(text)),
        ir_sha256: digest(Buffer.from(c.stdout)),
        binary_sha256: digest(fs.readFileSync(exe)),
        exit_code: guest.status
      });
      console.error('STAGE0_NATIVE_GUEST_PASS ' + name + ' exit=' + guest.status + ' binary_sha256=' + digest(fs.readFileSync(exe)));
    };
    compileRun('unaltered', source, 42);
    for (let i = 0; i < cases.length; i += 45) {
      const chunk = cases.slice(i, i + 45);
      const assertions = chunk.map(([expr, value]) =>
        '    if ' + expr + ' neq ' + value + ' then\n        return 1;\n    fi');
      const guestSource = base + '\npub fnc main(): int {\n' +
        assertions.join('\n') + '\n    return 0;\n}\n';
      compileRun('matrix_' + i, guestSource, 0);
    }
    const invalid = path.join(work, 'invalid.atto');
    fs.writeFileSync(invalid, source + '\n@invalid_atto_token\n', { flag: 'wx' });
    const rejected = run(compiler, [invalid], work);
    if (rejected.status === 0 || rejected.signal || (rejected.stdout || '').trim()) {
      fail('Invalid Atto source not rejected cleanly with no LLVM artifact');
    }
    receipt.invalid_source_rejected = true;
    receipt.result = 'passed';
    receipt.native_guest_executed = true;
    console.log(JSON.stringify(receipt, null, 2));
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
try {
  runNativeGate();
} catch (error) {
  console.error(JSON.stringify({
    schema: 'atto-stage0-native-guest-v1',
    result: 'not-verified', native_guest_executed: false,
    self_hosted: false, failure: String(error.message)
  }, null, 2));
  process.exitCode = 2;
}
