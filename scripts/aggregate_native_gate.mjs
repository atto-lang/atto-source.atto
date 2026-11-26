import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
const [compilerArg, expectedCompilerSha, sourceArg, expectedSourceBlob] = process.argv.slice(2);
assert.ok(compilerArg && /^[a-f0-9]{64}$/.test(expectedCompilerSha ?? '') &&
  sourceArg && /^[a-f0-9]{40}$/.test(expectedSourceBlob ?? ''),
  'usage: node scripts/aggregate_native_gate.mjs COMPILER COMPILER_SHA256 SOURCE SOURCE_GIT_BLOB');
const compiler = path.resolve(compilerArg);
const bytes = fs.readFileSync(path.resolve(sourceArg));
assert.equal(createHash('sha256').update(fs.readFileSync(compiler)).digest('hex'),expectedCompilerSha);
assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),expectedSourceBlob);
const seed=bytes.toString('utf8');
const work=fs.mkdtempSync(path.join(os.tmpdir(),'atto-aggregate-seed-'));
const original=process.cwd();
try {
process.chdir(work);
const cases=[
  [[1,1,1,0,0,0],0],[[1,1,2,0,0,0],-3],[[1,1,3,0,0,0],-3],
  [[1,1,4,0,0,0],-3],[[1,2,1,0,0,0],-2],
  [[2,2,4,0,0,0],0],[[2,2,2,0,0,0],0],
  [[3,1,1,1,1,0],0],[[3,2,1,1,1,0],0],[[3,2,2,2,1,0],0],
  [[3,2,4,4,0,0],-6],[[3,2,3,1,1,0],-3],[[3,1,1,2,1,0],-3],
  [[3,3,1,1,1,1],-2],[[4,1,1,0,0,1],0],[[4,1,1,0,0,0],-5],
  [[4,3,1,0,0,1],0],[[4,2,1,0,1,1],-2],[[4,3,2,0,0,1],-3],
  [[5,1,1,1,1,0],-2],[[5,2,2,2,1,0],0],[[5,2,4,4,0,0],-6],
  [[0,1,1,1,1,1],-1],[[6,1,1,1,1,1],-1],[[3,4,1,1,1,1],-2],
  [[3,2,0,1,1,1],-3],[[3,2,5,5,1,1],-3],[[3,2,1,0,1,0],-3],
  [[3,2,1,5,1,0],-3],[[3,2,1,1,2,0],-4],[[4,1,1,0,0,-1],-4],
  [[3,2,4,4,1,0],-7],[[5,2,4,4,1,0],-7],[[3,2,3,3,1,0],0],
  [[3,2,1,1,0,0],-6],[[4,1,1,0,1,0],-5],[[2,1,1,0,0,0],-2]
];
const digest=b=>createHash('sha256').update(b).digest('hex');
for (let i=0;i<cases.length;i+=5) {
  const chunk=cases.slice(i,i+5);
  const body=chunk.map(([a,expected],j)=>'    if admit_aggregate_item('+a.join(', ')+') neq '+expected+' then return '+(j+1)+'; fi').join('\n');
  const source=seed+'\npub fnc main(): int {\n'+body+'\n    return 0;\n}\n';
  const p='guest-'+i;
  fs.writeFileSync(p+'.atto',source,{flag:'wx'});
  const ir=spawnSync(compiler,[p+'.atto'],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
  assert.ifError(ir.error);
  assert.equal(ir.status,0,ir.stderr);
  assert.match(ir.stdout,/define /);
  fs.writeFileSync(p+'.ll',ir.stdout,{flag:'wx'});
  const link=spawnSync('clang',['-x','ir',p+'.ll','-o',p],{encoding:'utf8',timeout:120000});
  assert.ifError(link.error);assert.equal(link.status,0,link.stderr);
  const run=spawnSync('./'+p,[],{encoding:'utf8',timeout:30000});
  assert.ifError(run.error);assert.equal(run.status,0,'native case failure '+i+': '+run.status);
  console.log('ATTO_SEED_NATIVE_GUEST_PASS cases='+chunk.length+' input='+digest(source)+' binary='+digest(fs.readFileSync(p)));
}
// A malformed source must not publish LLVM IR.
fs.writeFileSync('invalid.atto',seed+'\n@invalid_atto_token\n',{flag:'wx'});
const rejected=spawnSync(compiler,['invalid.atto'],{encoding:'utf8',timeout:120000});
assert.ifError(rejected.error);assert.ok(Number.isInteger(rejected.status)&&rejected.status!==0&&!rejected.signal);
assert.equal(rejected.stdout.trim(),'');
console.log('ATTO_STAGE0_AGGREGATE_ITEM_KERNEL_PASS cases='+cases.length+' invalid_no_ir=true self_hosted=false');
} finally {
  process.chdir(original);
  fs.rmSync(work,{recursive:true,force:true});
}

