import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {hash} from './providers.mjs';
import {assert,now} from '../lib/core.mjs';

// Curated official download, verified 2026-09-24. No social-video extraction,
// scraping music catalogues, or raw audio committed to the application repo.
export const FREE_TRACK=Object.freeze({
 id:'kevin-macleod-monkeys-spinning-monkeys',title:'Monkeys Spinning Monkeys',artist:'Kevin MacLeod',
 sourceUrl:'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400011',
 downloadUrl:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Monkeys%20Spinning%20Monkeys.mp3',
 license:'CC-BY-4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
 licenseEvidence:'https://incompetech.com/music/royalty-free/licenses/',
 rightsCheckedAt:'2026-09-24',commercialAllowed:true,modificationAllowed:true,
 sha256:'a5bb345c23849ad0786aa0bc5157a9f2d4039660fe00282e55754d475f36dc14',
 credit:'"Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttps://creativecommons.org/licenses/by/4.0/\nhttps://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400011\n変更: 動画尺に合わせた抜粋・ループ・音量調整・フェード。'
});
export function musicMode(){return process.env.SHORTSLOOP_MUSIC_MODE||'licensed';}
export function licensedMusicValid(m){return m?.mode==='licensed'&&m.id===FREE_TRACK.id&&m.sha256===FREE_TRACK.sha256&&m.credit===FREE_TRACK.credit&&m.license===FREE_TRACK.license&&m.commercialAllowed===true&&m.modificationAllowed===true&&!!m.acquiredAt&&m.rightsCheckedAt===FREE_TRACK.rightsCheckedAt;}
export async function prepareLicensedMusic(directory,{fetchAudio=fetch}={}){
 const dir=resolve(directory,'licensed-music');mkdirSync(dir,{recursive:true});
 const file=resolve(dir,FREE_TRACK.id+'.mp3'),record=resolve(dir,FREE_TRACK.id+'.json');
 if(existsSync(file)){
  assert(hash(readFileSync(file))===FREE_TRACK.sha256,'フリーBGMの整合性が変わりました。権利を再確認するまで投稿を保留します。');
  let saved;try{saved=JSON.parse(readFileSync(record));}catch{}
  assert(licensedMusicValid(saved),'フリーBGMの取得・権利記録を確認できません。');return {...saved,file};
 }
 const r=await fetchAudio(FREE_TRACK.downloadUrl,{redirect:'error',signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw Object.assign(Error('フリーBGMの公式配布元から取得できません。'),{status:r.status});
 let size=0;const chunks=[];for await(const chunk of r.body){size+=chunk.length;assert(size<12000000,'フリーBGMのサイズ制限を超えました。');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);assert(hash(bytes)===FREE_TRACK.sha256,'フリーBGMの整合性が変わりました。権利を再確認するまで投稿を保留します。');
 const evidence={...FREE_TRACK,mode:'licensed',provider:'incompetech',acquiredAt:now(),hasBackgroundMusic:true,externalSamples:true,selectionStatus:'licensed_attached'};
 // Record first; a crash before the audio rename simply re-downloads, never invents a timestamp.
 writeFileSync(record,JSON.stringify(evidence,null,2));writeFileSync(file+'.tmp',bytes);renameSync(file+'.tmp',file);
 return {...evidence,file};
}
