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
