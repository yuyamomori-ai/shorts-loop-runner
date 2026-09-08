import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/core.mjs';
import {benchmarkCandidate,durationSeconds,freshBenchmarks,purgeBenchmarks,referencesForNextVideo,normalizeBenchmarkTrial,benchmarkPrompt} from '../runner/benchmarks.mjs';
const sample=(overrides={})=>({id:'abcdefghijk',snippet:{title:'Why is the sky blue? #shorts',description:'',liveBroadcastContent:'none',thumbnails:{high:{url:'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'}}},statistics:{viewCount:'500000'},contentDetails:{duration:'PT35S'},status:{privacyStatus:'public'},...overrides});
const memoryStore=()=>{let data=initialState();data.settings.derivedApproved=true;return {read:()=>structuredClone(data),update:fn=>fn(data)};};
test('500k threshold is inclusive and duration is not treated as proof of Shorts classification',()=>{
 const r=benchmarkCandidate(sample());assert.equal(r.views,500000);assert.match(r.shortsEvidence,/candidate/);assert.equal(r.retention,undefined);
 assert.equal(benchmarkCandidate(sample({statistics:{viewCount:'499999'}})),null);
 assert.equal(benchmarkCandidate(sample({contentDetails:{duration:'PT3M1S'}})),null);
 assert.equal(benchmarkCandidate(sample({snippet:{title:'ordinary short video'}})),null);
 assert.equal(durationSeconds('PT1M20S'),80);assert(Number.isNaN(durationSeconds('invalid')));
});
test('foreign thumbnail hosts and missing statistics cannot become visual evidence',()=>{
 const v=sample();v.snippet.thumbnails.high.url='https://evil.example/abcdefghijk/a.jpg';assert.equal(benchmarkCandidate(v).thumbnail,null);
 assert.equal(benchmarkCandidate(sample({statistics:{}})),null);
 assert.equal(benchmarkCandidate(sample({status:{privacyStatus:'private'}})),null);
});
test('references refresh per video while discovery searches are cached',async()=>{
 const store=memoryStore(),calls=[];const youtube={connected:()=>true,token:async()=>'fake',request:async(path)=>{calls.push(path);return path==='search'?{items:[{id:{videoId:'abcdefghijk'}}]}:{items:[sample()]};}};
 assert.equal((await referencesForNextVideo(store,youtube,'科学')).length,1);
 assert.equal((await referencesForNextVideo(store,youtube,'科学')).length,1);
 assert.deepEqual(calls,['search','videos','videos']);
});
test('unavailable references never manufacture learning, and revoked items leave cache',async()=>{
 const store=memoryStore();store.update(s=>s.benchmarkLibrary={items:[benchmarkCandidate(sample())],searches:{science:new Date().toISOString()}});
 const youtube={connected:()=>true,token:async()=>'fake',request:async()=>({items:[]})};
 assert.deepEqual(await referencesForNextVideo(store,youtube,'科学'),[]);assert.deepEqual(freshBenchmarks(store.read()),[]);
 youtube.request=async()=>{throw Object.assign(Error('offline'),{status:503});};assert.deepEqual(await referencesForNextVideo(store,youtube,'科学'),[]);
});
test('expired API data and derived notes expire together',()=>{
 const state=initialState(),old=new Date(Date.now()-8*86400000).toISOString();state.benchmarkLibrary={items:[benchmarkCandidate(sample(),old)]};state.live.videos=[{benchmarkTrial:{observedAt:old}}];purgeBenchmarks(state);assert.equal(state.benchmarkLibrary.items.length,0);assert.equal(state.live.videos[0].benchmarkTrial,undefined);
});
test('only refreshed reference IDs and observable evidence can be recorded',()=>{
 const refs=[benchmarkCandidate(sample())],trial={referenceIds:['abcdefghijk'],basis:'title',observedFeature:'短い疑問形',adoptedChange:'冒頭に身近な疑問を示す',isCausalProof:false};
 assert(normalizeBenchmarkTrial(trial,refs));assert.equal(normalizeBenchmarkTrial({...trial,basis:'full-video'},refs),null);assert.equal(normalizeBenchmarkTrial({...trial,referenceIds:['fabrication']},refs),null);assert.match(benchmarkPrompt(refs),/本編/);
});
test('existing derived-use approval and disabled configuration prevent API calls',async()=>{
 const store=memoryStore();store.update(s=>s.settings.derivedApproved=false);const youtube={connected:()=>true,token:async()=>{throw Error('must not call');}};assert.deepEqual(await referencesForNextVideo(store,youtube,'科学'),[]);assert.deepEqual(await referencesForNextVideo(store,youtube,'科学',{enabled:false}),[]);
});
