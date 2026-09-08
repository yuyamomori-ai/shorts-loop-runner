import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Store} from './store.mjs';
import {Engine} from './engine.mjs';
import {OpenAI} from './providers.mjs';
import {blockers,now} from '../lib/core.mjs';
import {run} from './render.mjs';

async function preflight(liveEngine){
 const result={ffmpeg:false,ffprobe:false,japaneseFont:false,youtubeAuthorized:false,checkedAt:now(),errors:[]};
 for(const binary of ['ffmpeg','ffprobe'])try{await run(binary,['-version'],10000);result[binary]=true;}catch{result.errors.push(binary+'を起動できません。');}
 try{const font=await run('fc-match',[process.env.CAPTION_FONT||'Noto Sans CJK JP'],10000);result.japaneseFont=/NotoSansCJK|Noto Sans CJK|NotoSansJP|YuGoth|Meiryo|msgothic|ipa/i.test(font.out)||process.env.CAPTION_FONT_VERIFIED==='true';}catch{}
 if(!result.japaneseFont)result.errors.push('日本語フォントを確認できません。');
 try{const response=await liveEngine.youtube.request('channels',{part:'id',mine:'true'});result.youtubeAuthorized=!!response.items?.length;if(!result.youtubeAuthorized)result.errors.push('接続先のYouTubeチャンネルを確認できません。');}catch(e){result.errors.push('YouTube認可確認: '+e.message);}
 console.log('Visual preflight: '+JSON.stringify(result));return result;
}

// Run against isolated records, with the real account's daily AI budget. Never uploads.
export async function runAcceptance(liveEngine,{runId='visual-v1'}={}){
 if(!/^[a-zA-Z0-9-]{1,80}$/.test(runId))throw Error('検証IDが不正です。');
 const directory=resolve(liveEngine.store.directory,'validation',runId),reportFile=resolve(directory,'report.json');
 mkdirSync(directory,{recursive:true});
 const checks=await preflight(liveEngine);
 if(existsSync(reportFile)){
  const saved=JSON.parse(readFileSync(reportFile));saved.preflight=checks;saved.youtubeConnectionPreserved=checks.youtubeAuthorized;
  if(/credit_balance_exhausted|insufficient_quota/.test(saved.error||'')){saved.errorCode='AI_BILLING';saved.error='OpenAIの利用残高・課金上限を確認してください。残高不足のため制作テストを停止しました。';}
  writeFileSync(reportFile,JSON.stringify(saved,null,2));return saved;
 }
 const store=new Store(directory),engine=new Engine(store);
 engine.ai=new OpenAI(liveEngine.store);
 engine.youtube=liveEngine.youtube;
 engine.upload=async()=>{throw Error('受入テストではアップロードを実行できません。');};
 engine.schedulePublished=engine.upload; // Saved production OpenAI key, same daily ledger.
 store.update(s=>{s.settings.paused=true;s.settings.privacy='private';s.settings.mode='review';s.automation.enabled=false;});
 const report={runId,startedAt:now(),status:'running',tests:[],preflight:checks,youtubeConnectionPreserved:checks.youtubeAuthorized};
 const progress=()=>liveEngine.store.update(s=>{s.visualAcceptance=report;});progress();
 try{
  report.youtubeTokenRefreshPassed=checks.youtubeAuthorized;
  if(checks.errors.length)throw Error(checks.errors.join(' '));
  if(!engine.ai.key)throw Error('OpenAI接続が見つからず、実AI音声の検証を開始できません。');
  for(const spec of [{name:'science',genre:'科学',topic:'炭酸飲料の圧力と気泡。一次資料で根拠を確認できない場合は身近な光や温度の科学。'},{name:'knowledge',genre:'記憶',topic:'情報を入力して保持し、思い出す学習。研究対象と限界を明示。'}]){
   console.log('Visual acceptance: generating '+spec.name);
   report.currentTest=spec.name;progress();
   let id;try{
   await engine.generate(1,'A',{...spec,skipReferences:true});
   id=store.read().live.videos[0].id;
   await engine.render(id);
   const v=store.read().live.videos.find(v=>v.id===id),issues=blockers(v,true);
   report.tests.push({name:spec.name,videoId:id,title:v.title,passed:!issues.length,issues,manifest:v.mediaManifest,segments:v.segments.map(({audio,...s})=>s),sources:v.sources,scenePlan:v.scenePlan,visualQa:v.visualQa,facts:v.qa.facts,rights:v.qa.rights,originality:v.originality});
   console.log('Visual acceptance: '+JSON.stringify({name:spec.name,passed:!issues.length,videoId:id,narration:v.mediaManifest.narration,scenes:v.mediaManifest.sceneCount,assets:v.mediaManifest.assetCount,diagrams:v.mediaManifest.diagramCount,seconds:v.duration,visualQa:v.visualQa.passed}));
   }catch(e){report.tests.push({name:spec.name,videoId:id,passed:false,error:e.message});console.log('Visual acceptance: '+spec.name+' failed: '+e.message);if(e.code==='AI_BILLING'||e.code==='DAILY_AI_BUDGET'){report.error=e.message;report.errorCode=e.code;break;}}
   writeFileSync(reportFile,JSON.stringify(report,null,2));
  }
  report.status=report.tests.length===2&&report.tests.every(t=>t.passed)?'passed':'failed';
 }catch(e){report.status='failed';report.error=e.message;report.errorCode=e.code||null;console.log('Visual acceptance: failed: '+e.message);}
 finally{report.finishedAt=now();delete report.currentTest;progress();writeFileSync(reportFile,JSON.stringify(report,null,2));store.close();}
 return report;
}
