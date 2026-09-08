import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {assert,uid,now,log} from '../lib/core.mjs';
import {assetReady} from '../lib/rights.mjs';
import {hash,jsonFetch} from './providers.mjs';
import {probe,run} from './render.mjs';
export async function attachAsset(store,id,bytes){
 const a=store.read().live.assets.find(x=>x.id===id);assert(a,'素材が見つかりません。');assert(!a.file,'既存の素材を上書きできません。新しい素材として登録してください。');assert(bytes.length<100*1024*1024,'素材サイズは100MB未満にしてください。');
 const dir=resolve(store.directory,'assets',id);mkdirSync(dir,{recursive:true});const file=resolve(dir,'source.mp4');writeFileSync(file,bytes);let info;
 try{info=await probe(file);}catch{throw Error('動画として読み込めませんでした。権利確認済みのMP4を選んでください。');}
 const video=info.streams.find(x=>x.codec_type==='video');assert(video&&Number(info.format.duration)>2&&Number(info.format.duration)<=180,'2〜180秒の素材を使用してください。');
 store.update(s=>{const a=s.live.assets.find(a=>a.id===id);Object.assign(a,{file,sha256:hash(bytes),duration:Number(info.format.duration),width:video.width,height:video.height});log(s.live,'asset','素材ファイルと検査結果を保存しました。');});return store.read().live.assets.find(x=>x.id===id);
}
export async function discoverAsset(store,query,{excludeIds=[]}={}){
 assert(process.env.PEXELS_API_KEY,'TYPE Bには権利確認済みの素材、またはPEXELS_API_KEYが必要です。');
 query=String(query).replace(/[\u0000-\u001f]/g,'').trim().slice(0,100);assert(query,'映像検索のクエリが必要です。');
 const state=store.read(),key=query.toLowerCase(),cached=state.assetSearchCache?.[key];
 let response=cached&&Date.now()-Date.parse(cached.at)<86400000?cached.response:null;
 if(!response){response=await jsonFetch('https://api.pexels.com/videos/search?'+new URLSearchParams({query,per_page:'12',orientation:'portrait',size:'medium'}),{headers:{Authorization:process.env.PEXELS_API_KEY}});store.update(s=>{s.assetSearchCache??={};s.assetSearchCache[key]={at:now(),response};const keys=Object.keys(s.assetSearchCache);for(const old of keys.slice(0,Math.max(0,keys.length-60)))delete s.assetSearchCache[old];});}
 const suitable=v=>v.duration>5&&v.duration<=120;
 const reusable=(response.videos||[]).filter(suitable).map(v=>state.live.assets.find(a=>a.providerId===v.id)).find(a=>assetReady(a)&&existsSync(a.file)&&a.inspection?.usable&&a.inspection?.confidence>=.85&&!excludeIds.includes(a.id));
 if(reusable)return reusable;
 const candidate=response.videos?.find(v=>suitable(v)&&!state.live.assets.some(a=>a.providerId===v.id));if(!candidate)return null;
 const choices=candidate.video_files.filter(f=>f.file_type==='video/mp4'&&f.width<=1920&&f.height<=1920&&new URL(f.link).hostname==='videos.pexels.com').sort((a,b)=>b.width*b.height-a.width*a.height);assert(choices.length,'対応形式の素材が見つかりません。');
 const file=choices[0];const r=await fetch(file.link,{redirect:'error',signal:AbortSignal.timeout(120000)});if(!r.ok){const e=Error('素材の取得に失敗しました。');e.status=r.status;throw e;}let n=0;const chunks=[];for await(const c of r.body){n+=c.length;assert(n<60*1024*1024,'素材サイズ上限を超えました。');chunks.push(c);}
 const a={id:uid(),provider:'Pexels',providerId:candidate.id,title:query+' / Pexels',sourceUrl:candidate.url,downloadUrl:file.link,license:'pexels',commercialAllowed:true,modificationAllowed:true,creditRequired:false,creditText:`Video by ${candidate.user.name} on Pexels (${candidate.url})`,evidence:'Pexels License https://www.pexels.com/license/; API response retained. Identifiable persons require additional review.',rightsStatus:'provider_verified',rightsCheckedAt:now(),acquiredAt:now(),context:'商用ストックの参考映像。撮影場所・経緯・面白い出来事の実在を保証する情報はない。',containsPeople:false,consentConfirmed:false,file:null};
 a.searchQuery=query;a.providerResponse=candidate;a.licenseUrl='https://www.pexels.com/license/';
 const bytes=Buffer.concat(chunks),sha256=hash(bytes),duplicate=state.live.assets.find(x=>x.sha256===sha256);
 if(duplicate)return assetReady(duplicate)&&!excludeIds.includes(duplicate.id)?duplicate:null;
 store.update(s=>{s.live.assets.push(a);});return attachAsset(store,a.id,bytes);
}
export async function inspectAsset(store,ai,asset){
 assert(assetReady(asset),'素材の利用権、クレジット、人物の許諾を確認してください。');assert(hash(readFileSync(asset.file))===asset.sha256,'素材ファイルが登録後に変更されています。');
 if(asset.inspection?.usable===true&&asset.inspection.confidence>=.85&&asset.inspection.copyrightConcern===false&&asset.inspection.safetyConcern===false&&asset.inspectionSha256===asset.sha256)return asset.inspection;
 const dir=resolve(store.directory,'assets',asset.id);const frames=[];for(let i=0;i<8;i++){const f=resolve(dir,`inspect-${i}.jpg`);await run('ffmpeg',['-y','-ss',String((i+.5)/8*asset.duration),'-i',asset.file,'-frames:v','1','-vf','scale=432:-2',f],30000);frames.push('data:image/jpeg;base64,'+readFileSync(f).toString('base64'));}
 const q=await ai.response(`素材映像の等間隔8フレームです。観察できる状況だけを日本語で記述。国・日付・事故の原因・人物の感情・種の断定など見えない事実は推測しない。単なる翻訳再投稿でなく独自の日本語解説に使えるか。危険、負傷、未成年、第三者の人物・ブランド・透かし、プライバシー、不確実性を確認。JSON {"usable":boolean,"confidence":0..1,"summary":"観察できた事実","containsPeople":boolean,"copyrightConcern":boolean,"safetyConcern":boolean,"commentaryAngle":"独自の補足視点","unknowns":["断定できない点"]}。提供者の説明（未検証）:${asset.context}`,{images:frames});
 const x=q.value;const ok=x.usable===true&&x.confidence>=.85&&x.copyrightConcern===false&&x.safetyConcern===false&&(!x.containsPeople||asset.consentConfirmed);
 store.update(s=>{const a=s.live.assets.find(a=>a.id===asset.id);a.inspection=x;a.inspectedAt=now();a.inspectionSha256=a.sha256;a.containsPeople=!!x.containsPeople;if(!ok)a.rightsStatus='review';});assert(ok,'映像の権利・人物・状況に確信が持てないため、素材を確認待ちにしました。');return x;
}
