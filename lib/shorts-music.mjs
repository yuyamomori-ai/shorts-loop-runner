// Observed in the official Japan Shorts chart, not general music-video views.
// This dated snapshot is deliberately not described as a live data feed.
export const SHORTS_CHART = {
 country:'JP',kind:'shorts-daily',chartDate:'2026-09-13',observedAt:'2026-09-16',
 sourceUrl:'https://charts.youtube.com/charts/TopShortsSongs/jp/daily',
 metric:'rank_by_number_of_Shorts_using_song',refresh:'manual_verified_snapshot',
 tracks:[
  {rank:1,title:'Cool ( That Or That ) (Best Part Looped + Viral Version)',artist:'easethepain'},
  {rank:2,title:'3:03 PM',artist:'しゃろう'},
  {rank:3,title:'blue',artist:'yung kai'},
  {rank:4,title:'Made My Night',artist:'LE SSERAFIM'},
  {rank:5,title:'エアロピクルス',artist:'コメアニメ'},
  {rank:6,title:'将棋一番！ (feat. 歌愛ユキ)',artist:'ゆこぴ'},
  {rank:7,title:'Raya (Slowed)',artist:'Zericxxn'},
  {rank:8,title:'分かっちゃいないね (feat. 花隈千冬)',artist:'monet'},
  {rank:9,title:'うさぎラップ (リズム感のある者たちver.)',artist:'小澤亜李 , Momonga(CV:Iguchi Yuka) , Mermaid(CV:Oki Saeko) & Mermaid(CV:Nanase Ayaka)'},
  {rank:10,title:'GG EZ',artist:'M.Sasuke'},
 ],
};
const defaults=[{title:'怪物',artist:'YOASOBI'},{title:'好きすぎて滅！',artist:'M!LK'}];
export function normalizeTrack(x){
 if(!x||typeof x.title!=='string'||!x.title.trim()||x.title.length>150||typeof (x.artist??'')!=='string'||(x.artist||'').length>180||/[<>\u0000-\u001f]/.test(x.title+(x.artist||'')))throw Error('曲名・アーティスト名を確認してください。');
 return {title:x.title.trim(),artist:(x.artist||'').trim()};
}
const key=t=>t.title+'\n'+t.artist;
export function musicPreferences(value={}){
 if(!['auto','fixed',undefined].includes(value.selection))throw Error('選曲方法が不正です。');
 const tracks=value.tracks??defaults;
 if(!Array.isArray(tracks)||!tracks.length||tracks.length>12)throw Error('希望曲は1〜12曲にしてください。');
 const normalized=tracks.map(normalizeTrack);
 return {selection:value.selection||'auto',tracks:[...new Map(normalized.map(t=>[key(t),t])).values()]};
}
export function musicCatalog(at=Date.now()){
 const age=Number(at)-Date.parse(SHORTS_CHART.chartDate+'T00:00:00+09:00');
 return {...SHORTS_CHART,fresh:age>=0&&age<=7*86400000,tracks:SHORTS_CHART.tracks.map(t=>({...t})),availability:'check_in_YouTube_app',nativeApiSupported:false};
}
export function selectMusic(v,preferences={},at=Date.now()){
 const prefs=musicPreferences(preferences),catalog=musicCatalog(at),text=(v.segments||[]).map(s=>s.text||'').join('');
 const intent=/心理|記憶|科学|実験|研究|仕組み|警告/.test((v.genre||'')+text)?'説明を聞き取りやすく':/えっ|まさか|ツッコミ|ほんと/.test(text)?'短いリアクションに合わせる':'冒頭の動きに合わせる';
 const forced=v.requestedTrack?normalizeTrack(v.requestedTrack):prefs.selection==='fixed'?prefs.tracks[0]:null;
 // Editorial matching is an explicit hypothesis, not a measured retention effect.
 const preferredTitle=intent==='説明を聞き取りやすく'?'3:03 PM':'Cool ( That Or That ) (Best Part Looped + Viral Version)';
 const fit=catalog.fresh&&catalog.tracks.find(t=>t.title===preferredTitle);
 const candidate=forced||fit||prefs.tracks[0];
 const match=catalog.fresh&&catalog.tracks.find(t=>key(t)===key(candidate));
 return {track:normalizeTrack(candidate),intent,selection:forced?'owner':'automatic-candidate',status:'pending_native_selection',
  reason:forced?'指定された希望曲です。':fit?'日本のShorts公式ランキングを参考にした候補です。曲と内容の相性は編集上の推定です。':catalog.fresh?'内容に合う候補を確認できないため、希望曲を候補にしています。試聴して相性を確認してください。':'ランキングの確認期限を過ぎたため希望曲を候補にしています。現在の人気は未確認です。',
  chart:match?{country:catalog.country,kind:catalog.kind,rank:match.rank,chartDate:catalog.chartDate,sourceUrl:catalog.sourceUrl,metric:catalog.metric}:null,
  selectedAt:new Date(at).toISOString(),nativeAvailabilityVerified:false,attached:false,automaticAttachmentSupported:false};
}
