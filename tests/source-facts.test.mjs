import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceCandidates,sourcePayload,trustedSource} from '../runner/providers.mjs';
import {factReviewPass,FACT_REVIEW_INSTRUCTIONS} from '../runner/fact-review.mjs';
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
