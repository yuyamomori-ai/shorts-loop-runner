// Exact synthetic test pattern: exercises editing, not a discovered real event.
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {initialState,plan} from '../lib/core.mjs';
import {run,renderVideo} from './render.mjs';
import {hash} from './providers.mjs';
const dir=resolve(process.argv[2]||'work/type-b-preview');mkdirSync(dir,{recursive:true});
const source=resolve(dir,'original-test-pattern.mp4');
await run('ffmpeg',['-y','-f','lavfi','-i','testsrc2=s=720x1280:r=30:d=12','-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p',source]);
const s=initialState();plan(s.live,1);const v=s.live.videos[0];Object.assign(v,{id:'type-b-editing-test',contentType:'B',genre:'編集の動作検証',captionStyle:'clean',segments:[
 {text:'編集で、見え方が変わる。',role:'hook',effect:'clean'},
 {text:'これは実際の出来事ではなく、動作確認用の映像です。',role:'body',effect:'zoom',callout:'ここではズーム'},
 {text:'次はスロー再生。速度を変えたことも画面に表示します。',role:'body',effect:'slow',callout:'見逃した動きを確認'},
 {text:'同じ場面をもう一度。リプレイと明示しています。',role:'body',effect:'replay'},
 {text:'囲みと字幕を加えて、注目する場所を分かりやすく。',role:'answer',effect:'highlight'},
 {text:'本番では、権利を確認した映像に独自の解説を加えます。',role:'cta',effect:'clean'}
 ]});
const asset={id:'original-pattern',file:source,sha256:hash(readFileSync(source)),duration:12,license:'owned'};
const out=await renderVideo(v,{directory:dir,preview:true,asset});writeFileSync(resolve(dir,'preview-result.json'),JSON.stringify({videoFile:out.videoFile,manifest:out.manifest},null,2));console.log(JSON.stringify({videoFile:out.videoFile,duration:out.duration,type:'B',synthetic:true,preview:true}));
