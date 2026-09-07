import {cleanRenderIntermediates} from './storage.mjs';
import {mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {assert,now} from '../lib/core.mjs';
import {hash} from './providers.mjs';
const renderThreads=Math.max(1,Math.min(4,Number(process.env.FFMPEG_THREADS)||2));
export function run(command,args,timeout=600000){if(command==='ffmpeg')args=['-threads',String(renderThreads),'-filter_threads',String(renderThreads),'-filter_complex_threads',String(renderThreads),...args];return new Promise((res,rej)=>{const child=spawn(command,args,{windowsHide:true});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>{err=(err+x).slice(-12000);});const t=setTimeout(()=>{child.kill();rej(new Error('処理が制限時間を超えました。'));},timeout);child.on('error',e=>{clearTimeout(t);rej(e);});child.on('close',code=>{clearTimeout(t);code===0?res({out,err}):rej(new Error(`${command}: ${err.slice(-1200)}`));});});}
export async function probe(file){return JSON.parse((await run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file],30000)).out);}
function wavMusic(seconds,segmentStarts){
 const rate=24000,n=Math.ceil(seconds*rate),b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);
 const notes=[220,277.18,329.63,440];for(let i=0;i<n;i++){const t=i/rate,env=Math.min(1,t/1.5,(seconds-t)/1.5);const f=notes[Math.floor(t/2)%notes.length];let y=(Math.sin(2*Math.PI*f*t)+.45*Math.sin(2*Math.PI*f*2*t))*.012*Math.max(0,env);for(const s of segmentStarts){const dt=t-s;if(dt>=0&&dt<.08)y+=Math.sin(2*Math.PI*(650+700*dt)*dt)*.015*(1-dt/.08);}b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,y))*32767),44+i*2);}return b;
}
const stamp=x=>`${Math.floor(x/3600)}:${String(Math.floor(x/60)%60).padStart(2,'0')}:${(x%60).toFixed(2).padStart(5,'0')}`;
const safe=x=>String(x).replace(/[{}\\\r]/g,'').replace(/\n/g,' ');
function wrap(text,n=14){const c=Array.from(safe(text)),lines=[];while(c.length)lines.push(c.splice(0,n).join(''));return lines.join('\\N');}
async function narration(text,file,ai,speed=1.08){
 if(process.env.VOICEVOX_URL){
  assert(process.env.VOICEVOX_RIGHTS_CONFIRMED==='true'&&process.env.VOICEVOX_CREDIT,'VOICEVOXの音声利用条件とクレジットを設定してください。');const base=process.env.VOICEVOX_URL.replace(/\/$/,'');const speaker=process.env.VOICEVOX_SPEAKER||'3';const q=await fetch(base+'/audio_query?'+new URLSearchParams({text,speaker}),{method:'POST',signal:AbortSignal.timeout(30000)});assert(q.ok,'VOICEVOXに接続できません。');const body=await q.json();body.speedScale=speed;const r=await fetch(base+'/synthesis?speaker='+speaker,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});assert(r.ok,'VOICEVOXの音声生成に失敗しました。');writeFileSync(file,Buffer.from(await r.arrayBuffer()));
 }else await ai.speech(text,file,speed);
}
export async function renderVideo(v,{directory,ai,preview=false,englishTest=false,asset=null}){
 const dir=resolve(directory,'media',v.id);mkdirSync(dir,{recursive:true});const segments=[];let cursor=0;
 for(let i=0;i<v.segments.length;i++){
  const s=v.segments[i],file=resolve(dir,`speech-${i}.wav`);let seconds;
  if(preview){seconds=i===0?2:Math.max(3.5,s.text.length/7);seconds=Math.min(seconds,12);}else{await narration(s.text,file,ai,v.narrationSpeed||1.08);seconds=Number((await probe(file)).format.duration)+.18;}
  segments.push({...s,start:cursor,end:cursor+seconds,audio:file});cursor+=seconds;
 }
 if(preview&&cursor<20){segments[segments.length-1].end+=20-cursor;cursor=20;}
 assert(cursor>=20&&cursor<=60,`実際の音声尺が${cursor.toFixed(1)}秒です。20〜60秒に収まる台本に修正してください。`);
 // All captions are split into short cards, timed within their own narrated sentence.
 const font=englishTest?'DejaVu Sans':process.env.CAPTION_FONT||'Noto Sans CJK JP';
 let ass=`[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${font},${v.captionStyle==='clean'?58:66},&H00FFFFFF,&H00FFFFFF,&H0034271C,&H00000000,-1,0,0,0,100,100,1,0,1,3,0,5,110,110,200,1\nStyle: Meta,${font},27,&H00B5BECF,&H00FFFFFF,&H0034271C,&H00000000,0,0,0,0,100,100,1,0,1,1,0,8,90,90,240,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
 for(const s of segments){const chars=Array.from(safe(s.text));const cards=[];while(chars.length)cards.push(chars.splice(0,38).join(''));for(let i=0;i<cards.length;i++){const a=s.start+(s.end-s.start)*i/cards.length,b=s.start+(s.end-s.start)*(i+1)/cards.length;assert(b-a>=1.4,'字幕を読む時間が不足しています。');ass+=`Dialogue: 0,${stamp(a)},${stamp(b)},Default,,0,0,0,,{\\fad(100,100)${asset?'\\an2\\pos(540,1460)':''}}${wrap(cards[i])}\n`;}}
 ass+=`Dialogue: 0,${stamp(0)},${stamp(cursor)},Meta,,0,0,0,,SHORTS LOOP / ${safe(v.genre)}\n`;
 ass+=`Dialogue: 0,${stamp(preview?0:cursor-4)},${stamp(cursor)},Meta,,0,0,0,,{\\an2\\pos(540,1500)}${wrap(preview?'字幕プレビュー / 音声未生成':'AI音声 / 出典は説明欄',22)}\n`;
 writeFileSync(resolve(dir,'captions.ass'),ass);
 let srt='';segments.forEach((s,i)=>{const t=x=>new Date(x*1000).toISOString().slice(11,23).replace('.',',');srt+=`${i+1}\n${t(s.start)} --> ${t(s.end)}\n${s.text}\n\n`;});writeFileSync(resolve(dir,'captions.srt'),srt);
 const music=resolve(dir,'music.wav');writeFileSync(music,wavMusic(cursor,segments.map(x=>x.start)));
 let sourceVideo=null;
 if(asset){
  assert(asset.file&&hash(readFileSync(asset.file))===asset.sha256,'使用素材を確認できません。');
  const scenes=[];
  for(let i=0;i<segments.length;i++){const s=segments[i],length=s.end-s.start,method=s.effect||['zoom','slow','replay','highlight'][i%4];const speed=method==='slow'?.65:1;const start=method==='replay'?0:Math.min(i*1.8,Math.max(0,asset.duration-3));const scene=resolve(dir,`scene-${i}.mp4`);
   const zoom=method==='zoom'?'scale=1242:2208:force_original_aspect_ratio=increase,crop=1080:1920':'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
   const focus=s.focus||{x:.3,y:.25,w:.4,h:.3};const box=method==='highlight'?`,drawbox=x=${Math.round(focus.x*1080)}:y=${Math.round(focus.y*1920)}:w=${Math.round(focus.w*1080)}:h=${Math.round(focus.h*1920)}:color=0xff8359:t=6`:'';
   await run('ffmpeg',['-y','-stream_loop','-1','-i',asset.file,'-an','-vf',`trim=start=${start},setpts=(PTS-STARTPTS)/${speed},${zoom}${box},drawbox=x=0:y=1230:w=1080:h=450:color=black@0.68:t=fill`,'-r','30','-t',String(length),'-c:v','libx264','-threads',String(renderThreads),'-preset','veryfast','-crf','23','-pix_fmt','yuv420p',scene]);scenes.push(scene);
   if(['slow','replay'].includes(method))ass+=`Dialogue: 1,${stamp(s.start)},${stamp(s.end)},Meta,,0,0,0,,{\\an7\\pos(90,360)}${method==='slow'?'SLOW 0.65x':'REPLAY'}\n`;
   if(s.callout)ass+=`Dialogue: 1,${stamp(s.start)},${stamp(s.end)},Meta,,0,0,0,,{\\an8\\pos(540,480)\\fs38}→ ${wrap(s.callout,18)}\n`;
  }
  writeFileSync(resolve(dir,'scenes.txt'),scenes.map(f=>`file '${f.replaceAll('\\','/')}'`).join('\n'));sourceVideo=resolve(dir,'background.mp4');await run('ffmpeg',['-y','-f','concat','-safe','0','-i',resolve(dir,'scenes.txt'),'-c','copy',sourceVideo]);writeFileSync(resolve(dir,'captions.ass'),ass);
 }
 const out=resolve(dir,'video.mp4');const input=['-y','-f','lavfi','-i',`color=c=0x192b3d:s=1080x1920:r=30:d=${cursor}`];
 if(sourceVideo)input.splice(0,input.length,'-y','-i',sourceVideo);
 const audioInputs=preview?[music]:[...segments.map(x=>x.audio),music];for(const f of audioInputs)input.push('-i',f);
 const assPath=resolve(dir,'captions.ass').replaceAll('\\','/').replaceAll(':','\\:').replaceAll("'","\\'");
 const videoFilter=`drawbox=x=78:y=320:w=6:h=124:color=0xff8359:t=fill,drawbox=x=78:y=1670:w=924:h=3:color=0x42576e:t=fill,subtitles=filename='${assPath}'`;
 let af;if(preview)af='[1:a]anull[a]';else{af=segments.map((s,i)=>`[${i+1}:a]apad=pad_dur=0.18,atrim=duration=${s.end-s.start},aresample=24000[a${i}]`).join(';')+';'+segments.map((_,i)=>`[a${i}]`).join('')+`concat=n=${segments.length}:v=0:a=1,alimiter=limit=0.85[voice];[voice][${segments.length+1}:a]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]`;}
 await run('ffmpeg',[...input,'-vf',videoFilter,'-filter_complex',af,'-map','0:v','-map','[a]','-c:v','libx264','-threads',String(renderThreads),'-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-t',String(cursor),'-movflags','+faststart',out]);
 const info=await probe(out),video=info.streams.find(x=>x.codec_type==='video'),audio=info.streams.find(x=>x.codec_type==='audio');assert(video?.width===1080&&video.height===1920&&video.codec_name==='h264'&&audio,'動画の形式検査に失敗しました。');
 const check=await run('ffmpeg',['-v','info','-i',out,'-af','volumedetect','-f','null','-'],120000);const peak=Number(check.err.match(/max_volume: (-?[\d.]+)/)?.[1]);assert(Number.isFinite(peak)&&peak<-.1,'音声の最大音量検査に失敗しました。');
 const fontCheck=await run('fc-match',[font],10000).catch(()=>({out:''}));if(!englishTest)assert(/NotoSansCJK|Noto Sans CJK|NotoSansJP|YuGoth|Meiryo|msgothic|ipa/i.test(fontCheck.out)||process.env.CAPTION_FONT_VERIFIED==='true','日本語フォントの確認に失敗しました。Docker版か確認済み日本語フォントを使用してください。');
 const frameFiles=[];for(let i=0;i<segments.length;i++){const f=resolve(dir,`frame-${i}.jpg`);await run('ffmpeg',['-y','-ss',String(segments[i].start+(segments[i].end-segments[i].start)*.37),'-i',out,'-frames:v','1','-vf','scale=432:768',f],30000);frameFiles.push(f);}
 const manifest={createdAt:now(),duration:Number(info.format.duration),width:1080,height:1920,sha256:hash(readFileSync(out)),narration:preview?'missing':process.env.VOICEVOX_URL?'VOICEVOX':'OpenAI TTS',credit:process.env.VOICEVOX_URL?process.env.VOICEVOX_CREDIT:'AI-generated narration',music:'Original procedural composition, generated locally by Shorts Loop',visual:asset?`Licensed source ${asset.id} / ${asset.license}; commentary, cuts, zoom, slowdown/replay labels, callouts`:'Original typography and geometric layout; no third-party imagery',captionTiming:'Per-sentence TTS duration; long sentences subdivided proportionally',preview,peakDb:peak,frames:frameFiles.map(x=>x.split(/[\\/]/).pop())};writeFileSync(resolve(dir,'manifest.json'),JSON.stringify(manifest,null,2));
 cleanRenderIntermediates(directory,v.id);
 return {videoFile:out,videoHash:manifest.sha256,duration:manifest.duration,segments,manifest,frameFiles};
}
