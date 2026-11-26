// Independent BigInt oracle, actual native execution of the Atto-authored kernel.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const [compilerArg,compilerPin,sourceArg,sourceBlob,clang='clang']=process.argv.slice(2);
assert.match(compilerPin??'',/^[a-f0-9]{64}$/);
assert.match(sourceBlob??'',/^[a-f0-9]{40}$/);
const compiler=resolve(compilerArg),raw=readFileSync(resolve(sourceArg));
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash(readFileSync(compiler)),compilerPin);
assert.equal(createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex'),sourceBlob);
const source=raw.toString('utf8'),MIN=-(1n<<63n),MAX=(1n<<63n)-1n;
const ranges=[[MIN,MIN],[MIN,MIN+1n],[MIN,MAX],[-2n,-1n],[-1n,-1n],[-1n,1n],[0n,0n],[1n,1n],[1n,42n],[MAX-1n,MAX],[MAX,MAX],[2n,1n]];
const valid=([a,b])=>a<=b;
const literal=v=>v===MIN?'(-9223372036854775807 - 1)':String(v);
const calls=[];
for(const a of ranges)for(const b of ranges){
 const validBoth=valid(a)&&valid(b);
 const args=[...a,...b].map(literal).join(', ');
 const add=validBoth?Number(a[0]+b[0]>=MIN&&a[1]+b[1]<=MAX):-1;
 const div=validBoth?Number(!(b[0]<=0n&&b[1]>=0n)&&!(a[0]===MIN&&b[0]<=-1n&&b[1]>=-1n)):-1;
 calls.push(['prove_i64_add('+args+')',add],['prove_i64_div('+args+')',div]);
}
for(const a of ranges)for(const n of [0n,1n,2n,16n,17n,MAX]){
 const result=!valid(a)||n<1n||n>16n?-1:Number(a[0]>=0n&&a[1]<n);
 calls.push(['prove_fixed_index('+[...a,n].map(literal).join(', ')+')',result]);
}
const work=mkdtempSync(join(tmpdir(),'atto-strict-kernel-'));
function run(cmd,args){const r=spawnSync(cmd,args,{cwd:work,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});if(r.error)throw r.error;assert.equal(r.signal,null);return r;}
function ok(r,id){assert.equal(r.status,0,id+': '+r.stderr);}
let passed=0;
try{
 for(let i=0;i<calls.length;i+=36){
  const chunk=calls.slice(i,i+36);
  const body=chunk.map(([call,want])=>'    if '+call+' neq '+want+' then\n        return 1;\n    fi').join('\n');
  const input=join(work,'proof'+i+'.atto'),ir=input+'.ll',exe=input+'.bin';
  writeFileSync(input,source+'\npub fnc main(): int {\n'+body+'\n    return 0;\n}\n',{flag:'wx'});
  const c=run(compiler,[input]);ok(c,'Atto kernel compile');assert.match(c.stdout,/define .*@main\(/);
  writeFileSync(ir,c.stdout,{flag:'wx'});ok(run(clang,['-x','ir',ir,'-o',exe]),'native link');
  ok(run(exe,[]),'actual proof kernel guest');
  passed+=chunk.length;console.log('ATTO_PROOF_GUEST',i,chunk.length,hash(readFileSync(input)),hash(readFileSync(exe)));
 }
 assert.equal(passed,360);console.log('ATTO_PROOF_RESULT',JSON.stringify({passed,total:calls.length,stage:0,selfHosted:false,sourceBlob,compilerPin}));
}finally{rmSync(work,{recursive:true,force:true});}
