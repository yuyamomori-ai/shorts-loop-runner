import {hash} from './providers.mjs';
export function performanceFingerprint(m) {
 return hash(JSON.stringify([m.startDate,m.endDate,m.views,m.engagedViews,m.averageViewPercentage,m.averageViewDuration,m.subscribersGained,m.subscribersLost,m.likes,m.comments,m.shares,m.retention]));
}
// Bounded paid analyses: compare a high-view observation and a lower-view one,
// using completed equal-length windows. Raw lifetime counts are never compared.
export function performanceCandidates(state,limit=2) {
 if(!state.settings.derivedApproved)return [];
 const latest=new Map();
 for(const m of state.live.metrics||[])if(m.origin==='youtube'&&m.complete&&m.windowDays===7&&m.engagedViews>=100&&Number.isFinite(m.views)&&Number.isFinite(m.averageViewPercentage))latest.set(m.videoId,m);
 const eligible=[...latest.values()].filter(m=>{const v=state.live.videos.find(v=>v.id===m.videoId);return v&&!v.synthetic&&v.youtubeId&&v.publicVerifiedAt&&v.lastAnalyzedHash!==performanceFingerprint(m);}).sort((a,b)=>b.views-a.views);
 if(eligible.length<2)return eligible.slice(0,limit);
 return [eligible[0],eligible.at(-1)].slice(0,Math.max(0,Math.min(2,limit)));
}
