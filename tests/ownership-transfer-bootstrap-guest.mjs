import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
assert.ok(process.argv[2], 'real Stage-0 compiler path required');
const compiler=resolve(process.argv[2]);
const seed=readFileSync(new URL('../src/ownership_transfer_token.atto',import.meta.url),'utf8');
const pack=s=>{const b=Buffer.from(s,'utf8');return [b.length,b.reduce((v,x)=>(v<<8n)|BigInt(x),0n)];};
const cases=[];
for(const spelling of ['take!','move!']){
  const [n,b]=pack(spelling);
  for(let next=-1;next<=255;next++)cases.push([n,b,next,next===32||(next>=9&&next<=13)?1:-1]);
  for(const next of [-2,256,9223372036854775807n])cases.push([n,b,next,-1]);
  cases.push([n-1,b,32,0],[n+1,b,32,0],[n,b^1n,32,0]);
}
for(const spelling of ['take','move','take?','MOVE!','take!!','move !','copy!','take!=','move!eq']){
 const [n,b]=pack(spelling);cases.push([n,b,32,0]);
}
const dir=mkdtempSync(join(tmpdir(),'atto-transfer-seed-'));
try{
 // Small independent compilation units avoid depending on an unbounded parser.
 for(let start=0;start<cases.length;start+=32){
  const batch=cases.slice(start,start+32);
  const input=join(dir,'seed.atto'),output=join(dir,'seed.wasm');
  const checks=batch.map(([n,b,x,w],i)=>'    if ownership_transfer_token('+n+', '+b+', '+x+') neq '+w+' then return '+(i+1)+'; fi').join('\n');
  writeFileSync(input,seed+'\npub fnc main(): int {\n'+checks+'\n    return 42;\n}\n');
  const c=spawnSync(compiler,[input,'-o',output],{encoding:'utf8',timeout:120000});
  assert.equal(c.status,0,c.stderr||String(c.error));
  const bytes=readFileSync(output);
  assert.equal(WebAssembly.validate(bytes),true);
  const module=new WebAssembly.Module(bytes);
  assert.deepEqual(WebAssembly.Module.imports(module),[]);
  assert.equal(new WebAssembly.Instance(module,{}).exports.main(),42n,'batch '+start);
  rmSync(output);
 }
 console.log('ATTO_TRANSFER_TOKEN_SEED_GUEST_PASS cases='+cases.length);
}finally{rmSync(dir,{recursive:true,force:true});}
