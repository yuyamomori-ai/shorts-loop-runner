import {pauseAutomation} from './automation.mjs';
import {enrichStrategy} from './growth.mjs';
import {registerAsset,originalityPass} from './rights.mjs';
import {visualPublicationIssues} from './visual.mjs';
// Pure domain logic shared by the hosted workspace and the autonomous Node runner.
export const SCHEMA_VERSION = 2;
export const GENRES = ['雑学','心理学','人間心理','行動心理学','記憶','科学','脳科学','人体','歴史','習慣','コミュニケーション','動物','自然現象','文化','日常の驚き'];
export const HOOKS = ['question','surprise','challenge'];
export const LABELS = { question:'質問型', surprise:'意外性', challenge:'問いかけ', story:'ストーリー', answer_first:'答えから', experiment:'実験を紹介' };
const clone = x => JSON.parse(JSON.stringify(x));
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function assert(ok, message) { if (!ok) throw new Error(message); }
export const CATALOG = [
 { topic:'retrieval',genre:'記憶',title:'読み直す前に、思い出してみる',hooks:['読むだけで、覚えたつもり？','覚える練習は、思い出すこと。','本を閉じて説明できますか？'],
   lines:['学習では、読むことと、思い出すことは違います。','科学の文章を使った研究では、思い出す練習が、概念図を作る学習より、後のテストで良い成績につながりました。','もちろん、教材や条件が変われば結果も変わります。','読み終えたら、本を閉じて要点を言ってみる。こんな学び方もあります。','次は、注意の意外な仕組みを見てみましょう。'],
   source:{url:'https://pubmed.ncbi.nlm.nih.gov/21252317/',title:'Retrieval practice produces more learning than elaborative studying with concept mapping',publisher:'Karpicke & Blunt / Science (2011)',summary:'科学文章を使った実験で、検索練習が概念地図による精緻化学習を上回った。すべての教材・学習者への保証ではない。'} },
 { topic:'inattention',genre:'心理学',title:'見ているのに、気づかない？',hooks:['目の前でも、見落とす？','見ていることと、気づくこと。','画面の変化に気づけますか？'],
   lines:['何かに集中すると、予想外のものを見落とすことがあります。','シモンズとチャブリスの研究は、動く映像で起こる、不注意による見落としを調べました。','これは、視界に入ったものすべてを、同じように意識できるわけではない、という例です。','ただし、何に注意を向けるかなど、条件で気づき方は変わります。','次は、思い出す練習と記憶の話です。'],
   source:{url:'https://pubmed.ncbi.nlm.nih.gov/10694957/',title:'Gorillas in our midst: sustained inattentional blindness for dynamic events',publisher:'Simons & Chabris / Perception (1999)',summary:'動的な映像での非注意性盲を実験。予期しない出来事への気づきは注意課題などの条件に依存する。'} },
 { topic:'blue-sky',genre:'科学',title:'空が青いのは、空気に理由がある',hooks:['なぜ、空は青い？','空の青には、光の秘密。','空気は透明。では空は？'],
   lines:['太陽の光には、いろいろな色の光が含まれています。','大気中で光が散らばるとき、波長の短い青い光は、赤い光より散らばりやすくなります。','散らばった光が、いろいろな方向から目に届きます。','これが、昼間の空が青く見える主な理由です。','夕方の空も、光の散らばり方と関係があります。'],
   source:{url:'https://spaceplace.nasa.gov/blue-sky/en/',title:'Why Is the Sky Blue?',publisher:'NASA Space Place',summary:'大気分子は短波長の青い光を長波長の赤い光より強く散乱する。'} },
 { topic:'moon',genre:'科学',title:'月も、ちゃんと自転している',hooks:['月は、自転していない？','同じ顔を見せる月の秘密。','月の裏側が見えにくい理由は？'],
   lines:['月は、地球のまわりを回りながら、自分自身も回転しています。','自転と公転にかかる時間がほぼ同じなので、地球からは主に同じ側が見えます。','この状態は、潮汐ロックと呼ばれます。','同じ面が見えることと、自転していないことは、別の話なのです。','身近な宇宙の疑問を、また一つ確かめましょう。'],
   source:{url:'https://science.nasa.gov/moon/tidal-locking/',title:'Tidal Locking',publisher:'NASA Science',summary:'月は自転と公転が同期しており、地球に概ね同じ面を向ける。'} }
];
export function emptyData() { return {videos:[],metrics:[],assets:[],experiments:[],memory:{version:0,patterns:[],summary:'実績が集まるまで、複数の表現を試します。',eligible:0},events:[]}; }
export function initialState() { return {version:SCHEMA_VERSION,settings:{mode:'review',paused:true,dailyLimit:3,adaptivePace:true,minSpacing:45,times:['12:00','18:00','21:00'],timezone:'Asia/Tokyo',privacy:'public',madeForKids:false,derivedApproved:false,publicApproved:false,dailyAiCalls:60},live:emptyData(),demo:emptyData()}; }
export function log(data,type,message) { data.events.unshift({id:uid(),at:now(),type,message}); data.events=data.events.slice(0,200); }
export function bucketDuration(s) { return s<=35?'20–35秒':s<=45?'36–45秒':'46–60秒'; }
function chosen(data,dimension,fallback,rng) { const candidates=data.memory.patterns.filter(p=>p.dimension===dimension&&p.effect>=8&&p.n>=5); return candidates.length&&rng()>=.3?candidates[0].value:fallback; }
export function proposal(data,topic,rng=Math.random) {
 const hook=chosen(data,'hook',HOOKS[Math.floor(rng()*HOOKS.length)],rng);
 const duration=chosen(data,'durationBand','20–35秒',rng)==='46–60秒'?50:chosen(data,'durationBand','20–35秒',rng)==='36–45秒'?40:32;
 const structure=chosen(data,'structure',['story','answer_first','experiment'][Math.floor(rng()*3)],rng);
 const index=Math.max(0,HOOKS.indexOf(hook)); const lines=[...topic.lines]; if(structure==='answer_first'){const answer=lines.splice(-2,1)[0];lines.unshift(answer);} const text=[topic.hooks[index],...lines];
 return {id:uid(),contentType:'A',captionStyle:'bold',narrationSpeed:1.08,editingStyle:'kinetic',editingMethods:['captions','bgm','sfx'],productionCostUsd:null,tags:[],publishAt:null,topic:topic.topic,title:topic.title,genre:topic.genre,hook,structure,duration,durationBand:bucketDuration(duration),hour:chosen(data,'hour','21:00',rng),segments:text.map((text,i)=>({text,role:i===0?'hook':i===text.length-1?'cta':i===text.length-2?'answer':'body',sourceIds:i===0||i===text.length-1?[]:['s1']})),sources:[{id:'s1',...topic.source,checkedAt:'2026-09-07T00:00:00Z',status:'editorial_reference'}],status:'draft',createdAt:now(),synthetic:false,privacy:'public',description:'',containsSyntheticMedia:false,madeForKids:false,qa:{facts:'reference',rights:'original',technical:'pending',visual:'pending'},strategyVersion:data.memory.version,planningReason:data.memory.eligible>=12?`戦略 v${data.memory.version} を参照。30%は未検証の表現を探索。`:'初期の探索企画。過去の実績はまだ不足しています。',revision:1};
}
export function plan(data,count=3,rng=Math.random) {
 assert(Number.isSafeInteger(count)&&count>=1,'企画数は1以上の整数です。');
 let available=CATALOG.filter(t=>!data.videos.some(v=>v.topic===t.topic));
 const g=chosen(data,'genre','',rng); available.sort((a,b)=>Number(b.genre===g)-Number(a.genre===g));
 assert(available.length,'確認済み企画を使い切りました。実行アプリでAI企画を生成できます。');
 for(const t of available.slice(0,count)) data.videos.unshift(proposal(data,t,rng));
 log(data,'plan',`${Math.min(count,available.length)}件の出典付き企画を作成しました。`);
}
const bounded = (v,min,max) => Math.min(max,Math.max(min,v));
export function validateMetric(m,data) {
 assert(data.videos.some(v=>v.id===m.videoId),'対象動画が見つかりません。');
 assert(['youtube','studio_csv','synthetic'].includes(m.origin),'データの出所が必要です。');
 assert(m.windowDays===7&&m.complete===true,'比較には確定済みの7集計日が必要です。');
 for(const key of ['views','engagedViews','likes','comments','shares','subscribersGained','averageViewDuration','averageViewPercentage']) assert(m[key]===null||m[key]===undefined||typeof m[key]==='number'&&Number.isFinite(m[key])&&m[key]>=0,`${key} は0以上の数値または未取得です。`);
 assert(m.engagedViews>0,'engagedViews が必要です。');
 assert(m.retention===undefined||Array.isArray(m.retention)&&m.retention.every(p=>Number.isFinite(p.ratio)&&p.ratio>0&&p.ratio<=1&&Number.isFinite(p.watch)&&p.watch>=0),'維持率の形式が不正です。');
}
export function scores(v,m) {
 const e=m.engagedViews; const at=(m.retention||[]).find(p=>p.ratio*v.duration>=3);
 const result={hook:at?bounded(at.watch*100,0,100):null,retention:m.averageViewPercentage==null?null:bounded(m.averageViewPercentage,0,100),information:v.qa.facts==='passed'?100:null,engagement:m.likes==null||m.comments==null?null:bounded((m.likes+m.comments)/e*1000,0,100),shareability:m.shares==null?null:bounded(m.shares/e*5000,0,100),subscriber:m.subscribersGained==null?null:bounded(m.subscribersGained/e*10000,0,100)};
 const weights={hook:.2,retention:.35,information:.1,engagement:.15,shareability:.1,subscriber:.1}; let sum=0,w=0;
 for(const [k,v] of Object.entries(result)) if(v!==null){sum+=v*weights[k];w+=weights[k];}
 return {...result,entertainment:v.originality?.entertainment??null,overall:w?Math.round(sum/w):null,coverage:Math.round(w*100),method:'internal-v1: 欠損は除外。固定尺度の独自評価。Google/YouTube提供値ではありません。'};
}
export function learn(data,approved=false,isDemo=false) {
 assert(isDemo||approved,'YouTube API由来の独自分析は、追加条件の承認後に有効にできます。');
 // One authoritative 7-day observation per video. No accumulating cumulative snapshots.
 const latest=new Map(); for(const m of data.metrics){if(m.windowDays===7&&m.complete&&m.engagedViews>=100&&(isDemo?m.origin==='synthetic':m.origin!=='synthetic')&&m.averageViewPercentage!=null)latest.set(m.videoId,m);}
 const eligible=data.videos.filter(v=>latest.has(v.id)&&v.synthetic===isDemo);
 const average=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
 const baseline=eligible.length?average(eligible.map(v=>latest.get(v.id).averageViewPercentage)):0;
 let patterns=[];
 if(eligible.length>=12) for(const dimension of ['genre','hook','durationBand','structure','hour']) {
   const groups=new Map(); for(const v of eligible){const key=String(v[dimension]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(latest.get(v.id).averageViewPercentage);}
   for(const [value,values] of groups){if(values.length<5)continue;const mean=average(values);const shrunk=(mean*values.length+baseline*5)/(values.length+5);const variance=average(values.map(x=>(x-mean)**2));patterns.push({dimension,value,n:values.length,mean:Math.round(mean*10)/10,effect:Math.round((shrunk-baseline)*10)/10,uncertainty:Math.round(1.96*Math.sqrt(Math.max(variance,25)/values.length)*10)/10,confidence:values.length<10?'暫定':'観察傾向'});}
 }
 patterns.sort((a,b)=>b.effect-a.effect);
 const previousPace=data.memory.paceHistory||[];
 const latestLearnings=data.videos.filter(v=>v.aiAnalysis).slice(0,15).map(v=>({videoId:v.id,genre:v.genre,contentType:v.contentType,nextChange:v.aiAnalysis.nextChange}));
 data.memory={paceHistory:previousPace,latestLearnings,version:data.memory.version+1,updatedAt:now(),eligible:eligible.length,baseline,patterns,summary:eligible.length<12?`同じ7日間で比較できる動画は${eligible.length}本。12本までは探索を続けます。`:`${eligible.length}本の7日間を比較。テーマなどの交絡があるため、成功・失敗の理由は仮説です。`,exploration:.3};
 for(const v of eligible){const m=latest.get(v.id);v.scores=scores(v,m);v.analysis=`平均視聴割合 ${m.averageViewPercentage}%（比較基準 ${baseline.toFixed(1)}%）。${m.averageViewPercentage>=baseline?'この組み合わせを別テーマで検証する価値があります。':'冒頭と説明の長さを、一要因ずつ見直す候補です。'} 原因の確定ではありません。`;}
 log(data,'learn',`戦略 v${data.memory.version} を保存。比較可能な動画 ${eligible.length}本。`);
 return data.memory;
}
export function demoData() {
 const data=emptyData();
 for(let i=0;i<24;i++){
 const t=CATALOG[i%4],v=proposal(data,t,()=>.1);v.id=`demo-${i}`;v.title=`検証 ${String(i+1).padStart(2,'0')} · ${t.title}`;v.topic=`demo-${i}`;v.synthetic=true;v.contentType=i%3?'A':'B';v.captionStyle=i%2?'bold':'clean';v.narrationSpeed=i%2?1.08:1;v.editingStyle=i%2?'kinetic':'replay';v.weekday=String(i%7);v.originality={originality:85,commentary:82,editing:78,educational:75,entertainment:80,copyrightRisk:0,reusedRisk:10,confidence:.95};v.status='published';v.hook=i%2?'surprise':'question';v.duration=i%3?32:50;v.durationBand=bucketDuration(v.duration);v.structure=i%2?'story':'experiment';v.hour=i%2?'18:00':'21:00';v.qa.facts='passed';v.publishedAt=new Date(Date.now()-(30+i)*86400000).toISOString();data.videos.push(v);
 const a=(i%2?61:88)+(i%5)-2;
 data.metrics.push({id:uid(),videoId:v.id,origin:'synthetic',windowDays:7,complete:true,views:1800+i*101,engagedViews:1000+i*51,likes:50+i,comments:4+i%5,shares:10+i,subscribersGained:3+i%4,averageViewDuration:v.duration*a/100,averageViewPercentage:a,retention:[{ratio:.05,watch:.96},{ratio:.1,watch:a/100+.07},{ratio:.5,watch:a/100},{ratio:1,watch:a/100-.15}],fetchedAt:now()});
 }
 learn(data,true,true);log(data,'info','すべて検証用の架空データです。実チャンネルには使用しません。');return data;
}
export function blockers(v,automatic=false) {
 const reasons=[];
 if(v.validationOnly)reasons.push('受入テスト動画は投稿できません');
 reasons.push(...visualPublicationIssues(v));
 if(v.synthetic)reasons.push('検証用動画は投稿できません');
 if(v.qa?.facts!=='passed')reasons.push('情報源と台本の照合が未完了');
 if(v.qa?.rights!=='passed')reasons.push('素材の利用権が未確認');
 if(v.qa?.technical!=='passed'||!v.videoFile)reasons.push('動画の生成・技術検査が未完了');
 if(automatic&&v.qa?.visual!=='passed')reasons.push('映像・字幕のAI確認が未完了');
 if(!originalityPass(v.originality))reasons.push('独自性・再利用リスクの審査が未完了');
 if(v.qa?.visual==='failed')reasons.push('映像確認で問題を検出');
 if(v.contentType==='B'&&v.qa?.assetRights!=='passed')reasons.push('使用映像の権利照合が未完了');
 if(v.risk)reasons.push(v.risk);
 return reasons;
}
export function digestable(v) { return JSON.stringify([v.title,v.description,v.privacy,v.madeForKids,v.containsSyntheticMedia,v.tags,v.publishAt,v.segments,v.videoHash,v.revision,v.assetId,v.assetIds,v.segmentAssets,v.scenePlan,v.mediaManifest,v.verifiedContentHash]); }
export function applyAction(state,action,payload={},dataset='live') {
 assert(['live','demo'].includes(dataset),'データセットが不正です。');const data=state[dataset];
 if(action==='demo'){state.demo=demoData();enrichStrategy(state.demo,state.settings,true);return;}
 if(action==='plan'){assert(payload.contentType!=='B','TYPE Bの制作は実行アプリで素材とAIを接続してから利用できます。');plan(data,payload.count??3);return;}
 if(action==='learn'){learn(data,state.settings.derivedApproved,dataset==='demo');enrichStrategy(data,state.settings,dataset==='demo');return;}
 if(action==='settings'){
   const p=payload; assert(['review','auto'].includes(p.mode),'承認モードが不正です。');assert(Number.isSafeInteger(p.dailyLimit)&&p.dailyLimit>=1,'目安本数は1以上の整数にしてください。');
   assert(Array.isArray(p.times)&&p.times.length>0&&new Set(p.times).size===p.times.length&&p.times.every(x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x)),'候補時刻を重複なく入力してください。');
   assert(['private','unlisted','public'].includes(p.privacy),'公開範囲が不正です。');
   Object.assign(state.settings,{mode:p.mode,dailyLimit:p.dailyLimit,adaptivePace:p.adaptivePace!==false,minSpacing:Math.max(1,Number(p.minSpacing)||45),times:[...p.times].sort(),privacy:p.privacy,madeForKids:!!p.madeForKids});log(state.live,'settings','投稿設定を保存しました。');return;
 }
 if(action==='registerAsset'){registerAsset(data,payload);log(data,'asset','権利記録を保存しました。映像ファイルを登録してください。');return;}
 if(action==='pause'){pauseAutomation(state,'一時停止中です。',true);log(state.live,'stop','自動運転を停止しました。');return;}
 if(action==='importMetrics'){
   assert(Array.isArray(payload.rows)&&payload.rows.length<=1000,'指標は1000件以下の配列で読み込んでください。');
   for(const row of payload.rows){validateMetric(row,data);assert(dataset==='demo'?row.origin==='synthetic':row.origin!=='synthetic','検証データと実データは混在できません。');}
   for(const row of payload.rows){data.metrics=data.metrics.filter(x=>!(x.videoId===row.videoId&&x.windowDays===row.windowDays));data.metrics.push({...row,id:uid(),fetchedAt:now()});}log(data,'metrics',`${payload.rows.length}本の指標を保存しました。`);return;
 }
 const v=data.videos.find(v=>v.id===payload.id);
 if(['edit','approve','reject'].includes(action))assert(v,'動画が見つかりません。');
 if(action==='edit'){
   assert(['draft','blocked','review','approved'].includes(v.status),'この状態の動画は編集できません。');
   assert(typeof payload.title==='string'&&payload.title.trim().length>0&&payload.title.length<=100&&!/[<>]/.test(payload.title),'タイトルは1〜100文字で、山かっこは使えません。');
   assert(typeof payload.description==='string'&&new TextEncoder().encode(payload.description).length<=4000&&!/[<>]/.test(payload.description),'説明は4000バイト以内で入力してください（出典追記分を確保）。');
   assert(['private','unlisted','public'].includes(payload.privacy),'公開範囲が不正です。');
   if(v.title!==payload.title||v.description!==payload.description){v.qa.facts='pending';}
   assert(!payload.publishAt||Number.isFinite(Date.parse(payload.publishAt))&&Date.parse(payload.publishAt)>Date.now()+60000,'予約日時は1分以上先に設定してください。');
   assert(!payload.tags||Array.isArray(payload.tags)&&payload.tags.every(t=>typeof t==='string'&&!/[<>]/.test(t))&&payload.tags.join(',').length<=450,'タグは合計450文字以内です。');
   Object.assign(v,{tags:payload.tags||[],publishAt:payload.publishAt||null,title:payload.title,description:payload.description,privacy:payload.privacy,madeForKids:!!payload.madeForKids,containsSyntheticMedia:!!payload.containsSyntheticMedia,status:v.videoFile?'review':'draft',revision:v.revision+1,approvedRevision:null});log(data,'edit','投稿内容を更新。承認を解除しました。');return;
 }
 if(action==='approve'){assert(blockers(v).length===0,blockers(v).join(' / '));assert(v.status==='review','確認待ちの動画のみ承認できます。');v.status='approved';v.approvedRevision=v.revision;v.approvedAt=now();v.approvedDigest=digestable(v);log(data,'approve',`「${v.title}」を承認しました。`);return;}
 if(action==='reject'){v.status='rejected';log(data,'reject',`「${v.title}」を見送りました。`);return;}
 if(action==='experiment'){
   assert(['hook','durationBand','structure'].includes(payload.dimension),'比較する要因を選んでください。');
   const options={hook:['question','surprise'],durationBand:['20–35秒','46–60秒'],structure:['story','answer_first']};
   data.experiments.unshift({id:uid(),dimension:payload.dimension,arms:options[payload.dimension],createdAt:now(),assignments:[],status:'collecting',note:'異なる新規テーマへ交互に割付。観察比較であり、同一視聴者を無作為に分けるA/Bではありません。'});log(data,'experiment','比較計画を保存しました。新規AI企画に一要因ずつ割り付けます。');return;
 }
 if(action==='deleteApiData'){if(dataset==='live')delete state.benchmarkLibrary;for(const v of data.videos)delete v.benchmarkTrial;data.metrics=[];data.memory=emptyData().memory;for(const v of data.videos){for(const key of ['scores','analysis','aiAnalysis','lastAnalyzedHash','dropPoints','youtubeId','actualPrivacy'])delete v[key];}if(dataset==='live'){delete state.channel;delete state.lastSync;}data.experiments=[];log(data,'delete','取得指標と派生分析を削除しました。自作の企画・台本は残ります。');return;}
 throw new Error('この操作は実行アプリで利用できます。');
}

export function migrateState(s){s.version=SCHEMA_VERSION;s.settings.adaptivePace??=true;s.settings.minSpacing??=45;for(const d of [s.live,s.demo]){d.assets??=[];for(const v of d.videos){v.contentType??='A';v.captionStyle??='bold';v.narrationSpeed??=1.08;v.editingStyle??='kinetic';v.editingMethods??=['captions','bgm','sfx'];v.tags??=[];v.publishAt??=null;}}return s;}
