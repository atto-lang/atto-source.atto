// Non-authorizing design guard only. No runtime codec, decoder, or capability grant.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ledger=JSON.parse(readFileSync(new URL('../contracts/actor-data-codec-bootstrap-v1.json',import.meta.url),'utf8'));
const contract=JSON.parse(readFileSync(process.argv[2],'utf8'));
const spec=readFileSync(process.argv[3],'utf8');
test('all 22 cases and 11 target cells remain explicitly unverified',()=>{
  assert.equal(ledger.status,'DESIGN_ONLY_NOT_EXECUTED');
  assert.equal(contract.status,'DESIGN_ONLY_NOT_EXECUTED');
  assert.equal(contract.cases.length,22);
  assert.equal(new Set(contract.cases.map(c=>c.id)).size,22);
  assert.equal(contract.targets.length,11);
  assert.equal(new Set(contract.targets.map(c=>c.target)).size,11);
  assert.ok(contract.targets.some(t=>t.target==='atto'));
  assert.ok(contract.cases.every(c=>c.status==='NOT_EXECUTED'));
  assert.ok(contract.targets.every(c=>c.status==='NOT_EXECUTED'));
  for(const id of ['selection-downgrade','selection-denied','capability','control','auth','generation','rollback','unsupported']){
    const c=contract.cases.find(x=>x.id===id);
    assert.ok(c && ['reject','no_publication_no_leak'].includes(c.expected),id);
  }
});
test('proposal and matrix retain security and runtime evidence requirements',()=>{
  assert.deepEqual(Object.keys(contract.profiles).sort(),['cbor','flatbuffers','messagepack','protobuf']);
  assert.match(spec,/No silent wire-version changes/);
  assert.match(spec,/no auto-sniff, downgrade, fallback or implicit transcode/);
  assert.match(spec,/CONTROL \(panic, restart, stop, lifecycle\) stays runtime-issued and separate/);
  assert.match(spec,/release exactly once/);
  assert.ok(contract.evidence.required.includes('independent security review'));
  assert.ok(contract.evidence.required.includes('executed positive and negative .atto guest'));
  assert.equal(contract.evidence.host_only,'NOT_EXECUTED');
});
test('bootstrap ledger grants no runtime admission or security certificate',()=>{
  for(const k of ['runtime_enabled','compiler_guest_verified','security_review_complete']) assert.equal(ledger[k],false);
  assert.deepEqual(ledger.allowed_runtime_profiles,[]);
  assert.equal(ledger.default_proposed,'messagepack');
  assert.equal(ledger.spec_commit,'3eeb2ac1c42f9461eb7ab721b69762e8f530dc57');
  assert.equal(ledger.conformance_commit,'e13228ea6be5a262a4bdc337df3ac87b819e2b33');
});
