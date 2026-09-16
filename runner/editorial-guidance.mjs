// Curated creator guidance, paraphrased from the official written summary of
// Creator Insider's Todd Sherman / Jenny Hoyos interview. Not a view guarantee.
export const CREATOR_GUIDANCE={
 version:1,checkedAt:'2026-09-16',
 title:'YouTube Shorts deep dive: Todd Sherman and Jenny Hoyos',
 sourceUrl:'https://blog.youtube/creator-and-artist-stories/youtube-shorts-deep-dive/',
 publishedAt:'2025-01-28',evidence:'official written summary of a creator lecture; full video not observed',
 lessons:[
  {id:'visual-hook',advice:'最初の1秒から現象や疑問が映像で伝わる。前置きを省き、短い赤い見出しと意味のある動きを同時に出す。'},
  {id:'mini-story',advice:'知識を並べず、一つの身近な問いを小さな物語にする。問い→現象→根拠付き説明→納得できる答え。'},
  {id:'payoff',advice:'フックで約束した疑問には動画内で答える。意外性を作るために事実や数値を誇張しない。'},
  {id:'first-frame',advice:'サムネイルの赤文字に加え、再生直後の画面でも主題が伝わるようにする。サムネイルだけで伸びるとは考えない。'}
 ]
};
export function editorialBrief(state) {
 const lessons=state.settings.productionLearning!==true?[]:state.live.videos
  .filter(v=>!v.synthetic&&v.visualQa&&!v.visualQa.factConcern&&!v.visualQa.copyrightConcern&&!v.visualQa.safetyConcern)
  .sort((a,b)=>Date.parse(b.visualQa.checkedAt||b.createdAt)-Date.parse(a.visualQa.checkedAt||a.createdAt))
  .slice(0,3).map(v=>({videoId:v.id,issues:v.visualQa.issues||[],fix:String(v.visualQa.fix||'').slice(0,700),basis:'our pre-publication visual QA; not audience performance'}));
 return {guidance:CREATOR_GUIDANCE,productionLessons:lessons,performanceLearning:state.settings.derivedApproved?'enabled_after_terms':'pending_additional_terms'};
}
export function editorialPrompt(state) {
 const b=editorialBrief(state);
 return `\n制作ノウハウ=${JSON.stringify(b)}。これは編集の参考で科学的根拠ではない。講師の文章や他動画のセリフ・素材を複製せず、別テーマ・独自台本・自作図解で表現する。自作の品質検査で指摘された改善を一つ具体的に採用する。再生実績がない制作段階の改善を「伸びた理由」や視聴者から学習済みと呼ばない。短い自然なツッコミは1回まで、説明や研究対象を茶化さない。JSONルートに editorialTrial:{guidanceId:"上のlessonのID",adoptedChange:"今回の映像設計で行う具体的変更"}を含める。`;
}
export function normalizeEditorialTrial(value) {
 if(!value||!CREATOR_GUIDANCE.lessons.some(x=>x.id===value.guidanceId)||typeof value.adoptedChange!=='string'||!value.adoptedChange.trim()||value.adoptedChange.length>400)return null;
 return {guidanceId:value.guidanceId,adoptedChange:value.adoptedChange,sourceUrl:CREATOR_GUIDANCE.sourceUrl,version:CREATOR_GUIDANCE.version,basis:'creator guidance; not measured performance'};
}
