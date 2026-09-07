'use client';
import {useState} from 'react';
import {CheckCircle2, Circle, Link2, Pause, RefreshCw, ShieldCheck} from 'lucide-react';
import {automationReadiness} from '../lib/automation.mjs';

export default function AutoLoopPanel({state,caps,busy,act,compact=false,onSetup}:any){
  const [key,setKey]=useState(''),[google,setGoogle]=useState<any>(null),[fileName,setFileName]=useState(''),[inputError,setInputError]=useState('');
  const a=state.automation||{}, readiness=automationReadiness(state,caps);
  const running=!state.settings.paused&&caps.scheduler;
  const attention=a.phase==='attention',userPaused=a.userPaused;
  const label=running?'自動運転中':attention?'確認が必要です':userPaused?'一時停止中':'まだ投稿は始まっていません';
  const save=async()=>{const ok=await act('configureConnections',{...(key?{openaiKey:key}:{}),...(google?{google}:{})},'live');if(ok){setKey('');setGoogle(null);setFileName('');}};
  return <section className="auto-loop panel" aria-label="接続後の自動運転">
    <div className="between"><div><span className="auto-kicker">接続後の自動運転</span><h2>{running?'次の投稿を、自動で進めています。':'YouTubeを接続して、自動運転へ。'}</h2></div><span className={'loop-state '+(running?'running':'')}>{label}</span></div>
    <p className="loop-lead">{state.settings.mode==='review'?'手動承認モードです。動画の制作後、あなたの承認を待ちます。':'準備がそろいYouTubeを許可すると、企画・制作・投稿・結果の分析を繰り返します。開始ボタンや毎回の承認は不要です。'}</p>
    {a.targetEmail&&<p className="target-account">投稿に使うGoogleアカウント <strong>{a.targetEmail}</strong></p>}
    {a.reason&&<p role="status" className="notice">{a.reason}{a.retryAt&&<> 次の再試行: {new Date(a.retryAt).toLocaleString('ja-JP')}</>}</p>}
    <div className="loop-checks">{readiness.checks.map(c=><div key={c.key} className={c.ready?'ready':''}>{c.ready?<CheckCircle2 size={18}/>:<Circle size={18}/>}<span>{c.label}</span><b>{c.ready?'準備済み':'未完了'}</b></div>)}</div>
    {!caps.scheduler&&<p className="loop-blocker">動かし続けるサーバーが未接続です。今はこの画面を開いたままにしても、動画の制作・投稿は動きません。</p>}
    <div className="inline">{caps.oauthConfigured&&!caps.youtube?<a className="primary" href="/api/oauth/start"><Link2 size={17}/>YouTubeと接続</a>:!caps.youtube?<button className="primary" disabled><Link2 size={17}/>YouTube接続の準備待ち</button>:<span className="green-text"><ShieldCheck size={16}/> YouTube接続済み</span>}
      {running&&<button className="secondary" disabled={!!busy} onClick={()=>act('pause',{},'live')}><Pause size={16}/>一時停止</button>}
      {(attention||userPaused)&&caps.scheduler&&<button className="secondary" disabled={!!busy||!readiness.ready} onClick={()=>act('resume',{},'live')}><RefreshCw size={16}/>問題を確認して再開</button>}
      {compact&&<button className="text-button" onClick={onSetup}>接続の準備を確認</button>}
    </div>
    {!compact&&<details className="connection-setup"><summary>初回だけ必要な接続設定</summary><p>Googleのパスワードは入力しません。設定を保存した後、Googleの画面でアクセスを許可します。</p>
      <label>AIの利用キー<input type="password" autoComplete="new-password" value={key} disabled={!caps.scheduler} onChange={e=>setKey(e.target.value)} placeholder={caps.ai?'設定済み・変更するときだけ入力':'AIサービスで発行したキー'}/></label>
      <label>Googleから取得した接続設定ファイル<input type="file" accept="application/json,.json" disabled={!caps.scheduler} onChange={async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>100000)throw Error();setGoogle(JSON.parse(await f.text()));setFileName(f.name);setInputError('');}catch{setInputError('Googleから取得したJSONファイルを選んでください。');}}}/></label>
      {fileName&&<p>{fileName}を保存します。</p>}{inputError&&<p role="alert">{inputError}</p>}
      <button className="secondary" disabled={!!busy||!caps.scheduler||!key&&!google} onClick={save}>接続設定を安全に保存</button>
      <p>接続先の準備が済むと「YouTubeと接続」を押せます。公開投稿にはYouTube API側の利用準備も必要です。</p>
    </details>}
    {!readiness.learningReady&&<p className="loop-footnote">実データからの学習は、YouTubeの分析用追加条件を確認後に有効になります。</p>}
    <p className="loop-footnote">サーバー稼働中は、この画面を閉じても継続します。権利・事実・品質に問題があれば停止します。</p>
  </section>;
}
