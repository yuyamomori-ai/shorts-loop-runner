import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Store} from './store.mjs';
import {Engine} from './engine.mjs';
import {OpenAI} from './providers.mjs';
import {blockers,now,assert} from '../lib/core.mjs';
import {repairableVisualReview} from '../lib/visual.mjs';
import {run} from './render.mjs';
import {validationFile} from './validation-files.mjs';

export function acceptanceIssues(checks,{requireYouTube=true}={}){
 const issues=[...(checks.errors||[])];
 if(requireYouTube&&!checks.youtubeAuthorized)issues.push(checks.youtubeError||'YouTube認可を確認できません。');
 return issues;
}
async function preflight(liveEngine){
 const a=liveEngine.store.read().automation||{};
 const result={automation:{phase:a.phase,reason:a.reason,retryAt:a.retryAt,publicUploadRequested:!!a.publicUploadRequested},ffmpeg:false,ffprobe:false,japaneseFont:false,youtubeAuthorized:false,checkedAt:now(),errors:[]};
 for(const binary of ['ffmpeg','ffprobe'])try{await run(binary,['-version'],10000);result[binary]=true;}catch{result.errors.push(binary+'を起動できません。');}
 try{const font=await run('fc-match',[process.env.CAPTION_FONT||'Noto Sans CJK JP'],10000);result.japaneseFont=/NotoSansCJK|Noto Sans CJK|NotoSansJP|YuGoth|Meiryo|msgothic|ipa/i.test(font.out)||process.env.CAPTION_FONT_VERIFIED==='true';}catch{}
 if(!result.japaneseFont)result.errors.push('日本語フォントを確認できません。');
 try{const response=await liveEngine.youtube.request('channels',{part:'id',mine:'true'});result.youtubeAuthorized=!!response.items?.length;if(!result.youtubeAuthorized)result.youtubeError='接続先のYouTubeチャンネルを確認できません。';}catch(e){result.youtubeError='YouTube認可確認: '+e.message;}
 console.log('Visual preflight: '+JSON.stringify(result));return result;
}

// Opt-in owner diagnostics for isolated acceptance media through authenticated logs.
// Never reads production media, credentials, source bodies, or arbitrary paths.
function logAcceptanceFrames(base,runId,report){
 if(process.env.SHORTSLOOP_VALIDATION_LOG_FRAMES!=='true')return;
 for(const test of report.tests||[]){
  if(!['science','knowledge'].includes(test.name))continue;
  for(const frame of [0,2,6]){
   const file=validationFile(base,`/api/validation/${runId}/${test.name}/frame-${frame}.jpg`);
   if(!file)continue;const bytes=readFileSync(file);if(bytes.length>100000)continue;
   const data=bytes.toString('base64'),size=6000,parts=Math.ceil(data.length/size);
   for(let part=0;part<parts;part++)console.log('Visual review image: '+JSON.stringify({runId,test:test.name,frame,part,parts,mime:'image/jpeg',data:data.slice(part*size,(part+1)*size)}));
  }
 }
}


export function canRepairAcceptance(prior,v){
 if(!prior||prior.passed)return false;
 if(!v)return ['図解は同じセグメントの出典で裏付けてください。','企画の出典IDが登録された資料にありません。','台本の形式が不正です。','取得可能な一次資料が足りないため、根拠のない企画は制作しません。'].includes(prior.error);
 return v.privacy==='private'&&!v.youtubeId&&!v.uploadIntent&&!v.uploadSession&&!v.risk&&v.qa?.facts==='passed'&&v.qa?.assetRights!=='failed'&&repairableVisualReview(v.visualQa);
}
// Isolated records, shared monetary/daily ledger, and no upload capability.
export async function runAcceptance(liveEngine,{runId='visual-v1',requireYouTube=true}={}){
 if(!/^[a-zA-Z0-9-]{1,80}$/.test(runId))throw Error('検証IDが不正です。');
 const directory=resolve(liveEngine.store.directory,'validation',runId),reportFile=resolve(directory,'report.json');
 mkdirSync(directory,{recursive:true});const checks=await preflight(liveEngine);
 let previous=null;
 const request=process.env.SHORTSLOOP_VALIDATION_REPAIR_REQUEST||'';
 if(existsSync(reportFile)){
  const saved=JSON.parse(readFileSync(reportFile));saved.preflight=checks;saved.youtubeConnectionPreserved=checks.youtubeAuthorized;
  const repair=saved.status==='failed'&&/^[a-zA-Z0-9-]{1,80}$/.test(request)&&saved.repairRequest!==request&&(saved.repairAttempts||0)<2;
  if(!repair){writeFileSync(reportFile,JSON.stringify(saved,null,2));logAcceptanceFrames(liveEngine.store.directory,runId,saved);return saved;}
  previous=saved;
 }
 const store=new Store(directory),engine=new Engine(store);engine.ai=new OpenAI(liveEngine.store);engine.youtube=liveEngine.youtube;
 engine.upload=async()=>{throw Error('受入テストではアップロードを実行できません。');};engine.schedulePublished=engine.upload;
 store.update(s=>{s.settings.paused=true;s.settings.privacy='private';s.settings.mode='review';s.automation.enabled=false;});
 const report={runId,scope:requireYouTube?'full':'renderer-only',startedAt:now(),status:'running',tests:[],preflight:checks,youtubeConnectionPreserved:checks.youtubeAuthorized,
  repairRequest:previous?request:null,repairAttempts:previous?(previous.repairAttempts||0)+1:0,
  attemptHistory:previous?[...(previous.attemptHistory||[]),{finishedAt:previous.finishedAt,status:previous.status,tests:previous.tests.map(({name,videoId,passed,error})=>({name,videoId,passed,error}))}].slice(-2):[]};
 const progress=()=>liveEngine.store.update(s=>{s.visualAcceptance=report;});progress();
 // Persist the bounded retry intent before any paid request; restarts cannot reset it.
 writeFileSync(reportFile,JSON.stringify(report,null,2));
 try{
  report.youtubeTokenRefreshPassed=checks.youtubeAuthorized;
  const prerequisites=acceptanceIssues(checks,{requireYouTube});if(prerequisites.length)throw Error(prerequisites.join(' '));
  if(!engine.ai.key)throw Error('OpenAI接続が見つからず、実AI音声の検証を開始できません。');
  for(const spec of [{name:'science',genre:'科学',sourceUrls:['https://pubmed.ncbi.nlm.nih.gov/30925060/','https://pmc.ncbi.nlm.nih.gov/articles/PMC6963625/'],topic:'炭酸飲料の圧力と気泡。一次資料で根拠を確認できない場合は身近な光や温度の科学。'},{name:'knowledge',genre:'記憶',topic:'情報を入力して保持し、思い出す学習。研究対象と限界を明示。'}]){
   const prior=previous?.tests.find(t=>t.name===spec.name);
   if(prior?.passed){report.tests.push(prior);continue;}
   console.log('Visual acceptance: '+(prior?'repairing ':'generating ')+spec.name);
   report.currentTest=spec.name;progress();let id=prior?.videoId;
   try{
    const existing=id&&store.read().live.videos.find(v=>v.id===id);
    if(prior)assert(canRepairAcceptance(prior,existing),'受入テストの事実・権利・安全性の不合格は編集だけでは再試行しません。');
    if(!existing){await engine.generate(1,'A',{...spec,skipReferences:true});id=store.read().live.videos[0].id;}
    await engine.render(id);
    const v=store.read().live.videos.find(v=>v.id===id),issues=blockers(v,true);
    report.tests.push({name:spec.name,videoId:id,title:v.title,passed:!issues.length,issues,manifest:v.mediaManifest,segments:v.segments.map(({audio,...s})=>s),sources:v.sources,scenePlan:v.scenePlan,visualQa:v.visualQa,facts:v.qa.facts,rights:v.qa.rights,originality:v.originality});
    console.log('Visual acceptance: '+JSON.stringify({name:spec.name,passed:!issues.length,videoId:id,narration:v.mediaManifest.narration,scenes:v.mediaManifest.sceneCount,assets:v.mediaManifest.assetCount,images:v.mediaManifest.generatedImageCount,music:v.mediaManifest.music,diagrams:v.mediaManifest.diagramCount,seconds:v.duration,visualQa:v.visualQa.passed}));
   }catch(e){if(!id){const candidates=store.read().live.videos.filter(v=>v.genre===spec.genre);if(candidates.length===1)id=candidates[0].id;}const failed=id&&store.read().live.videos.find(v=>v.id===id);report.tests.push({name:spec.name,videoId:id,passed:false,error:e.message,facts:failed?.qa?.facts,factCheck:failed?.factCheck,visualQa:failed?.visualQa,originality:failed?.originality});console.log('Visual acceptance: '+spec.name+' failed: '+e.message);console.log('Visual acceptance failure: '+JSON.stringify({name:spec.name,videoId:id,facts:failed?.qa?.facts,factCheck:failed?.factCheck,visualQa:failed?.visualQa,originality:failed?.originality}));if(['AI_BILLING','DAILY_AI_BUDGET','MONTHLY_AI_BUDGET'].includes(e.code)){report.error=e.message;report.errorCode=e.code;break;}}
   writeFileSync(reportFile,JSON.stringify(report,null,2));
  }
  report.status=report.tests.length===2&&report.tests.every(t=>t.passed)?(requireYouTube?'passed':'renderer_passed'):'failed';
 }catch(e){report.status='failed';report.error=e.message;report.errorCode=e.code||null;console.log('Visual acceptance: failed: '+e.message);}
 finally{report.finishedAt=now();delete report.currentTest;progress();writeFileSync(reportFile,JSON.stringify(report,null,2));logAcceptanceFrames(liveEngine.store.directory,runId,report);store.close();}
 return report;
}
