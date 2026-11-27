// Compile the exact core source bytes using an externally pinned real Stage-0
// compiler. This is one source compilation unit, NOT package linking or Stage-1.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const [bin,pin]=process.argv.slice(2);
assert.ok(bin&&/^[a-f0-9]{64}$/.test(pin||''),'compiler path and SHA-256 required');
const compiler=resolve(bin),digest=b=>createHash('sha256').update(b).digest('hex');
assert.equal(digest(readFileSync(compiler)),pin);
const pins={
 identity:'40aa48e5508c8fe24aa5ef7ebe2bde73aaad0b57',
 byte_bounds:'3c8544bb4e8d87fe63b1284a627913aea6d91527',
 size_math:'ae7bc1a9200e02635b0ab9d26438f10385564067',
 u32_endian:'92297c9df0169ab63197faf74f45af39ae5b7091'
};
const source=Object.entries(pins).map(([name,sha])=>{
 const bytes=readFileSync(new URL('../stdlib/core/'+name+'.atto',import.meta.url));
 assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),sha);
 return bytes.toString('utf8');
}).join('\n');
const M=(1n<<63n)-1n,edges=[-M,-1n,0n,1n,2n,255n,256n,65535n,4294967295n,M-1n,M];
const cases=[];
const add=(name,args,expect)=>cases.push([name+'('+args.join(', ')+')',String(expect)]);
for(const a of edges){
 add('identity',[a],a);
 add('byte_u8_valid',[a],a>=0n&&a<=255n);
 add('byte_u16_valid',[a],a>=0n&&a<=65535n);
 add('byte_u32_valid',[a],a>=0n&&a<=4294967295n);
 for(const [i,name] of ['u32_low8','u32_lane1','u32_lane2','u32_lane3'].entries())
  add(name,[a],(BigInt.asUintN(64,a)>>BigInt(8*i))&255n);
 for(const b of edges)for(const limit of [0n,255n,M]){
  const nonnegative=a>=0n&&b>=0n;
  add('size_add_fits',[a,b,limit],nonnegative&&a+b<=limit);
  add('size_mul_fits',[a,b,limit],nonnegative&&a*b<=limit);
  add('byte_range_valid',[limit,a,b],nonnegative&&a+b<=limit);
 }
 for(const b of edges){
  add('clamp_int',[a,-1n,b< -1n?-1n:b],a< -1n?-1n:a>(b< -1n?-1n:b)?(b< -1n?-1n:b):a);
  const lanes=[a,b,-a,-b].map(x=>x&255n);
  add('u32_pack_le',[a,b,-a,-b],lanes.reduce((v,x,i)=>v|(x<<BigInt(i*8)),0n));
  add('u32_pack_be',[a,b,-a,-b],lanes.reduce((v,x,i)=>v|(x<<BigInt((3-i)*8)),0n));
 }
}
const dir=mkdtempSync(join(tmpdir(),'atto-core-stage0-'));
try{
 for(let start=0;start<cases.length;start+=32){
  const batch=cases.slice(start,start+32);
  const input=join(dir,'seed.atto'),output=join(dir,'seed.wasm');
  const checks=batch.map(([expr,w],i)=>'if '+expr+' neq '+w+' then return '+(i+1)+'; fi').join('\n');
  writeFileSync(input,source+'\npub fnc main():int {\n'+checks+'\nreturn 0;\n}\n');
  const r=spawnSync(compiler,[input,'-o',output],{encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  assert.ifError(r.error);assert.equal(r.signal,null);assert.equal(r.status,0,r.stderr);
  const mod=new WebAssembly.Module(readFileSync(output));
  assert.deepEqual(WebAssembly.Module.imports(mod),[]);
  const instance=new WebAssembly.Instance(mod,{});
  const value=instance.exports.main();
  assert.equal(value,0n,'batch '+start+' case '+String(value));
  assert.equal(instance.exports.panic_code.value,0);
  rmSync(output);
 }
 assert.equal(digest(readFileSync(compiler)),pin);
 console.log('ATTO_CORE_STAGE0_GUEST_PASS cases='+cases.length);
}finally{rmSync(dir,{recursive:true,force:true});}
