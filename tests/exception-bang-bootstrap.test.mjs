import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const doc=readFileSync(new URL('../contracts/bang-exception-keywords-v1/README.md',import.meta.url),'utf8');
const shared=JSON.parse(readFileSync(process.argv[2],'utf8'));
test('backend design remains a proposal and retains all canonical and migration forms',()=>{
  assert.match(doc,/draft, not an executed backend parity claim/);
  assert.match(doc,/not a merged normative spec/);
  assert.match(doc,/NOT_EXECUTED/);
  assert.equal(shared.status,'SOURCE_ONLY_TARGET_NOT_BACKEND_OR_GUEST_VERIFIED');
  assert.ok(shared.backends.includes('atto-source.atto'));
  for(const k of ['trap!','throw!','raise!','panic!']){
    assert.ok(shared.canonical_keywords.includes(k),k);
    assert.ok(doc.includes(k),k);
    assert.ok(shared.migration_keywords.includes(k.slice(0,-1)),k);
  }
});
