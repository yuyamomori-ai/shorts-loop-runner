import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../runner/engine.mjs';
import {OpenAI} from '../runner/providers.mjs';
import {MAX_OUTPUT_TOKENS} from '../runner/budget.mjs';
test('originality review sees source evidence and only genuine public history',async()=>{
 let prompt;
 const context={store:{read:()=>({live:{videos:[{id:'failed',title:'UNPUBLISHED_TRIAL',status:'blocked'},{id:'private',youtubeId:'private-id',title:'PRIVATE_TRIAL',actualPrivacy:'private'},{id:'public',youtubeId:'public-id',title:'PUBLIC_WORK',actualPrivacy:'public'}]}})},ai:{response:async p=>{prompt=p;return {value:{originality:50,commentary:50,editing:70,educational:75,entertainment:50,copyrightRisk:10,reusedRisk:55,confidence:.7}};}}};
 const q=await Engine.prototype.reviewOriginality.call(context,{id:'new',contentType:'A',title:'新しい作品',segments:[],sources:[{id:'s1',url:'https://example.com/study',title:'SOURCE_TITLE'}],factCheck:{allSupported:true},sourceEvidence:[{id:'s1',sha256:'actual-hash',fetchedAt:'2026-09-16'}]},{manifest:{musicEvidence:{selectionStatus:'pending_native_selection'}},frameFiles:[]},null);
 assert(prompt.includes('PUBLIC_WORK'));assert(!prompt.includes('UNPUBLISHED_TRIAL'));assert(!prompt.includes('PRIVATE_TRIAL'));assert(prompt.includes('SOURCE_TITLE'));assert(prompt.includes('actual-hash'));assert.equal(q.reusedRisk,55);assert.equal(q.confidence,.7);
});

test('correct educational criteria cannot override a negative copyright or originality score',async()=>{
 let prompt;
 const context={store:{read:()=>({live:{videos:[]}})},ai:{response:async p=>{prompt=p;return {value:{originality:60,commentary:75,editing:85,educational:80,entertainment:70,copyrightRisk:25,reusedRisk:20,confidence:.89}};}}};
 const q=await Engine.prototype.reviewOriginality.call(context,{id:'new',segments:[],sources:[]},{manifest:{musicEvidence:{mode:'licensed'}},frameFiles:[]},null);
 assert(prompt.includes('既知の研究を説明したこと自体を減点理由にしない'));
 assert(prompt.includes('具体的な疑義や不足が残れば停止する'));
 assert.equal(q.originality,60);assert.equal(q.copyrightRisk,25);
});

test('actual originality API request uses one strict structured response within the existing budget',async t=>{
 let calls=0,reserved=0,settled=0;
 const verdict={originality:60,commentary:75,editing:85,educational:80,entertainment:70,copyrightRisk:25,reusedRisk:20,confidence:.89,reason:'Specific unresolved evidence',fix:'Resolve the identified evidence'};
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body),format=body.text.format;
  assert.equal(format.type,'json_schema');assert.equal(format.strict,true);assert.equal(format.schema.additionalProperties,false);
  assert.deepEqual(format.schema.required,Object.keys(verdict));assert.equal(format.schema.properties.copyrightRisk.maximum,100);
  assert.equal(body.max_output_tokens,MAX_OUTPUT_TOKENS);assert.equal(body.tools,undefined);
  return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(verdict)}]}]}),{status:200});
 });
 const ai=Object.assign(Object.create(OpenAI.prototype),{model:'gpt-5-mini',key:'test-only',budget:()=>{reserved++;return {id:'review'};},recordUsage:()=>{settled++;}});
 const q=await Engine.prototype.reviewOriginality.call({store:{read:()=>({live:{videos:[]}})},ai},{id:'new',segments:[],sources:[]},{manifest:{},frameFiles:[]},null);
 assert.equal(calls,1);assert.equal(reserved,1);assert.equal(settled,1);assert.equal(q.copyrightRisk,25);assert.equal(q.reason,verdict.reason);
});
