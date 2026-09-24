import {Engine} from '../runner/engine.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceCandidates,sourcePayload,trustedSource} from '../runner/providers.mjs';
import {factReviewPass,FACT_REVIEW_INSTRUCTIONS,canRepairVisualFacts,UNVERIFIED_FACT_RISK,diagramRepairSchema} from '../runner/fact-review.mjs';
import {initialState} from '../lib/core.mjs';
import {initializeAutomation,pauseAutomation} from '../lib/automation.mjs';

test('PMC uses only its documented E-utilities API, not article-page scraping',()=>{
 const list=sourceCandidates('https://pmc.ncbi.nlm.nih.gov/articles/PMC3360550/');
 assert.equal(list.length,1);assert(trustedSource(list[0]));assert(list[0].includes('db=pmc&id=PMC3360550'));
 assert.deepEqual(sourceCandidates('https://pmc.ncbi.nlm.nih.gov/search/'),[]);
 assert.deepEqual(sourceCandidates('https://pmc.ncbi.nlm.nih.gov.evil.invalid/articles/PMC3360550/'),[]);
 assert.equal(sourceCandidates('https://pubmed.ncbi.nlm.nih.gov/27531308/').length,2);
});
test('XML evidence requires actual article prose, not only long metadata or an API error',()=>{
 const prose='Observed primary research conditions and limitations. '.repeat(30);
 const x=sourcePayload('<article><article-title>A &amp; B</article-title><abstract>'+prose+'</abstract><body>'+prose+'</body></article>',{xml:true});
 assert.equal(x.title,'A & B');assert(x.text.includes(prose.trim()));
 assert.throws(()=>sourcePayload('<article><metadata>'+prose+'</metadata></article>',{xml:true}),/メタデータ/);
 assert.throws(()=>sourcePayload('<ERROR>'+prose+'</ERROR>',{xml:true}),/API/);
});
const v={segments:[{text:'なぜ噴き出す？',role:'hook',sourceIds:[]},{text:'根拠のある説明',role:'body',sourceIds:['s1']}],sources:[{id:'s1'}]};
const q={allSupported:true,allVisualsSupported:true,highRisk:false,checks:[{index:0,claimType:'non_assertive',supported:true,visualSupported:true,sourceIds:[]},{index:1,claimType:'assertion',supported:true,visualSupported:true,sourceIds:['s1']}]};
test('pure questions have explicit semantics but no failed fact verdict is converted into a pass',()=>{
 assert(factReviewPass(v,q));assert(FACT_REVIEW_INSTRUCTIONS.includes('疑問の前提'));
 for(const change of [{allSupported:false},{allVisualsSupported:false},{highRisk:true}])assert(!factReviewPass(v,{...q,...change}));
 const clone=()=>structuredClone(q);
 let bad=clone();bad.checks[0].supported=false;assert(!factReviewPass(v,bad));
 bad=clone();bad.checks[0].claimType='assertion';assert(!factReviewPass(v,bad));
 bad=clone();bad.checks[0].visualSupported=false;assert(!factReviewPass(v,bad));
 bad=clone();bad.checks[1].sourceIds=['invented'];assert(!factReviewPass(v,bad));
 bad=clone();bad.checks[1].index=0;assert(!factReviewPass(v,bad));
});
test('malformed editorial drafts are rejected individually while rights and OAuth failures still pause',()=>{
 for(const reason of ['自動修正の台本が不正です。','再編集した台本が長すぎます。']){
  const s=initialState();initializeAutomation(s,{enabled:true});pauseAutomation(s,reason);
  assert.equal(s.automation.phase,'running');assert.equal(s.settings.paused,false);
 }
 for(const reason of ['著作権を確認できません。','invalid_grant']){
  const s=initialState();initializeAutomation(s,{enabled:true});pauseAutomation(s,reason);
  assert.equal(s.automation.phase,'attention');assert.equal(s.settings.paused,true);
 }
});

test('only a visual-only factual rejection can receive at most two corrections followed by fresh fact verification',()=>{
 const video={segments:[{text:'確認済みの主張',sourceIds:['s1'],diagramSpec:{type:'process',labels:['A','B'],sourceIds:['s1']}}],sources:[{id:'s1'}],risk:UNVERIFIED_FACT_RISK,qa:{facts:'failed'},factCheck:{allSupported:true,allVisualsSupported:false,highRisk:false,checks:[{index:0,claimType:'assertion',supported:true,visualSupported:false,sourceIds:['s1']}]}};
 assert(canRepairVisualFacts(video));assert.equal(video.qa.facts,'failed');assert.equal(video.risk,UNVERIFIED_FACT_RISK);
 for(const patch of [{risk:'copyright'},{uploadIntent:'unknown'},{youtubeId:'sent'},{visualFactRepairs:2},{qa:{assetRights:'failed'}}])assert(!canRepairVisualFacts({...video,...patch}));
 for(const patch of [{allSupported:false},{highRisk:true},{checks:[{index:0,claimType:'assertion',supported:false,visualSupported:false,sourceIds:['s1']}]}])assert(!canRepairVisualFacts(video,{...video.factCheck,...patch}));
});

test('diagram correction cannot change narration or clear a factual hold before independent verification',async()=>{
 const video={id:'fixture',revision:1,approvedRevision:1,approvedDigest:'old',verifiedContentHash:null,segments:[{text:'確認済みの主張',role:'body',sourceIds:['s1'],visualType:'diagram',diagramSpec:{type:'process',labels:['A','B'],sourceIds:['s1']}}],sources:[{id:'s1'}],sourceEvidence:[{id:'s1',text:'primary evidence'}],risk:UNVERIFIED_FACT_RISK,qa:{facts:'failed'},factCheck:{allSupported:true,allVisualsSupported:false,highRisk:false,checks:[{index:0,claimType:'assertion',supported:true,visualSupported:false,sourceIds:['s1']}]}};
 const state={live:{videos:[video]}};let verified=false;
 const context={store:{read:()=>state,update:fn=>fn(state)},progress:()=>{},ai:{response:async()=>({value:{visuals:[{index:0,text:'invented claim',visualType:'diagram',overlay:'比較',callout:'',diagramSpec:{type:'concept',labels:['A','B'],sourceIds:['s1']}}]}})},verify:async()=>{verified=true;throw Error('independent fact check rejected');}};
 await assert.rejects(Engine.prototype.repairVisualFacts.call(context,'fixture'),/independent fact/);
 assert(verified);assert.equal(video.segments[0].text,'確認済みの主張');assert.equal(video.risk,UNVERIFIED_FACT_RISK);assert.equal(video.qa.facts,'pending');assert.equal(video.visualFactRepairs,1);assert.equal(video.approvedRevision,null);assert.equal(video.approvedDigest,undefined);
});

test('structured visual repair constrains the actual failing indices and registered evidence',()=>{
 const schema=diagramRepairSchema([3],['s1','s2']),items=schema.properties.visuals.items;
 assert.deepEqual(items.properties.index.enum,[3]);assert.equal(schema.properties.visuals.maxItems,1);assert.equal(items.additionalProperties,false);
 assert.deepEqual(items.properties.diagramSpec.anyOf[0].properties.sourceIds.items.enum,['s1','s2']);
});

test('correction diagrams cannot reintroduce unsupported causal arrows',()=>{assert.deepEqual(diagramRepairSchema([3],['s1']).properties.visuals.items.properties.diagramSpec.anyOf[0].properties.type.enum,['concept','comparison']);});
