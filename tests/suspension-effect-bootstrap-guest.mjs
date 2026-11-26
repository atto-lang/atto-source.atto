import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const compiler=resolve(process.argv[2]??'');
assert.ok(process.argv[2], 'real Stage-0 compiler path required');
const seed=readFileSync(new URL('../src/suspension_effect_token.atto',import.meta.url),'utf8');
const pack=s=>{const bytes=Buffer.from(s,'utf8');return [bytes.length,bytes.reduce((v,b)=>(v<<8n)|BigInt(b),0n)];};
const cases=[];
for(const spelling of ['suspends','susp','⧖','∂']){
 const [len,bits]=pack(spelling);
 cases.push([len,bits,1],[len-1,bits,0],[len+1,bits,0],[len,bits^1n,0]);
}
for(const spelling of ['suspend','susp2','▽','⧗','SUSP','x','']){
 const [len,bits]=pack(spelling);cases.push([len,bits,0]);
}
cases.push([-1,0n,0],[9,0n,0],[3,-1n,0],[8,9223372036854775807n,0]);
const dir=mkdtempSync(join(tmpdir(),'atto-effect-seed-'));
try{
 const input=join(dir,'seed.atto'),output=join(dir,'seed.wasm');
 const checks=cases.map(([n,b,w])=>'    if suspension_effect_token('+n+', '+b+') neq '+w+' then return 1; fi').join('\n');
 writeFileSync(input,seed+'\npub fnc main(): int {\n'+checks+'\n    return 42;\n}\n');
 const c=spawnSync(compiler,[input,'-o',output],{encoding:'utf8',timeout:120000});
 assert.equal(c.status,0,c.stderr||String(c.error));
 const bytes=readFileSync(output);
 assert.equal(WebAssembly.validate(bytes),true);
 const module=new WebAssembly.Module(bytes);
 assert.deepEqual(WebAssembly.Module.imports(module),[]);
 assert.equal(new WebAssembly.Instance(module,{}).exports.main(),42n);
 console.log('ATTO_SUSPENSION_TOKEN_SEED_GUEST_PASS cases='+cases.length);
}finally{rmSync(dir,{recursive:true,force:true});}
