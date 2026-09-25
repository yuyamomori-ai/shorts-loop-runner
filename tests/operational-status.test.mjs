import test from 'node:test';
import assert from 'node:assert/strict';
import {operationalStatus} from '../runner/operational-status.mjs';
import {presentationFailure} from '../lib/render-failures.mjs';
import {initialState} from '../lib/core.mjs';
import {pauseAutomation} from '../lib/automation.mjs';
import {sceneBackground} from '../runner/science-cards.mjs';

test('status records distinguish prepared media from actual publication without leaking secrets',()=>{
 const s=initialState();s.automation={youtubeReconnectRequired:true,phase:'attention',targetEmail:'secret@example.invalid'};
 s.live.videos=[{id:'queued',title:'公開待ち',status:'review',uploadSession:'secret-url',videoFile:'/secret/path',mediaManifest:{narrationVerified:true,generatedImageCount:2,musicEvidence:{title:'Licensed track'}},visualQa:{passed:true}}];
 const r=operationalStatus(s,{youtube:false,generatedImages:true,productionLearning:true,derivedApproved:false});
 assert(r.reconnectRequired);assert.equal(r.videos[0].publicVerifiedAt,null);assert.equal(r.videos[0].music,'Licensed track');assert.equal(r.performanceLearning,false);assert(!JSON.stringify(r).includes('secret'));
});
test('only measured script failures allow presentation repair; facts and rights always stop',()=>{
 const s=initialState();s.automation={phase:'running'};
 for(const reason of ['字幕を読む時間が不足しています。台本を短くしてください。','実際の音声尺が61.4秒です。20〜60秒に収まる台本に修正してください。']){assert(presentationFailure(Error(reason)));pauseAutomation(s,reason);assert.equal(s.settings.paused,false);}
 for(const reason of ['フリーBGMの整合性が変わりました。','事実確認が必要','MONTHLY_AI_BUDGET','OpenAI接続エラー'])assert.equal(presentationFailure(Error(reason)),false);
 pauseAutomation(s,'素材の権利確認が必要');assert.equal(s.settings.paused,true);
});
test('every diagram palette retains bright background luminance',()=>{
 for(let variant=0;variant<3;variant++){const hex=sceneBackground(variant).slice(2),[r,g,b]=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));assert(.2126*r+.7152*g+.0722*b>220);}
});
test('background presentation rejection preserves manual and OAuth pauses',()=>{
 for(const pause of [{userPaused:true,phase:'paused',reason:'一時停止中'},{youtubeReconnectRequired:true,phase:'attention',reason:'Google再認可待ち'}]){
  const s=initialState();s.automation={...pause};
  pauseAutomation(s,'字幕を読む時間が不足しています。台本を短くしてください。');
  assert.equal(s.settings.paused,true);assert.deepEqual(s.automation,pause);
 }
});
