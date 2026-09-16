'use client';
import {useState} from 'react';
import {musicPreferences} from '../lib/shorts-music.mjs';
import {originalityPass} from '../lib/rights.mjs';

export default function MusicPanel({state,caps,act,busy,video}:any){
 const prefs=musicPreferences(state.settings.music),catalog=caps.musicCatalog;
 const candidates=[...new Map([...(catalog?.fresh?catalog.tracks:[]),...prefs.tracks].map((t:any)=>[t.title+' / '+t.artist,t])).values()] as any[];
 const [selection,setSelection]=useState(prefs.selection),[title,setTitle]=useState(video?.musicChoice?.track?.title||prefs.tracks[0].title),[artist,setArtist]=useState(video?.musicChoice?.track?.artist||prefs.tracks[0].artist);
 const [copyStatus,setCopyStatus]=useState('');
 const description=[video?.description,'出典:',...(video?.sources||[]).map((s:any)=>`${s.title}\n${s.url}`),'音声はAI合成です。図解・効果音はShortLOOPで制作。','#Shorts'].filter(Boolean).join('\n\n');
 const choice=video?.musicChoice;
 const ready=video?.videoFile&&video?.qa?.facts==='passed'&&video?.qa?.rights==='passed'&&video?.qa?.technical==='passed'&&video?.qa?.visual==='passed'&&originalityPass(video.originality)&&!video.risk&&!video.youtubeId;
 const save=()=>video?act('selectMusic',{id:video.id,track:{title,artist}},'live'):act('musicSettings',{selection,tracks:[{title,artist},...prefs.tracks.filter((t:any)=>t.title!==title||t.artist!==artist)].slice(0,12)},'live');
 return <section className="panel" aria-label="Shortsの選曲">
  <h2>{video?'この動画の希望曲':'Shortsの選曲設定'}</h2>
  <p>候補を選んで保存できます。YouTubeの「サウンドを追加」で音源を付ける工程は、現在はスマホアプリで行います。</p>
  {!video&&<label>選曲方法<select value={selection} onChange={e=>setSelection(e.target.value)}><option value="auto">内容と確認済みランキングから候補を選ぶ</option><option value="fixed">指定曲を候補にする</option></select></label>}
  <label>候補から選ぶ<select value={candidates.findIndex(t=>t.title===title&&t.artist===artist)} onChange={e=>{const t=candidates[Number(e.target.value)];if(t){setTitle(t.title);setArtist(t.artist);}}}><option value={-1}>曲名を入力</option>{candidates.map((t,i)=><option key={i} value={i}>{t.rank?`${t.rank}位 · `:''}{t.title} / {t.artist}</option>)}</select></label>
  <label>曲名<input value={title} maxLength={150} onChange={e=>setTitle(e.target.value)}/></label>
  <label>アーティスト<input value={artist} maxLength={180} onChange={e=>setArtist(e.target.value)}/></label>
  <button className="secondary" disabled={!!busy||!title.trim()||!!video?.youtubeId} onClick={save}>希望曲を保存</button>
  {choice&&<div className="notice"><strong>選曲候補：{choice.track.title} / {choice.track.artist}</strong><p>{choice.intent} · 音源は未追加</p><p>{choice.reason}</p>{choice.chart&&<p>日本のShorts・{choice.chart.chartDate}付 {choice.chart.rank}位（使用された動画本数に基づく順位）</p>}</div>}
  {catalog&&<p className="muted">日本の公式Shortsランキング：{catalog.chartDate}付・上位10曲を確認。{catalog.fresh?'この期間の順位を候補選びに使用します。':'確認期限を過ぎたため、自動選曲には使用していません。'} 自動更新は未接続です。 <a href={catalog.sourceUrl} target="_blank" rel="noreferrer">公式ランキングを見る</a></p>}
  {video&&caps.musicMode==='shorts-library'&&<div className="notice"><strong>音源追加待ち</strong><p>動画を保存 → YouTubeでショートを作成 →「サウンドを追加」で曲と使用範囲を選択 → 全体公開。曲の利用可否・長さはアプリの表示を確認してください。</p>{ready?<><a className="primary" href={`/api/media/${video.id}?download=1`} download>音源追加用の動画を保存</a><label>投稿用の説明文（出典付き）<textarea readOnly rows={5} value={description}/></label><button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(description);setCopyStatus('説明文をコピーしました。YouTubeの説明欄に貼り付けてください。');}catch{setCopyStatus('上の説明文を選択してコピーしてください。');}}}>説明文をコピー</button><p role="status">{copyStatus}</p></>:<p>動画の品質検査に合格すると保存できます。</p>}</div>}
 </section>;
}
