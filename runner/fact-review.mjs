export const FACT_REVIEW_INSTRUCTIONS='すべての主張・疑問の前提・図の事実性を検証する。純粋な疑問やCTAは新しい事実を断定していない場合のみclaimType=non_assertiveとし、supported=true（裏付けが不要なため）とする。単に疑問符があるだけでは検証を免除しない。例えば「なぜ全員が失敗する？」は全員という未確認の前提を含む。疑問やCTAでもoverlay/callout/diagramSpecにある事実は必ず検証しvisualSupportedを判定。裏付けのない事実・因果・一般化はsupported=false。non_assertiveを不明・不合格の代用にしない。allSupportedとallVisualsSupportedは個別判定の論理積。';
const bool={type:'boolean'},str={type:'string'};
export const FACT_REVIEW_SCHEMA={type:'object',additionalProperties:false,required:['allSupported','allVisualsSupported','highRisk','checks'],properties:{
 allSupported:bool,allVisualsSupported:bool,highRisk:bool,
 checks:{type:'array',items:{type:'object',additionalProperties:false,required:['index','claimType','supported','visualSupported','sourceIds','reason'],properties:{index:{type:'integer'},claimType:{type:'string',enum:['assertion','non_assertive']},supported:bool,visualSupported:bool,sourceIds:{type:'array',items:str},reason:str}}}
}};
export function factReviewPass(v,q){
 if(q?.allSupported!==true||q?.allVisualsSupported!==true||q?.highRisk!==false||!Array.isArray(q.checks)||q.checks.length!==v.segments.length)return false;
 return v.segments.every((segment,index)=>{
  const rows=q.checks.filter(c=>c.index===index);if(rows.length!==1)return false;
  const c=rows[0];return c.supported===true&&c.visualSupported===true&&['assertion','non_assertive'].includes(c.claimType)&&Array.isArray(c.sourceIds)&&(c.claimType==='non_assertive'||c.sourceIds.length>0)&&c.sourceIds.every(id=>(segment.sourceIds||[]).includes(id)&&(v.sources.some(s=>s.id===id)||id==='asset'&&!!v.assetId));
 });
}

export const UNVERIFIED_FACT_RISK='出典と台本の照合で未確認の情報があります。';
export function canRepairVisualFacts(v,q=v?.factCheck){
 if(!v||v.youtubeId||v.uploadIntent||v.uploadSession||v.risk&&v.risk!==UNVERIFIED_FACT_RISK||(v.visualFactRepairs||0)>=2||v.qa?.assetRights==='failed'||v.visualQa?.safetyConcern||v.visualQa?.copyrightConcern)return false;
 if(q?.allSupported!==true||q?.allVisualsSupported!==false||q?.highRisk!==false||!Array.isArray(q.checks)||q.checks.length!==v.segments.length)return false;
 const registered=new Set(v.sources.map(s=>s.id));if(v.assetId)registered.add('asset');
 let failed=0;
 for(let index=0;index<v.segments.length;index++){
  const rows=q.checks.filter(c=>c.index===index);if(rows.length!==1)return false;
  const c=rows[0],s=v.segments[index];
  if(c.supported!==true||!['assertion','non_assertive'].includes(c.claimType)||!Array.isArray(c.sourceIds)||c.sourceIds.some(id=>!registered.has(id))||c.claimType==='assertion'&&!c.sourceIds.length)return false;
  if(c.visualSupported===false){if(!s.diagramSpec)return false;failed++;}
  else if(c.visualSupported!==true)return false;
 }
 return failed>0;
}

export function diagramRepairSchema(indices,sourceIds){
 const diagram={type:'object',additionalProperties:false,required:['type','labels','sourceIds','caption'],properties:{type:{type:'string',enum:['concept','comparison','process']},labels:{type:'array',minItems:2,maxItems:3,items:{type:'string',maxLength:14}},sourceIds:{type:'array',minItems:1,items:{type:'string',enum:sourceIds}},caption:{type:'string',maxLength:28}}};
 return {type:'object',additionalProperties:false,required:['visuals'],properties:{visuals:{type:'array',minItems:indices.length,maxItems:indices.length,items:{type:'object',additionalProperties:false,required:['index','visualType','overlay','callout','diagramSpec'],properties:{index:{type:'integer',enum:indices},visualType:{type:'string',enum:['diagram','comparison','science_card']},overlay:{type:'string',maxLength:18},callout:{type:'string',maxLength:18},diagramSpec:{anyOf:[diagram,{type:'null'}]}}}}}};
}
