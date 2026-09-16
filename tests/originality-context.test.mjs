import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../runner/engine.mjs';
test('originality review sees source evidence and only genuine public history',async()=>{
 let prompt;
 const context={store:{read:()=>({live:{videos:[{id:'failed',title:'UNPUBLISHED_TRIAL',status:'blocked'},{id:'private',youtubeId:'private-id',title:'PRIVATE_TRIAL',actualPrivacy:'private'},{id:'public',youtubeId:'public-id',title:'PUBLIC_WORK',actualPrivacy:'public'}]}})},ai:{response:async p=>{prompt=p;return {value:{originality:50,commentary:50,editing:70,educational:75,entertainment:50,copyrightRisk:10,reusedRisk:55,confidence:.7}};}}};
 const q=await Engine.prototype.reviewOriginality.call(context,{id:'new',contentType:'A',title:'新しい作品',segments:[],sources:[{id:'s1',url:'https://example.com/study',title:'SOURCE_TITLE'}],factCheck:{allSupported:true},sourceEvidence:[{id:'s1',sha256:'actual-hash',fetchedAt:'2026-09-16'}]},{manifest:{musicEvidence:{selectionStatus:'pending_native_selection'}},frameFiles:[]},null);
 assert(prompt.includes('PUBLIC_WORK'));assert(!prompt.includes('UNPUBLISHED_TRIAL'));assert(!prompt.includes('PRIVATE_TRIAL'));assert(prompt.includes('SOURCE_TITLE'));assert(prompt.includes('actual-hash'));assert.equal(q.reusedRisk,55);assert.equal(q.confidence,.7);
});
