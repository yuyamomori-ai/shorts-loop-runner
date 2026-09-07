// Internal channel strategy, enabled for API-derived data only after approval.
export const dayOf=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const rate=(n,d)=>d>0&&n!=null?n/d:null;
const clamp=(n,lo=0,hi=100)=>Math.min(hi,Math.max(lo,n));
export function reward(v,m){
 const entries=[[m.averageViewPercentage,.35],[rate(m.subscribersGained,m.engagedViews)==null?null:clamp(m.subscribersGained/m.engagedViews*10000),.2],[m.likes==null||m.comments==null?null:clamp((m.likes+m.comments)/m.engagedViews*1000),.1],[m.shares==null?null:clamp(m.shares/m.engagedViews*5000),.15],[v.originality?.entertainment??null,.1],[v.productionCostUsd==null?null:100/(1+v.productionCostUsd*1000/m.engagedViews),.05],[m.estimatedRevenue==null||v.productionCostUsd==null?null:clamp(50+(m.estimatedRevenue-v.productionCostUsd)*10),.05]];
 const known=entries.filter(([v])=>v!=null&&Number.isFinite(v));const score=known.reduce((sum,[v,w])=>sum+clamp(v)*w,0)/known.reduce((sum,[,w])=>sum+w,0);
 return score*(1-(v.originality?.copyrightRisk||0)/100)*(1-(v.originality?.reusedRisk||0)/150);
}
export function enrichStrategy(data,settings,isDemo=false){
 const latest=new Map();for(const m of data.metrics)if(m.complete&&m.windowDays===7&&m.engagedViews>=100&&(isDemo?m.origin==='synthetic':m.origin!=='synthetic'))latest.set(m.videoId,m);
 const vs=data.videos.filter(v=>latest.has(v.id)&&!!v.synthetic===isDemo);
 const sample=vs.map(v=>({v,m:latest.get(v.id),reward:reward(v,latest.get(v.id))}));
 const allocations=[];
 for(const dimension of ['contentType','genre','captionStyle','narrationSpeed','editingStyle','weekday']){
  const groups=new Map();for(const x of sample){const k=String(x.v[dimension]??'未記録');if(k==='未記録')continue;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x.reward);}
  const eligible=[...groups].filter(([,a])=>a.length>=5);if(sample.length<12||eligible.length<2)continue;
  const base=mean(sample.map(x=>x.reward));const scored=eligible.map(([value,a])=>({dimension,value,n:a.length,score:(mean(a)*a.length+base*5)/(a.length+5)}));const sum=scored.reduce((s,x)=>s+Math.exp(x.score/20),0);
  for(const x of scored)allocations.push({...x,share:Math.round((.7*Math.exp(x.score/20)/sum+.3/scored.length)*1000)/10});
 }
 data.memory.allocations=allocations;data.memory.objective='維持率・登録・反応・共有・面白さ・制作費・収益の取得済み項目を加重。著作権/再利用リスクは減点。未取得の費用・収益は補完しない。';
 const history=data.memory.paceHistory||[];const lastChange=history.at(-1)?.at;
 const days=[...new Set(vs.filter(v=>v.publishedAt).map(v=>dayOf(v.publishedAt)))].sort();
 let target=settings.dailyLimit,reason='投稿ペースを判断する日数・動画数が不足しています。';
 if(days.length>=14&&(!lastChange||Date.now()-Date.parse(lastChange)>14*86400000)){
  const recentDays=days.slice(-7),previousDays=days.slice(-14,-7);
  const a=sample.filter(x=>previousDays.includes(dayOf(x.v.publishedAt))),b=sample.filter(x=>recentDays.includes(dayOf(x.v.publishedAt)));
  if(a.length>=10&&b.length>=10){
   const summarize=xs=>({views:mean(xs.map(x=>x.m.engagedViews)),retention:mean(xs.map(x=>x.m.averageViewPercentage)),subs:xs.reduce((n,x)=>n+(x.m.subscribersGained||0),0),viewsTotal:xs.reduce((n,x)=>n+x.m.engagedViews,0),reward:mean(xs.map(x=>x.reward))});const p=summarize(a),r=summarize(b);
   const viewsRatio=r.views/Math.max(p.views,1),subsReliable=p.subs>=10&&r.subs>=10,subsRatio=subsReliable?(r.subs/r.viewsTotal)/(p.subs/p.viewsTotal):null;
   if(viewsRatio<.8||r.retention<p.retention-8||(subsReliable&&subsRatio<.8)){target=Math.max(1,Math.floor(target*.75));reason='直近と前期の成熟済み各7日を比較し、実績が悪化したため投稿ペースを下げます。';}
   else if(viewsRatio>1.05&&r.retention>=p.retention-2&&r.reward>p.reward+3&&(!subsReliable||subsRatio>=1)&&!b.some(x=>(x.v.originality?.copyrightRisk||0)>15)){target+=Math.max(1,Math.ceil(target*.34));reason='直近の成績が改善。品質確認・予算・API枠の範囲で、少し投稿を増やして検証します。';}
   else reason='改善・悪化を決める差が不足しているため、投稿ペースを維持します。';
   if(target!==settings.dailyLimit){history.push({at:new Date().toISOString(),from:settings.dailyLimit,to:target,reason});if(settings.adaptivePace&&!isDemo)settings.dailyLimit=target;}
  }
 }
 data.memory.paceHistory=history;data.memory.recommendedDaily=target;data.memory.paceReason=reason;
 const best=data.memory.patterns.filter(p=>p.dimension==='hour'&&p.n>=10&&p.effect>=8).map(p=>p.value);
 data.memory.recommendedTimes=[...new Set([...best,...settings.times])];
 return data.memory;
}
export function chooseAllocation(memory,dimension,fallback,rng=Math.random){const values=(memory.allocations||[]).filter(a=>a.dimension===dimension);if(!values.length)return fallback;let r=rng()*values.reduce((s,x)=>s+x.share,0);for(const x of values){r-=x.share;if(r<=0)return x.value;}return fallback;}
export function slotsForDay(day,count,times,minSpacing=45){
 const minutes=[...new Set(times.map(x=>Number(x.slice(0,2))*60+Number(x.slice(3))))].sort((a,b)=>a-b);const result=[];
 for(const m of minutes){if(result.length>=count)break;if(!result.length||m-result.at(-1)>=minSpacing)result.push(m);}
 for(let m=minutes[0]??720;result.length<count&&m<1440;m+=Math.max(1,minSpacing)){if(result.every(x=>Math.abs(x-m)>=minSpacing))result.push(m);}
 return result.sort((a,b)=>a-b).map(m=>new Date(`${day}T${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}:00+09:00`).toISOString());
}
