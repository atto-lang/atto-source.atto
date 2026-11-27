import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Only fixture provenance and coverage. The Atto-authored scalar seed has no
// general parser/typechecker. Never report this as Stage-1 or guest evidence.
test('canonical aggregate constructor v2 target remains byte-identical and unexecuted',async()=>{
  const bytes=await readFile(new URL('../contracts/aggregate-constructor-v2.json',import.meta.url));
  const blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  assert.equal(blob,'7545f81bbf63dc4ff57fb761109431426e2a6b86');
  const corpus=JSON.parse(bytes);
  assert.equal(corpus.status,'TARGET_NOT_EXECUTED');
  assert.equal(corpus.vectors.length,53);
  assert.equal(new Set(corpus.vectors.map(v=>v.id)).size,53);
  assert.equal(corpus.vectors.filter(v=>v.kind==='accept').length,23);
  assert.equal(corpus.vectors.filter(v=>v.kind==='reject').length,30);
  for(const id of ['pair-standalone-int','pair-nonstring-type','record-entry','map-mixed-duplicate','tuple-crossed','import-crossed'])
    assert.equal(corpus.vectors.find(v=>v.id===id)?.kind,'reject',id);
  for(const id of ['pair-canonical-type','pair-compatibility-type','map-mixed-pair-entry','entry-int'])
    assert.equal(corpus.vectors.find(v=>v.id===id)?.kind,'accept',id);
});
