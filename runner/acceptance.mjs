import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Store} from './store.mjs';
import {Engine} from './engine.mjs';
import {OpenAI} from './providers.mjs';
import {blockers,now} from '../lib/core.mjs';

// Run against isolated records, with the real account's daily AI budget. Never uploads.
export async function runAcceptance(liveEngine,{runId='visual-v1'}={}){
 if(!/^[a-zA-Z0-9-]{1,80}$/.test(runId))throw Error('検証IDが不正です。');
 const directory=resolve(liveEngine.store.directory,'validation',runId),reportFile=resolve(directory,'report.json');
 if(existsSync(reportFile))return JSON.parse(readFileSync(reportFile));
 mkdirSync(directory,{recursive:true});
 const store=new Store(directory),engine=new Engine(store);
 engine.ai=new OpenAI(liveEngine.store); // Saved production OpenAI key, same daily ledger.
 store.update(s=>{s.settings.paused=true;s.settings.privacy='private';s.settings.mode='review';s.automation.enabled=false;});
 const report={runId,startedAt:now(),status:'running',tests:[],youtubeConnectionPreserved:liveEngine.capabilities().youtube};
 try{
  if(!engine.ai.key)throw Error('OpenAI接続が見つからず、実AI音声の検証を開始できません。');
  for(const spec of [{name:'science',genre:'科学',topic:'炭酸飲料の圧力と気泡。一次資料で根拠を確認できない場合は身近な光や温度の科学。'},{name:'knowledge',genre:'記憶',topic:'情報を入力して保持し、思い出す学習。研究対象と限界を明示。'}]){
   console.log('Visual acceptance: generating '+spec.name);
   await engine.generate(1,'A',spec);
   const id=store.read().live.videos[0].id;
   await engine.render(id);
   const v=store.read().live.videos.find(v=>v.id===id),issues=blockers(v,true);
   report.tests.push({name:spec.name,videoId:id,title:v.title,passed:!issues.length,issues,manifest:v.mediaManifest,visualQa:v.visualQa,facts:v.qa.facts,rights:v.qa.rights,originality:v.originality});
   console.log('Visual acceptance: '+JSON.stringify({name:spec.name,passed:!issues.length,videoId:id,narration:v.mediaManifest.narration,scenes:v.mediaManifest.sceneCount,assets:v.mediaManifest.assetCount,diagrams:v.mediaManifest.diagramCount,seconds:v.duration,visualQa:v.visualQa.passed}));
   if(issues.length)throw Error('生成動画が投稿前検査を通過しませんでした。');
  }
  report.status='passed';
 }catch(e){report.status='failed';report.error=e.message;console.log('Visual acceptance: failed: '+e.message);}
 finally{report.finishedAt=now();writeFileSync(reportFile,JSON.stringify(report,null,2));store.close();}
 return report;
}
