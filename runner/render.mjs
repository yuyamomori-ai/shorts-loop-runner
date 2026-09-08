import {cleanRenderIntermediates} from './storage.mjs';
import {mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync,renameSync,unlinkSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {assert,now} from '../lib/core.mjs';
import {hash} from './providers.mjs';
import {assetReady} from '../lib/rights.mjs';
import {requiresExplanation,minimumScenes,VISUAL_VERSION} from '../lib/visual.mjs';
import {buildScenePlan,sceneFeatures} from './visual-plan.mjs';
import {assHeader,event,assSafe,captionEvents,sceneOverlayEvents} from './science-cards.mjs';
const renderThreads=Math.max(1,Math.min(4,Number(process.env.FFMPEG_THREADS)||2));
export function run(command,args,timeout=600000){if(command==='ffmpeg')args=['-nostats','-threads',String(renderThreads),'-filter_threads',String(renderThreads),'-filter_complex_threads',String(renderThreads),...args];return new Promise((res,rej)=>{const child=spawn(command,args,{windowsHide:true});let out='',err='',diagnostics='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>{const chunk=x.toString();if(/black_start:|freeze_start:|Invalid data|Error while decoding/.test(chunk))diagnostics=(diagnostics+chunk).slice(-12000);err=(err+chunk).slice(-16000);});const t=setTimeout(()=>{child.kill();rej(new Error('処理が制限時間を超えました。'));},timeout);child.on('error',e=>{clearTimeout(t);rej(e);});child.on('close',code=>{clearTimeout(t);code===0?res({out,err:diagnostics+'\n'+err}):rej(new Error(`${command}: ${err.slice(-1200)}`));});});}
export async function probe(file){return JSON.parse((await run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file],30000)).out);}
function wavMusic(seconds,segmentStarts){
 const rate=24000,n=Math.ceil(seconds*rate),b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);
 const notes=[220,277.18,329.63,440];for(let i=0;i<n;i++){const t=i/rate,env=Math.min(1,t/1.5,(seconds-t)/1.5);const f=notes[Math.floor(t/2)%notes.length];let y=(Math.sin(2*Math.PI*f*t)+.45*Math.sin(2*Math.PI*f*2*t))*.012*Math.max(0,env);for(const s of segmentStarts){const dt=t-s;if(dt>=0&&dt<.08)y+=Math.sin(2*Math.PI*(650+700*dt)*dt)*.015*(1-dt/.08);}b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,y))*32767),44+i*2);}return b;
}
export async function narration(text,file,ai,speed=1.04,role='body'){
 if(ai?.key){await ai.speech(text,file,speed,role);return 'OpenAI TTS';}
 if(process.env.VOICEVOX_URL){
  assert(process.env.VOICEVOX_RIGHTS_CONFIRMED==='true'&&process.env.VOICEVOX_CREDIT,'VOICEVOXの音声利用条件とクレジットを設定してください。');
  const base=process.env.VOICEVOX_URL.replace(/\/$/,''),speaker=process.env.VOICEVOX_SPEAKER||'3';
  const q=await fetch(base+'/audio_query?'+new URLSearchParams({text,speaker}),{method:'POST',signal:AbortSignal.timeout(30000)});
  if(!q.ok){const e=Error('音声サービスに接続できません。');e.status=q.status;throw e;}
  const body=await q.json();body.speedScale=speed;
  const r=await fetch(base+'/synthesis?speaker='+speaker,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
  if(!r.ok){const e=Error('音声サービスで生成に失敗しました。');e.status=r.status;throw e;}
  writeFileSync(file,Buffer.from(await r.arrayBuffer()));return 'VOICEVOX';
 }
 throw Error('投稿・完成プレビューにはAIナレーションが必要です。OpenAI接続を確認してください。');
}
const escapeFilter=p=>p.replaceAll('\\','/').replaceAll(':','\\:').replaceAll("'","\\'");
function volumeNumbers(log){return {peak:Number(log.match(/max_volume: (-?[\d.]+)/)?.[1]),mean:Number(log.match(/mean_volume: (-?[\d.]+)/)?.[1])};}
export async function validateMedia(file){
 const info=await probe(file),video=info.streams.find(x=>x.codec_type==='video'),audio=info.streams.find(x=>x.codec_type==='audio'),duration=Number(info.format.duration);
 assert(video?.width===1080&&video.height===1920&&video.codec_name==='h264'&&audio&&duration>=20&&duration<=60.1,'動画の形式・音声・尺の検査に失敗しました。');
 // Decode every frame; sample review alone cannot establish stream integrity.
 const r=await run('ffmpeg',['-hide_banner','-v','info','-xerror','-i',file,'-vf','blackdetect=d=0.03:pix_th=0.07:pic_th=0.98,freezedetect=n=-50dB:d=5.8','-af','volumedetect','-f','null','-'],240000);
 const levels=volumeNumbers(r.err);
 assert(Number.isFinite(levels.peak)&&levels.peak<-.1&&levels.mean>-45,'音声の音量検査に失敗しました。');
 assert(!/black_start:/.test(r.err),'黒画面を検出したため投稿を保留します。');
 assert(!/freeze_start:/.test(r.err),'長い静止画面を検出したため投稿を保留します。');
 return {passed:true,decoded:true,noBlackFrames:true,noLongFreeze:true,audioStream:true,...levels,duration};
}
export async function renderVideo(v,{directory,ai,preview=false,lightweight=false,englishTest=false,asset=null,assets=[],repair=0,retainAudio=false}={}){
 assert(/^[a-zA-Z0-9-]{1,80}$/.test(v.id),'動画IDが不正です。');
 assert(!lightweight||preview,'軽量プレビューは投稿用に使えません。');
 assert(lightweight||ai?.key||process.env.VOICEVOX_URL,'投稿用動画にはAIナレーションが必要です。');
 const font=englishTest?'DejaVu Sans':process.env.CAPTION_FONT||'Noto Sans CJK JP';
 const fontCheck=await run('fc-match',[font],10000).catch(()=>({out:''}));
 if(!englishTest)assert(/NotoSansCJK|Noto Sans CJK|NotoSansJP|YuGoth|Meiryo|msgothic|ipa/i.test(fontCheck.out)||process.env.CAPTION_FONT_VERIFIED==='true','日本語フォントを確認できません。');
 const dir=resolve(directory,'media',v.id);mkdirSync(dir,{recursive:true});
 const segments=[],speechEvidence=[];let cursor=0,provider=lightweight?'missing':null;
 const speed=Math.max(.95,Math.min(1.15,Number(v.narrationSpeed)||1.04));
 for(let i=0;i<v.segments.length;i++){
  const s=v.segments[i],file=resolve(dir,`speech-${i}.wav`),cache=resolve(dir,`speech-${i}.json`);let seconds;
  if(lightweight)seconds=i===0?2:Math.min(9,Math.max(3,s.text.length/6.5));
  else{
   const fingerprint=hash(JSON.stringify([s.text,s.role,speed,ai?.key?'openai':process.env.VOICEVOX_URL,process.env.OPENAI_TTS_MODEL,process.env.OPENAI_VOICE,process.env.VOICEVOX_SPEAKER,'natural-ja-v2']));
   let saved;try{saved=JSON.parse(readFileSync(cache));}catch{}
   const reusable=existsSync(file)&&saved?.fingerprint===fingerprint&&hash(readFileSync(file))===saved.sha256;
   if(!reusable){
    provider=await narration(s.text,file+'.tmp',ai,speed,s.role);renameSync(file+'.tmp',file);
    saved={fingerprint,sha256:hash(readFileSync(file)),provider};writeFileSync(cache,JSON.stringify(saved));
   }else provider=saved.provider;
   const p=await probe(file);assert(p.streams.some(x=>x.codec_type==='audio'),'ナレーションの音声ストリームがありません。');
   const raw=Number(p.format.duration);assert(raw>.15&&raw<=25,'ナレーションの長さが不正です。');
   const level=volumeNumbers((await run('ffmpeg',['-hide_banner','-i',file,'-af','volumedetect','-f','null','-'],30000)).err);
   assert(level.mean>-50,'無音のナレーションを検出しました。');
   seconds=Math.ceil((raw+.12)*30)/30;speechEvidence.push({index:i,sha256:saved.sha256,provider,duration:raw,meanDb:level.mean});
  }
  segments.push({...s,start:cursor,end:cursor+seconds,audio:file});cursor+=seconds;
 }
 if(lightweight&&cursor<20){segments.at(-1).end+=20-cursor;cursor=20;}
 assert(cursor>=20&&cursor<=60,`実際の音声尺が${cursor.toFixed(1)}秒です。20〜60秒に収まる台本に修正してください。`);
 const allAssets=[...new Map([...(asset?[asset]:[]),...assets].map(a=>[a.id,a])).values()];
 for(const a of allAssets)assert(assetReady(a)&&existsSync(a.file)&&hash(readFileSync(a.file))===a.sha256,'使用素材の権利・ファイル整合性を確認できません。');
 const scenes=buildScenePlan(v,segments,allAssets,{repair}),caption=captionEvents(segments,{size:repair?48:v.captionStyle==='bold'?55:52});
 const features=sceneFeatures(scenes,cursor,caption.totalChars);
 assert(features.meaningfulChanges>=minimumScenes(cursor)-1,'視覚変化が不足しています。');
 let ass=assHeader(font,caption.size)+caption.events;
 for(const scene of scenes)ass+=sceneOverlayEvents(scene);
 ass+=event(0,cursor,'Meta',`{\\an7\\pos(96,180)\\fs28}${assSafe(v.genre)} / ${lightweight?'軽量プレビュー・音声なし':preview?'完成プレビュー':'AI音声・出典は説明欄'}`,4);
 const assFile=resolve(dir,'captions.ass');writeFileSync(assFile,ass);
 const time=x=>new Date(x*1000).toISOString().slice(11,23).replace('.',',');
 writeFileSync(resolve(dir,'captions.srt'),segments.map((s,i)=>`${i+1}\n${time(s.start)} --> ${time(s.end)}\n${s.text}\n`).join('\n'));
 const sceneFiles=[];
 for(const scene of scenes){
  const a=allAssets.find(a=>a.id===scene.assetId),file=resolve(dir,`scene-${scene.index}.mp4`);
  const input=['-y'];let filter;
  if(a){
   input.push('-stream_loop','-1','-i',a.file);
   const speed=scene.effect==='slow'?.72:1;
   const offset=Math.min(scene.sourceOffset,Math.max(0,a.duration-2));
   const zoom=scene.effect==='zoom'?`zoompan=z='min(1.04+on*0.0008,1.14)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1080x1920:fps=30`:
    `crop=1080:1920:x='(iw-ow)*${scene.effect==='pan'?`(0.2+0.6*min(t/${scene.duration},1))`:scene.variant===1?'.3':'.7'}':y='(ih-oh)*0.45'`;
   filter=`trim=start=${offset},setpts=(PTS-STARTPTS)/${speed},fps=30,scale=1188:2112:force_original_aspect_ratio=increase,${zoom},setsar=1`;
   if(scene.effect==='highlight'){
    // A highlight requires an inspected focus; never fabricate a point of interest.
    const f=scene.focus;
    if(f)filter+=`,drawbox=x=${Math.round(f.x*1080)}:y=${Math.round(f.y*1920)}:w=${Math.round(f.w*1080)}:h=${Math.round(f.h*1920)}:color=0xaae67a:t=5`;
   }
  }else{
   input.push('-f','lavfi','-i',`color=c=${['0x102c46','0x172e44','0x1c2941'][scene.variant]}:s=1080x1920:r=30:d=${scene.duration}`);
   filter=`drawgrid=w=90:h=90:t=1:c=0x58819b@0.1,drawbox=x=60:y=376:w=960:h=882:c=0x294962@0.55:t=2,setsar=1`;
  }
  filter+=`,drawbox=x=76:y=1330:w=928:h=195:color=black@0.42:t=fill,format=yuv420p`;
  await run('ffmpeg',[...input,'-an','-vf',filter,'-r','30','-t',String(scene.duration),'-c:v','libx264','-threads',String(renderThreads),'-preset','veryfast','-crf','23','-pix_fmt','yuv420p',file]);sceneFiles.push(file);
 }
 const list=resolve(dir,'scenes.txt');writeFileSync(list,sceneFiles.map(f=>`file '${f.replaceAll('\\','/').replaceAll("'","'\\''")}'`).join('\n'));
 const music=resolve(dir,'music.wav');writeFileSync(music,wavMusic(cursor,scenes.filter((s,i)=>!i||s.effect==='highlight'||s.callout).map(x=>x.start)));
 const input=['-y','-f','concat','-safe','0','-i',list];
 for(const f of lightweight?[music]:[...segments.map(x=>x.audio),music])input.push('-i',f);
 let af;
 if(lightweight)af='[1:a]anull[a]';
 else af=segments.map((s,i)=>`[${i+1}:a]apad=pad_dur=0.16,atrim=duration=${s.end-s.start},aresample=24000,aformat=channel_layouts=mono[a${i}]`).join(';')+';'+segments.map((_,i)=>`[a${i}]`).join('')+`concat=n=${segments.length}:v=0:a=1,alimiter=limit=0.85[voice];[voice][${segments.length+1}:a]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9[a]`;
 const out=resolve(dir,'video.mp4'),temp=resolve(dir,'video-rendering.mp4');
 await run('ffmpeg',[...input,'-vf',`subtitles=filename='${escapeFilter(assFile)}'`,'-filter_complex',af,'-map','0:v','-map','[a]','-c:v','libx264','-threads',String(renderThreads),'-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-t',String(cursor),'-movflags','+faststart',temp]);
 const mechanicalQa=await validateMedia(temp);renameSync(temp,out);
 for(const f of readdirSync(dir))if(/^frame-\d+\.jpg$/.test(f))unlinkSync(resolve(dir,f));
 const frameFiles=[],frameTimes=[.25,1.2,...scenes.map(s=>s.start+s.duration*.55).filter(t=>t>1.3)].filter((x,i,a)=>x<cursor&&a.indexOf(x)===i);
 for(let i=0;i<frameTimes.length;i++){
  const f=resolve(dir,`frame-${i}.jpg`);await run('ffmpeg',['-y','-ss',String(frameTimes[i]),'-i',out,'-frames:v','1','-vf','scale=432:768',f],30000);frameFiles.push(f);
 }
 const used=allAssets.filter(a=>scenes.some(s=>s.assetId===a.id));
 const manifest={synthetic:!!v.synthetic,visualVersion:VISUAL_VERSION,createdAt:now(),duration:mechanicalQa.duration,width:1080,height:1920,codec:'h264',sha256:hash(readFileSync(out)),narration:provider,narrationVerified:!lightweight&&speechEvidence.length===segments.length,audioStream:true,speech:speechEvidence,credit:lightweight?'No narration (lightweight preview)':provider==='VOICEVOX'?process.env.VOICEVOX_CREDIT:'AI-generated narration (OpenAI)',music:'Original procedural composition generated locally; no third-party music',visual:used.length?'Licensed illustrative footage + original sourced explanatory diagrams':'Original animated sourced explanatory diagrams',...features,assetCount:used.length,assets:used.map(a=>({id:a.id,provider:a.provider,sourceUrl:a.sourceUrl,license:a.license,commercialAllowed:a.commercialAllowed,modificationAllowed:a.modificationAllowed,credit:a.creditText,acquiredAt:a.acquiredAt,rightsCheckedAt:a.rightsCheckedAt,sha256:a.sha256})),captionTiming:lightweight?'Estimated preview timing':'Measured per-sentence narration with short proportional caption cards',captions:{size:caption.size,maxLines:caption.maxLines,minSeconds:caption.minSeconds,bottom:caption.bottom},preview,lightweight,mechanicalQa,peakDb:mechanicalQa.peak,frameTimes,frames:frameFiles.map(x=>x.split(/[\\/]/).pop())};
 assert(!requiresExplanation(v)||manifest.explanationCount>0,'説明図がないため投稿を保留します。');
 writeFileSync(resolve(dir,'manifest.json'),JSON.stringify(manifest,null,2));
 if(!retainAudio)cleanRenderIntermediates(directory,v.id);
 return {videoFile:out,videoHash:manifest.sha256,duration:manifest.duration,segments,manifest,scenePlan:scenes,frameFiles};
}
