import {minimumScenes,requiresExplanation,normalizeVisual} from '../lib/visual.mjs';
import {assetReady} from '../lib/rights.mjs';
import {assert} from '../lib/core.mjs';

// Use measured speech boundaries, not the model's guessed running time.
export function buildScenePlan(v,segments,assets=[],{repair=0}={}) {
 assert(segments.length>0,'台本がありません。');
 const duration=segments.at(-1).end;
 assert(duration>=20&&duration<=60,'動画尺は20〜60秒が必要です。');
 const byId=new Map(assets.map(a=>[a.id,a]));
 const scenes=[];
 for(let i=0;i<segments.length;i++) {
  const s=segments[i],visual=normalizeVisual(s),length=s.end-s.start;
  assert(length>0&&Number.isFinite(length),'音声の区間が不正です。');
  const target=repair?2.6:Math.min(3.7,Number(v.sceneSeconds)||visual.durationHint);
  const count=Math.max(1,Math.ceil(length/target));
  const candidates=[s.assetId,...(s.assetIds||[]),...(v.segmentAssets?.[i]||[])].filter(Boolean);
  if(!candidates.length&&v.assetId)candidates.push(v.assetId); // Legacy TYPE B.
  // A sourced concept can be revealed in the opening without inventing new claims.
  if(i===0&&!candidates.length&&!visual.diagramSpec)visual.diagramSpec=segments.map(x=>x.diagramSpec).find(Boolean);
  for(const id of candidates)assert(assetReady(byId.get(id)), 'シーンに指定された素材が欠損または権利未確認です。');
  for(let j=0;j<count;j++) {
   const assetId=candidates[j%candidates.length]||null;
   const card=!!visual.diagramSpec&&(!assetId||!scenes.some(x=>x.diagramSpec)||['diagram','science_card','comparison'].includes(visual.visualType)||j%2===1||i%2===0);
   const visualType=card?(visual.diagramSpec.type==='comparison'?'comparison':'diagram'):assetId?'real_footage':'science_card';
   // The fallback repeats only already checked words, with no invented causal link.
   const fallbackLabels=visual.diagramSpec?.labels||[visual.overlay||Array.from(s.text).slice(0,14).join(''),...(visual.callout?[visual.callout]:[])];
   const effect=visual.effect==='clean'?(j%2?'pan':'zoom'):j%2===1&&visual.effect==='zoom'?'pan':visual.effect;
   const start=j===0?s.start:Math.round((s.start+j*length/count)*30)/30,end=j===count-1?s.end:Math.round((s.start+(j+1)*length/count)*30)/30;
   scenes.push({index:scenes.length,segmentIndex:i,start,end,duration:end-start,visualType,assetId:card?null:assetId,effect,variant:(i+j+repair)%3,overlay:visual.overlay,callout:visual.callout,focus:visual.focus,sourceIds:card?visual.diagramSpec.sourceIds:s.sourceIds||[],activeStep:card?(j+repair)%visual.diagramSpec.labels.length:null,diagramSpec:card?visual.diagramSpec:undefined,labels:fallbackLabels,sourceOffset:effect==='replay'?0:(i*2+j*1.2),transition:scenes.length?'cut':'opening',hook:i===0});
  }
 }
 // Short measured sentences can underfill the target count. Split the longest scene.
 while(scenes.length<minimumScenes(duration)) {
  let k=0;scenes.forEach((s,i)=>{if(s.duration>scenes[k].duration)k=i;});
  const s=scenes[k],middle=Math.round((s.start+s.end)*15)/30;
  scenes.splice(k,1,{...s,end:middle,duration:middle-s.start},{...s,start:middle,duration:s.end-middle,variant:(s.variant+1)%3,effect:s.effect==='zoom'?'pan':'zoom',transition:'cut'});
 }
 scenes.forEach((s,i)=>s.index=i);
 assert(scenes.every((s,i)=>s.duration>0&&s.duration<=6&&(!i||Math.abs(s.start-scenes[i-1].end)<.001)),'シーンの連続性を確認できません。');
 assert(!requiresExplanation(v)||scenes.some(s=>s.diagramSpec),'根拠付き説明図がありません。投稿を保留します。');
 return scenes;
}
export function sceneFeatures(scenes,duration,captionChars=0) {
 const count=f=>scenes.filter(f).length;
 const signature=s=>JSON.stringify([s.visualType,s.assetId,s.diagramSpec,s.labels,s.effect,s.activeStep,s.variant]);
 return {sceneCount:scenes.length,averageSceneDuration:duration/scenes.length,maxSceneDuration:Math.max(...scenes.map(s=>s.duration)),realFootageRatio:scenes.filter(s=>s.assetId).reduce((n,s)=>n+s.duration,0)/duration,diagramCount:count(s=>!!s.diagramSpec),scienceCardCount:count(s=>s.visualType==='science_card'),explanationCount:count(s=>!!s.diagramSpec),zoomCount:count(s=>s.effect==='zoom'),replayCount:count(s=>s.effect==='replay'),highlightCount:count(s=>s.effect==='highlight'&&s.focus),calloutCount:count(s=>!!s.callout),hookVisualType:scenes[0]?.visualType,captionDensity:captionChars/duration,meaningfulChanges:scenes.slice(1).filter((s,i)=>signature(s)!==signature(scenes[i])).length,visualStyle:count(s=>!!s.assetId)?'footage_diagrams':'explainer_motion'};
}
