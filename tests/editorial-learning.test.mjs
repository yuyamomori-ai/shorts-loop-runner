import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/core.mjs';
import {editorialBrief,editorialPrompt,normalizeEditorialTrial} from '../runner/editorial-guidance.mjs';
import {performanceCandidates,performanceFingerprint} from '../runner/performance-learning.mjs';
test('creator advice and our own quality feedback remain distinct from audience evidence',()=>{
 const s=initialState();s.settings.productionLearning=true;s.live.videos=[{id:'one',createdAt:'2026-09-16',visualQa:{fix:'短い見出し',issues:['hook']}},{id:'unsafe',visualQa:{factConcern:true,fix:'作り話'}}];
 const b=editorialBrief(s);assert.equal(b.productionLessons.length,1);assert.equal(b.performanceLearning,'pending_additional_terms');assert(editorialPrompt(s).includes('科学的根拠ではない'));
 assert(normalizeEditorialTrial({guidanceId:'visual-hook',adoptedChange:'冒頭に動く模式図'}));assert.equal(normalizeEditorialTrial({guidanceId:'fabricated',adoptedChange:'a'}),null);
});
test('performance analysis needs actual completed equal windows and stays bounded',()=>{
 const s=initialState();for(let i=0;i<5;i++){s.live.videos.push({id:'v'+i,youtubeId:'yt'+i,publicVerifiedAt:'2026-09-01'});s.live.metrics.push({videoId:'v'+i,origin:'youtube',complete:true,windowDays:7,views:1000+i*1000,engagedViews:500,averageViewPercentage:80});}
 assert.deepEqual(performanceCandidates(s),[]);s.settings.derivedApproved=true;
 assert.deepEqual(performanceCandidates(s).map(x=>x.videoId),['v4','v0']);
 s.live.videos[4].lastAnalyzedHash=performanceFingerprint(s.live.metrics[4]);assert.deepEqual(performanceCandidates(s).map(x=>x.videoId),['v3','v0']);
 s.live.metrics[3].windowDays=1;assert(!performanceCandidates(s).some(x=>x.videoId==='v3'));
});
test('new official reactions invalidate stale analysis, and missing observations never become zero',()=>{
 const m={views:100,likes:null,shares:null},fingerprint=performanceFingerprint(m);assert.notEqual(fingerprint,performanceFingerprint({...m,likes:1}));assert.notEqual(fingerprint,performanceFingerprint({...m,shares:0}));
});
test('failed factual checks teach what to avoid without becoming scientific evidence',()=>{
 const s=initialState();s.settings.productionLearning=true;
 s.live.videos=[{id:'failed',createdAt:'2026-09-23',qa:{facts:'failed'},factCheck:{highRisk:false,checks:[{supported:false,visualSupported:true,reason:'研究から個人への実践指示を導けない'}]}},{id:'unsafe',qa:{facts:'failed'},factCheck:{highRisk:true,checks:[]}}];
 const b=editorialBrief(s);assert.equal(b.groundingLessons.length,1);assert(b.groundingLessons[0].basis.includes('never a source'));assert.equal(s.live.videos[0].qa.facts,'failed');
 s.settings.productionLearning=false;assert.deepEqual(editorialBrief(s).groundingLessons,[]);
});
