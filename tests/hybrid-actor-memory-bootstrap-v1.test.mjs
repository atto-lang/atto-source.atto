import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const manifest=JSON.parse(readFileSync(
  new URL('../contracts/hybrid-actor-memory-bootstrap-v1.json',import.meta.url),'utf8'));
const seed=readFileSync(new URL('../src/scalar_codegen.atto',import.meta.url));
function shaGitBlob(bytes){
  return createHash('sha1')
    .update('blob '+bytes.byteLength+String.fromCharCode(0))
    .update(bytes).digest('hex');
}
test('self-hosted bootstrap keeps historical compiled scalar evidence exact',()=>{
  assert.equal(manifest.schema_version,1);
  assert.equal(manifest.contract,'atto.hybrid-actor-memory.selfhost-bootstrap.v1');
  assert.equal(manifest.repo,'atto-lang/atto-source.atto');
  assert.equal(manifest.status,'STAGE0_SCALAR_GUEST_ONLY');
  assert.equal(manifest.self_hosted,false);
  assert.equal(shaGitBlob(seed),manifest.stage0.git_blob_sha);
  assert.equal(manifest.stage0.git_blob_sha,'b6f5fe8cddc6728a7c89cd4f6d48682aacafa991');
  assert.equal(manifest.stage0.executed_native_scalar_tests,324);
});
test('linked-object .atto guest is not falsely certified by scalar Stage-0',()=>{
  const c=manifest.canonical_guest_fixture;
  assert.equal(c.repo,'atto-lang/atto-platform-conformance');
  assert.equal(c.positive_git_blob,'d472cccb3da24ee8f9fed44f99c1c7742d3240de');
  assert.equal(c.negative_git_blob,'7544665f302167451fdc47ce11f5f108f703b7ed');
  assert.equal(c.positive,'NOT_EXECUTED');
  assert.equal(c.negative,'NOT_EXECUTED');
  assert.equal(c.guest_receipt,null);
  for(const [feature,status] of Object.entries(manifest.memory_capabilities)){
    assert.match(feature,/^[a-z0-9_]+$/);
    assert.equal(status,'UNSUPPORTED',feature);
  }
  assert.equal(manifest.requirements.length,4);
});

test('bootstrap actor memory inventory cannot silently omit unsupported features',()=>{
  const required=[
    'actor_private_ref32_heap','actor_generation_and_incarnation',
    'native_guest_nominal_node_graph','actor_memory_quota_and_peak_growth',
    'cross_actor_take_and_share','self_hosted_compiler_stage1',
    'self_hosted_compiler_stage2','self_hosted_compiler_stage3',
    'hard_realtime_prefault','wide_handle64','capability128'
  ];
  assert.deepEqual(Object.keys(manifest.memory_capabilities).sort(),required.sort());
  for(const name of required)
    assert.equal(manifest.memory_capabilities[name],'UNSUPPORTED',name);
  assert.equal(manifest.stage0.evidence_scope,'PINNED_LLVM_COMPILER_SCALAR_ATTO_GUEST_NOT_SELF_HOSTED');
  assert.equal(manifest.canonical_guest_fixture.pr,461);
  assert.equal(manifest.canonical_guest_fixture.guest_receipt,null);
});
