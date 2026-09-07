import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {Store} from './store.mjs';
import {initialState,assert,uid,now,log,validateMetric} from '../lib/core.mjs';
if(existsSync('.env'))process.loadEnvFile('.env');
assert(process.argv[2],'使い方: node runner/restore.mjs バックアップ.json');
const imported=JSON.parse(readFileSync(resolve(process.argv[2])));assert([1,2].includes(imported.version)&&Array.isArray(imported.live?.videos),'バックアップ形式が異なります。');
const store=new Store();
store.update(s=>{
 assert(!s.live.videos.length,'復元先に企画があります。新しいDATA_DIRを指定して復元してください。');
 for(const v of imported.live.videos){assert(typeof v.title==='string'&&Array.isArray(v.segments)&&Array.isArray(v.sources),'企画形式が不正です。');s.live.videos.push({...v,id:uid(),status:'draft',youtubeId:undefined,uploadSession:undefined,uploadIntent:undefined,approvedDigest:undefined,approvedRevision:null,videoFile:undefined,videoHash:undefined,sourceEvidence:undefined,qa:{facts:'pending',rights:'pending',technical:'pending',visual:'pending'},synthetic:false,revision:(v.revision||0)+1});}
 // Restored content must pass fresh verification. Never restore upload sessions or approvals.
 s.settings.paused=true;log(s.live,'restore',`${s.live.videos.length}本の企画を復元しました。制作と事実確認を再実行してください。`);
});store.close();console.log('復元しました。');
