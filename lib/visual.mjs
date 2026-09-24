// Shared, dependency-free visual contract. Old records remain readable; publication is gated.
export const VISUAL_VERSION = 1;
export const VISUAL_TYPES = ['real_footage','science_card','diagram','comparison','mixed'];
export const EFFECTS = ['zoom','pan','slow','replay','highlight','clean'];
export const VISUAL_SCORES = ['visualVariety','visualRelevance','explanationClarity','hookStrength','captionReadability'];
const reviewProperties={passed:{type:'boolean'},...Object.fromEntries(VISUAL_SCORES.map(k=>[k,{type:'number'}])),factConcern:{type:'boolean'},safetyConcern:{type:'boolean'},copyrightConcern:{type:'boolean'},issues:{type:'array',items:{type:'string',enum:['scene_variety','captions','explanation','hook','tempo','fact','safety','rights']}},reason:{type:'string'},fix:{type:'string'}};
export const VISUAL_REVIEW_SCHEMA={type:'object',properties:reviewProperties,required:Object.keys(reviewProperties),additionalProperties:false};
export const CREATIVE_BRIEF = `Every text field is spoken aloud: use natural conversational sentences, never arrows or outline prefixes such as 答え： or 結論：. Keep diagram notation only in diagramSpec and overlay. Do not repeat the same explanation in consecutive segments. Use a short, intriguing Japanese headline suitable for large red text with a white outline. No clickbait unsupported by the answer. Include at most one or two short original spoken reactions or gentle tsukkomi when they fit, followed immediately by clear explanation. The reaction must appear in text to be narrated; callout alone is not spoken. Treat humor as a reaction, never a new factual claim, invented anecdote or ridicule of participants. Learn general pacing, question-to-payoff structure and contrast from references; never copy a creator's lines, distinctive jokes, branding, voice or footage. Keep the final payoff tied to the opening question. End with a source-supported answer, not practical advice inferred from a descriptive study. Do not tell viewers to try a habit, treatment, training routine or intervention unless the retrieved evidence actually supports that recommendation. A neutral follow-up question is preferable to an unsupported action instruction.`;
export const VISUAL_SCHEMA = `Each segment also needs visualQuery (specific English stock footage query), visualType (real_footage|science_card|diagram|comparison|mixed), effect (zoom|pan|slow|replay|highlight|clean), overlay (Japanese, <=18 characters), callout (<=18 characters), durationHint (2..4 seconds). At least two segments need diagramSpec: {type:process|comparison|concept, labels:[2 or 3 short Japanese labels, each <=14 characters], sourceIds:[supporting research IDs], caption:optional short condition/limitation}. Every arrow in process means a supported causal or temporal relationship; comparison does NOT imply causality. Use concept for a non-causal labeled concept. Diagrams, numbers and overlays must be supported by the segment's cited sources. Never invent a reaction, statistic, mechanism or research result. Plan a strong moving opening frame, phenomenon, why, mechanism, unexpected point and conclusion; avoid a list of facts. Stock footage is illustrative, never evidence of a particular incident.`;

const short=(x,n)=>typeof x==='string'?Array.from(x.replace(/[\u0000-\u001f{}\\]/g,'').trim()).slice(0,n).join(''):'';
export function normalizeVisual(s) {
 const focus=s.focus&&['x','y','w','h'].every(k=>Number.isFinite(s.focus[k])&&s.focus[k]>=0&&s.focus[k]<=1)&&s.focus.w>0&&s.focus.h>0&&s.focus.x+s.focus.w<=1&&s.focus.y+s.focus.h<=1?s.focus:undefined;
 let diagramSpec;
 const d=s.diagramSpec;
 if(d) {
  if(!['process','comparison','concept'].includes(d.type)||!Array.isArray(d.labels)||d.labels.length<2||d.labels.length>3||!d.labels.every(x=>typeof x==='string'&&Array.from(x).length<=14&&short(x,14))||!Array.isArray(d.sourceIds)||!d.sourceIds.length)throw Error('図解の形式または根拠IDが不足しています。');
  if(!d.sourceIds.every(id=>(s.sourceIds||[]).includes(id)))throw Error('図解は同じセグメントの出典で裏付けてください。');
  diagramSpec={type:d.type,labels:d.labels.map(x=>short(x,14)),sourceIds:[...new Set(d.sourceIds)],caption:short(d.caption,28)};
 }
 return {visualQuery:short(s.visualQuery,100),visualType:VISUAL_TYPES.includes(s.visualType)?s.visualType:diagramSpec?'diagram':'science_card',effect:EFFECTS.includes(s.effect)?s.effect:'clean',overlay:short(s.overlay,18),callout:short(s.callout,18),focus,durationHint:Math.max(2,Math.min(4,Number(s.durationHint)||3.3)),...(diagramSpec?{diagramSpec}:{})};
}
export function requiresExplanation(v) {return v.requiresExplanation===true||v.contentType!=='B'||/科学|化学|物理|温度|圧力|記憶|心理|自然現象/.test(v.genre||'');}
export function minimumScenes(duration) {return duration<=30?6:duration<=45?8:10;}
export function visualClaims(v) {return {title:v.title,description:v.description||'',segments:(v.segments||[]).map(s=>({text:s.text,role:s.role,sourceIds:s.sourceIds||[],visualType:s.visualType,visualQuery:s.visualQuery,overlay:s.overlay||'',callout:s.callout||'',diagramSpec:s.diagramSpec||null}))};}
export function usedAssetIds(v) {return [...new Set([v.assetId,...(v.assetIds||[]),...(v.scenePlan||[]).map(s=>s.assetId)].filter(Boolean))];}
export function visualPublicationIssues(v) {
 const m=v.mediaManifest,issues=[];
 if(!m||m.visualVersion!==VISUAL_VERSION)issues.push('映像設計を含む新しい制作・検査が必要');
 if(!m||m.preview||!m.narrationVerified||!m.audioStream||!['OpenAI TTS','VOICEVOX'].includes(m.narration))issues.push('確認済みAIナレーションが必要');
 if(!m?.mechanicalQa?.passed)issues.push('映像・音声の機械検査が未完了');
 if(!m||![m.duration,m.sceneCount,m.maxSceneDuration,m.meaningfulChanges].every(Number.isFinite)||m.duration<20||m.duration>60.1||m.sceneCount<minimumScenes(m.duration)||m.maxSceneDuration>6||m.meaningfulChanges<minimumScenes(m.duration)-1)issues.push('視覚シーンの変化が不足');
 if(requiresExplanation(v)&&!(m?.explanationCount>=1))issues.push('根拠付き説明図が必要');
 if(v.qa?.visual!=='passed'||!v.visualQa?.passed)issues.push('Shorts映像品質の確認が未完了');
 if(m?.musicEvidence?.selectionStatus==='pending_native_selection')issues.push('YouTube Shortsのサウンド追加が未完了');
 if(m?.musicEvidence?.mode==='licensed'&&(!m.musicEvidence.credit||!m.musicEvidence.licenseUrl||!m.musicEvidence.sourceUrl||!m.musicEvidence.acquiredAt||!m.musicEvidence.rightsCheckedAt||!m.musicEvidence.commercialAllowed||!m.musicEvidence.modificationAllowed||!/^[a-f0-9]{64}$/.test(m.musicEvidence.sha256||'')))issues.push('フリーBGMの権利・クレジット記録が未完了');
 if(m?.generatedImageCount>0&&(!Array.isArray(m.generatedImages)||m.generatedImages.length<m.generatedImageCount||m.generatedImages.some(a=>!a.synthetic||!a.model||!a.prompt||!/^[a-f0-9]{64}$/.test(a.sha256||''))))issues.push('AI生成画像の来歴・整合性が未確認');
 if(usedAssetIds(v).length&&v.qa?.assetRights!=='passed')issues.push('すべての使用素材の権利照合が必要');
 return issues;
}
export function visualReviewPass(q) {return !!(q?.passed===true&&q.safetyConcern===false&&q.factConcern===false&&q.copyrightConcern===false&&Array.isArray(q.issues)&&q.issues.length===0&&VISUAL_SCORES.every(k=>Number.isFinite(q[k])&&q[k]>=65&&q[k]<=100));}
export function normalizeVisualReview(q) {
 if(!q||typeof q!=='object')return q;
 // Accept the legacy model's pipe-separated enum without dropping unknown concerns.
 const issues=Array.isArray(q.issues)?[...new Set(q.issues.flatMap(x=>typeof x==='string'?x.split('|').map(s=>s.trim()).filter(Boolean):['invalid_issue']))]:['invalid_issue'];
 return {...q,issues};
}
export function repairableVisualReview(value) {const q=normalizeVisualReview(value);return q&&q.safetyConcern===false&&q.factConcern===false&&q.copyrightConcern===false&&Array.isArray(q.issues)&&q.issues.length>0&&q.issues.every(x=>['scene_variety','captions','explanation','hook','tempo'].includes(x));}
