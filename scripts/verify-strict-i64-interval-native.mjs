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
// Include exact product thresholds and malformed interval endpoints.
ranges.push([-3037000500n,-3037000499n],[3037000499n,3037000500n],[MIN/2n,MIN/2n],[MAX/2n,MAX/2n],[-2n,2n],[MAX,MIN]);
for(const a of ranges)for(const b of ranges){
 const validBoth=valid(a)&&valid(b);
 const args=[...a,...b].map(literal).join(', ');
 const add=validBoth?Number(a[0]+b[0]>=MIN&&a[1]+b[1]<=MAX):-1;
 const div=validBoth?Number(!(b[0]<=0n&&b[1]>=0n)&&!(a[0]===MIN&&b[0]<=-1n&&b[1]>=-1n)):-1;
 const sub=validBoth?Number(a[0]-b[1]>=MIN&&a[1]-b[0]<=MAX):-1;
 const corners=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];
 const mul=validBoth?Number(corners.every(v=>v>=MIN&&v<=MAX)):-1;
 calls.push(['prove_i64_add('+args+')',add],['prove_i64_div('+args+')',div],['prove_i64_sub('+args+')',sub],['prove_i64_mul('+args+')',mul]);
}
for(const a of ranges)for(const n of [0n,1n,2n,16n,17n,MAX]){
 const result=!valid(a)||n<1n||n>16n?-1:Number(a[0]>=0n&&a[1]<n);
 calls.push(['prove_fixed_index('+[...a,n].map(literal).join(', ')+')',result]);
}
// Bounded slice half-open range oracle, using arbitrary-precision addition
// independently of the kernel's subtract-after-bounds-check formulation.
const sliceValues=[MIN,-1n,0n,1n,15n,16n,17n,MAX];
const sliceExtents=[-1n,0n,1n,2n,16n,17n,MAX];
const beforeSlices=calls.length;
for(const extent of sliceExtents)for(const start of sliceValues)for(const count of sliceValues){
 const want=extent<0n||extent>16n?-1:Number(start>=0n&&count>=0n&&start+count<=extent);
 calls.push(['prove_fixed_slice('+[start,count,extent].map(literal).join(', ')+')',want]);
}
assert.equal(calls.length-beforeSlices,448);
// Shared debit rows are point-interval obligations, NOT original guest lowering.
// Prove each stage before evaluating the next, so cancellation and discarded
// results never erase a failing intermediate. The Atto kernel returns only
// admission decisions; the independent BigInt oracle computes expected facts.
const debitBytes=readFileSync(new URL('../contracts/atto-xo-checked-debit-v1/cases.tsv',import.meta.url));
assert.equal(hash(debitBytes),'e6e3394d5d62ec1f8171053b74a3b68389c41d5c797d81c14f561d1ca097a28b');
const debitRows=debitBytes.toString('utf8').trimEnd().split('\n').map(line=>line.split('|'));
assert.deepEqual(debitRows.map(r=>[r[0],r[1]]),[
 ['normal','42'],['control','43'],['max-valid','42'],
 ['fee-overflow','overflow'],['notional-overflow','overflow'],
 ['overflow-cancel','overflow'],['overflow-dead-result','overflow']
]);
const fits=v=>v>=MIN&&v<=MAX;
const beforeDebit=calls.length;
for(const row of debitRows){
 assert.equal(row.length,8);
 const [id,want,p,s,f,op,r]=row;
 const price=BigInt(p),shares=BigInt(s),fee=BigInt(f),rhs=BigInt(r);
 assert.ok([price,shares,fee,rhs].every(fits),id);
 assert.ok(['+','-','*'].includes(op),id);
 const stages=[['mul',shares],['add',fee],[{'+':'add','-':'sub','*':'mul'}[op],rhs]];
 let value=price,failed=false;
 for(const [kind,right] of stages){
  const next=kind==='mul'?value*right:kind==='add'?value+right:value-right;
  const safe=fits(next);
  const args=[value,value,right,right].map(literal).join(', ');
  calls.push(['prove_i64_'+kind+'('+args+')',Number(safe)]);
  if(!safe){failed=true;break;}
  value=next;
 }
 assert.equal(failed?'overflow':value.toString(),want,id);
}
assert.equal(calls.length-beforeDebit,15);
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
 assert.equal(passed,1867);console.log('ATTO_PROOF_RESULT',JSON.stringify({passed,total:calls.length,stage:0,selfHosted:false,sharedDebitPointObligations:15,fixedSliceObligations:448,sourceBlob,compilerPin}));
}finally{rmSync(work,{recursive:true,force:true});}
