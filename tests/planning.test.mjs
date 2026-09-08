import test from 'node:test';
import assert from 'node:assert/strict';
import {groundPlan,sourceUrlKey} from '../runner/planning.mjs';
import {trustedSource} from '../runner/providers.mjs';
const url='https://spaceplace.nasa.gov/blue-sky/en/';
const candidate={value:{genre:'科学',hook:'question',structure:'story',sources:[{id:'bad',url}],segments:[],risk:'none'},sources:[]};
const evidence=url=>({url,title:'NASA science',sha256:'fixture-hash',text:'Retrieved primary source. '.repeat(50),fetchedAt:new Date().toISOString()});
test('source URL normalization ignores tracking but preserves document identifiers',()=>{
 assert.equal(sourceUrlKey(url+'?utm_source=chatgpt.com#summary'),sourceUrlKey(url));
 assert.notEqual(sourceUrlKey(url+'?article=1'),sourceUrlKey(url+'?article=2'));
 assert(trustedSource('https://nasa.gov/'));assert(!trustedSource('https://nasa.gov.evil.example/'));assert(!trustedSource('http://www.nasa.gov/'));
});
test('unlinked citations require retrieved primary evidence and one new plan, never a forged fact pass',async()=>{
 let calls=0,prompt='';const ai={response:async input=>{calls++;prompt=input;return {value:{genre:'科学',hook:'question',structure:'story',risk:'none',segments:[{text:'なぜ青い？',role:'hook',sourceIds:['s1']}]}};}};
 const result=await groundPlan(ai,candidate,{fetchSource:async u=>evidence(u)});
 assert.equal(calls,1);assert(prompt.includes('Retrieved primary source.'));assert.equal(result.value.sources[0].id,'s1');assert.equal(result.value.sources[0].url,url);assert.equal(result.sourceEvidence[0].discovery,'retrieved-primary-evidence');assert.equal(result.value.qa,undefined);
});
test('unavailable or non-primary URLs never lead to a paid repair or invented evidence',async()=>{
 let reads=0,calls=0;const ai={response:async()=>{calls++;}};
 await assert.rejects(groundPlan(ai,{value:{sources:[{url:'https://www.youtube.com/shorts/test'}]},sources:[]},{fetchSource:async()=>{reads++;}}));assert.equal(reads,0);assert.equal(calls,0);
 await assert.rejects(groundPlan(ai,{...candidate,sources:Array.from({length:10},(_,i)=>'https://www.nasa.gov/source-'+i)},{minSources:2,fetchSource:async()=>{reads++;throw Error('unavailable');}}));assert.equal(reads,4);assert.equal(calls,0);
});
test('two links redirecting to one document cannot satisfy the two-source requirement',async()=>{
 const ai={response:async()=>{throw Error('must not generate');}};
 await assert.rejects(groundPlan(ai,{...candidate,sources:['https://www.nasa.gov/alias']},{minSources:2,fetchSource:async()=>evidence(url)}),/一次資料が足りない/);
});
