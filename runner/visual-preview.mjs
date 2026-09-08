import {resolve} from 'node:path';
import {initialState,proposal,CATALOG} from '../lib/core.mjs';
import {renderVideo} from './render.mjs';
// Deterministic, non-publishable layout checks; live acceptance uses real OpenAI TTS.
const directory=resolve(process.env.VISUAL_PREVIEW_DIR||'visual-preview');
for(const [name,index,labels] of [['science',2,['太陽の光','大気で散乱','青い空']],['knowledge',0,['文章を読む','本を閉じる','思い出す']]]){
 const v=proposal(initialState().live,CATALOG[index],()=>.1);v.id='visual-preview-'+name;
 const designs=index===2?[
  {type:'concept',labels:['太陽の光','青い空']},
  {type:'concept',labels:['太陽の光','いろいろな色']},
  {type:'comparison',labels:['青い光','赤い光'],caption:'青い光の方が散らばりやすい'},
  {type:'process',labels:['大気で散乱','いろいろな方向','目に届く']},
  {type:'process',labels:['光が散らばる','青い空']},
  {type:'concept',labels:['昼の空','夕方の空']}
 ]:[
  {type:'comparison',labels:['読む','思い出す']},
  {type:'concept',labels:['読む学習','思い出す練習']},
  {type:'comparison',labels:['検索練習','概念図の学習'],caption:'科学文章を使った研究の比較'},
  {type:'concept',labels:['教材','学習の条件']},
  {type:'process',labels:['本を閉じる','要点を言う']},
  {type:'concept',labels:['記憶','注意']}
 ];
 v.segments=v.segments.map((s,i)=>({...s,visualQuery:index===2?'blue sky sunlight':'reading book learning',visualType:designs[i].type==='comparison'?'comparison':'diagram',effect:i%2?'pan':'zoom',overlay:i===0?(index===2?'空は、なぜ青い？':'読むだけで覚えた？'):designs[i].caption?.slice(0,18)||designs[i].labels.join(' / ').slice(0,18),diagramSpec:{...designs[i],sourceIds:['s1']},sourceIds:['s1']}));
 const result=await renderVideo(v,{directory,preview:true,lightweight:true});
 console.log(JSON.stringify({name,videoFile:result.videoFile,manifest:result.manifest}));
}
