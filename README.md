# Shorts Loop MVP 0.2

日本語の雑学・知識・心理学動画（TYPE A）と、権利確認済みの映像に独自解説を加える動画（TYPE B）を運用する実装です。企画、根拠照合、ナレーション、1080×1920 MP4、承認、YouTube送信・予約、指標取得、分析、次回への反映をつなぎます。

**v0.2.2の追加:** 小容量サーバー向けにFFmpegの並列数を制御し、完成後の制作中間ファイルを整理します。環境設定で公開確認済み動画のローカル保存時間・合計容量を指定できます。未投稿動画・台本・出典・学習データ・入力素材は対象外です。

**v0.2.1の追加:** Google認可が完了すると、追加の開始操作なしに運転を始める設定に対応しました。指定アカウントをGoogleの応答で確認し、再起動後も運転・一時停止・安全停止を保持します。一時的な通信エラーとAI日次予算は待機後に再試行します。

**すぐ試せる範囲:** キーなしでも管理画面・出典付き企画・検証データの学習・字幕プレビューを実行できます。実際のAI生成・日本語ナレーション・YouTube投稿には、利用者のAPI設定とGoogle OAuth認可が必要です。認証情報は同梱していません。掲載した指標の検証データは架空で、本番の学習・投稿には混ぜません。

## 起動（Windows / Docker）

1. ZIPを展開し、Docker Desktopを起動します。
2. `.env.example` を `.env` にコピーします（`start-windows.cmd` でも自動作成）。
3. `start-windows.cmd` を実行します。初回はNode・FFmpeg・日本語フォントを含むイメージを作ります。
4. `http://localhost:8787` を開きます。
5. 右上の「検証データ」を選び、分析・記憶の更新と企画への反映を試します。

起動後は `docker compose up -d`、停止は `docker compose down`。PCの電源が切れている間は実行できません。常時運転する場合はDockerが動くサーバーへ配置してください。ブラウザを閉じても、実行アプリが動いていれば定期処理は続きます。初期状態では自動運転を停止しています。

Dockerのホスト公開先は **127.0.0.1:8787のみ**。Composeはこの前提でコンテナへのローカル接続を受け入れます。公開HTTPS接続に切り替える場合は後述の外部接続設定を使用してください。

### Dockerを使わない場合

Node.js **24以上**、FFmpeg、ffprobe、日本語フォントが必要です。配布ZIPの `local-dist` はビルド済みなので、サーバー起動にnpmインストールは不要です。

```bash
node runner/server.mjs
```

画面のソースを編集するときだけ依存をインストールし、`npm run build:local` で再ビルドします。Linuxは `fonts-noto-cjk` と `fontconfig` を使用。Windowsで既存の日本語フォントを使う場合は `CAPTION_FONT` を設定し、生成結果を目視確認したうえで `CAPTION_FONT_VERIFIED=true` にします。未確認のフォントで日本語動画を本番投稿させません。

## Google OAuth 2.0でYouTubeを接続

メールアドレス・パスワードを入力させる機能はありません。

1. Google Cloudでプロジェクトを作成し、YouTube Data API v3とYouTube Analytics APIを有効にします。
2. OAuth同意画面を設定し、自分をテストユーザーへ追加します。
3. ローカル運用では「デスクトップアプリ」のOAuthクライアントを作成します。
4. ダウンロードしたJSONを `data/client_secret.json` として保存します。公開サーバーへ置く場合はアクセス制限を設定します。
5. 設定画面の **「YouTubeと接続」** を開き、運用するGoogleアカウント・YouTubeチャンネルで認可します。
6. 接続後にチャンネル名・公式統計・直近50件の投稿を確認します。

既存のCLI手順 `node runner/oauth.mjs` も使えます。OAuthをブラウザで完了できる自分のPCで実行してください。`state`、PKCE、10分の有効期間、一度限りのコード処理を実装しています。

要求スコープは `youtube.force-ssl` と `yt-analytics.readonly`。前者はアップロードと、既存非公開動画の予約設定に必要な更新APIのためです。任意で `YOUTUBE_REVENUE_SCOPE=true` にすると `yt-analytics-monetary.readonly` を追加します。既存の認可にスコープを追加する際は再接続が必要です。

更新トークンはAES-256-GCMで暗号化して `data/youtube-token.json` に保存します。既存の平文トークンは読込時に暗号化へ移行。ローカル暗号鍵は権限0600の別ファイル、または環境変数 `TOKEN_ENCRYPTION_KEY` の32バイトBase64値を使用します。外部運用では環境変数/Secret管理を推奨。コード・画面・バックアップ・ログにキーやトークンを返しません。データフォルダと環境設定はGit対象外です。

GoogleのOAuthアプリがTesting状態の場合、YouTube権限を含む更新トークンに7日間の有効期限が適用される場合があります。継続運用にはアプリの公開・審査状態の確認が必要です。[OAuth公式ガイド](https://developers.google.com/identity/protocols/oauth2)

## AI・ナレーション・素材を設定

`.env` の `OPENAI_API_KEY` を設定して実行アプリを再起動します。Responses APIのWeb検索で一次資料を探し、取得できた本文と台本を別の呼び出しで照合します。モデルは `OPENAI_MODEL`、TTSモデル・声は `OPENAI_TTS_MODEL` / `OPENAI_VOICE` で変更できます。

OpenAI TTSではAI音声であることを説明に追加します。VOICEVOXを使う場合は `VOICEVOX_URL`、話者ID、必要なクレジット、`VOICEVOX_RIGHTS_CONFIRMED=true` を設定します。選択した音声ライブラリの商用利用条件を利用者が確認してください。VOICEVOX本体はこのComposeには含めていません。

APIは従量課金です。ChatGPT契約とは別のAPI設定になります。デフォルトの `DAILY_AI_CALLS=60` は費用暴走を避ける呼び出し予算で、投稿本数の固定上限ではありません。料金はアカウントの価格で確認してください。原価を学習に使う場合、既知の単価を `AI_INPUT_USD_PER_MILLION`、`AI_OUTPUT_USD_PER_MILLION`、`TTS_USD_PER_MILLION_CHARACTERS` に入力します。未設定の原価・収益を0として扱いません。費用記録は単価ベースの推計で請求額とは一致を保証しません。Web検索等の追加料金を含まない場合があるため、予算は提供元側でも設定してください。

### TYPE A

雑学・心理学・科学・歴史・記憶等を一次資料から企画。タイトル、短いフック、ナレーション、字幕、独自の文字中心の縦型映像、生成したBGM・効果音を制作します。MVPのTYPE A映像はタイポグラフィ主体です。生成AIによる実写動画エンジンは含めていません。

### TYPE B

「素材と権利」で所有/許諾済みMP4を登録するか、`PEXELS_API_KEY` を使ってPexels APIから検索します。SNS・動画共有サービスの無断ダウンロード処理はありません。PexelsのダウンロードはAPIが返す `videos.pexels.com` のMP4に限定します。

素材には、URL、提供元、ライセンス、商用利用・改変可否、クレジット、許諾根拠、取得日、権利確認日、SHA-256、人物の許諾、AIによる観察結果を保存します。CC0、CC BY 4.0、Public Domain、所有・許諾・AI新規素材に対応。NC/NDや確認不能の素材は拒否します。CC BYにはクレジットが必須です。権利状態が不明な素材は自動使用しません。

ストック映像を「実際に海外で起きた特定の事件」と決めつけません。等間隔フレームで観察できる状況をもとに、自然な日本語の独自解説・補足・ツッコミ・オチを作ります。補足の事実は一次資料と照合。元映像の音声を除き、ナレーションを新規生成します。ズーム、スロー、リプレイ、囲み、矢印付き補足、字幕フェード、カット、BGM、効果音をFFmpegで適用します。スロー・リプレイは画面に明示します。

[Pexels License](https://www.pexels.com/license/) は商用利用・編集を許容しますが、人物の権利や利用態様などの制限があります。ライセンスを記録しただけで第三者のすべての権利が解決するとは扱いません。[Pexels API](https://www.pexels.com/api/documentation/)

## 品質・独自性・承認

出典と台本が対応しない、映像を判断できない、音声がない、日本語フォントが未確認、重大な字幕/映像エラー、重複、著作権/再利用リスクがある場合は投稿を停止します。停止した企画は確認待ちとして記録し、自動運転を一時停止します。

Originality・Commentary・Editing・Educational・Entertainment・Copyright Risk・Reused RiskをAIで評価。初期閾値はOriginality 70、Commentary 65、Editing 60以上、Educational 60またはEntertainment 65以上、Copyright Risk 15以下、Reused Risk 25以下、confidence 0.85以上です。これは内部の保守的な選別基準で、著作権の法的判定やYouTubeの審査ではありません。

解説の独自性が不足する場合のみ1回自動修正し、根拠照合と動画制作を再実行します。権利リスクを台本の言い換えだけで解消したとは扱いません。代表フレームのAI確認は全フレーム・全動作の完全検査ではありません。初期の人間確認モードで運用特性を確かめてください。

- **手動承認モード:** 自動制作 → 出典・動画・公開条件を人が確認 → 承認 → 投稿。
- **完全自動運用モード:** 検査・独自性審査を全通過した動画のみ自動承認・投稿。

承認は台本、動画ハッシュ、タイトル、説明、タグ、公開設定、子ども向け指定、AI開示、予約日時の版に結び付きます。編集すると承認を解除します。タイトル・説明を変えた場合は事実確認もやり直します。字幕のみのプレビューは承認・投稿できません。

## 投稿・予約

最初は**非公開・手動承認・停止中**です。タイトル、説明、タグ、公開/限定公開/非公開、子ども向け、合成コンテンツ開示を編集できます。

予約公開を行う場合は公開範囲を「公開」とし、未来の日本時間を設定します。DBにはUTCで保存。YouTubeへの初回送信は `privacyStatus=private` と未来の `publishAt` を渡します。すでに送信済みの未公開・非公開動画にも予約日時を設定でき、更新時は既存の可変status属性を保存します。過去日時を自動送信せず、再確認を求めます。

再開可能アップロードのセッションと送信開始意図を保存。応答を失ったときは状態確認後に再開し、同じ動画を新しくinsertしません。判断できない送信は停止します。自動運転の一時停止は以後の送信を止めますが、YouTubeに受理済みの予約は解除しません。既存予約はYouTube Studioで管理できます。

新しい未監査APIプロジェクトのアップロードは非公開に制限されます。公開/限定公開/予約公開を使うには該当するAPI監査状態を確認し、`YOUTUBE_PUBLIC_UPLOAD_APPROVED=true` を設定します。**値の変更はGoogleの承認を得る代わりにはなりません。** [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert)、[videos.update](https://developers.google.com/youtube/v3/docs/videos/update)

## 投稿ペースと学習

1日3本/5本などの固定上限はありません。画面の本数は初期の目安です。候補時刻と最小間隔から投稿枠を作り、品質を満たす動画、予算、実行能力、API枠の範囲で動きます。枠に収まらない動画を無理に詰め込みません。データが不足している間は増量しません。

公開日を除くPacific時間の7集計日を使用し、指標がそろっている動画を比較します。APIの遅延を考慮し、終了日から3日以上待ちます。欠けた日を0で埋めず、未完了として残します。比較対象は100エンゲージビュー以上、最低12本。分類ごとに最低5本を要求し、少標本は全体の値へ縮小補正します。

TYPE、ジャンル、字幕スタイル、読み上げ速度、編集スタイル等の配分には、視聴割合、登録、反応、共有、独自の面白さ評価、利用可能な原価・収益、権利リスクを使用。70%を学習済み候補、30%を探索にします。投稿時刻は10本以上の根拠ある候補を優先。フック・尺・構成・直近のAI改善案を、次の生成プロンプトへ実際に渡します。

投稿ペースは成熟した14投稿日を2つの7日群で比較し、各群10本以上ある場合に更新します。改善が十分であれば約34%ずつ増加（3→5→7など）、再生・維持・登録の悪化があれば約25%減少。変更後は14日間の待機期間を置きます。曜日やテーマの影響を含む**観察に基づく仮説**です。

動画別にHook、Retention、Information、Engagement、Shareability、Subscriber ConversionとEntertainmentを保存。Entertainmentは制作物の面白さ評価で、視聴者満足度の実測ではありません。YouTube提供値と独自指標を区別し、欠損は空欄にします。

`audienceWatchRatio` の終盤値は正確な個人単位の完視聴率ではありません。再視聴で100%を超えることがあります。冒頭維持・大きな低下区間は代理情報として扱い、取得できないスワイプ率や完視聴率を捏造しません。[Analytics metrics](https://developers.google.com/youtube/analytics/metrics)、[channel reports](https://developers.google.com/youtube/analytics/channel_reports)

YouTube API由来の独自スコア・比率・派生分析には追加の利用条件があります。該当する申請/承認を済ませた場合のみ `YOUTUBE_DERIVED_METRICS_APPROVED=true` にします。未承認時も自作企画の保存・制作・公式値の表示は利用できます。検証用の架空データで学習を試すこともできます。[追加条件](https://developers.google.com/youtube/terms/derived-metrics-policy)、[Developer Policies](https://developers.google.com/youtube/terms/developer-policies)

A/B比較は、新しい異なるテーマへ一要因ずつ交互に条件を割り付ける観察比較です。YouTubeの視聴者をランダムに分けるネイティブ実験ではありません。各群5本を待って結果を記録し、重複動画の大量投稿はしません。

## DBと保管

実行アプリはSQLite WAL、オンライン管理画面はD1を使用します。両者は同じドメイン処理と画面を共有。スキーマv2では企画、TYPE、台本、出典本文照合の記録、素材台帳、編集条件、指標、成功/失敗仮説、戦略履歴、比較実験、投稿意図、予定、エラーを保存します。MVPの状態本体はバージョン付きJSONレコードで、D1は楽観的ロック、SQLiteはトランザクションと期限付きジョブロックを使います。大規模化する際は動画/指標/素材の行分割を行ってください。

定期取得で認可と動画の存在を再確認。30日以上再確認できない動画のAPI分析データを削除し、派生記憶も無効化。統計の保存は保守的に1095日以内とします。接続解除/データ削除は画面から即時実行できます。自作台本・権利記録はAPIデータと分離しています。

「バックアップ」で書き出したJSONにはキー、トークン、送信セッション、ローカルのファイルパスを含めません。企画移行には、空の保存先で以下を実行します。

```bash
node runner/restore.mjs shorts-loop-backup.json
```

復元時は新IDを付け、承認・送信状態・映像ファイルを引き継がず、事実確認から再実行します。DB全体と素材を含む完全バックアップは、停止後に `data` フォルダをコピーしてください。暗号鍵も必要なので公開しないでください。

## オンライン画面との接続

オンライン画面は単独でも企画・検証・権利記録をD1へ保存できます。FFmpegによる制作や常時ジョブは、同梱の実行アプリが担当します。ブラウザだけで裏側に常時処理が立ち上がるわけではありません。

実行アプリを公開HTTPSリバースプロキシへ配置した場合は、ランダムな `ENGINE_TOKEN` を設定し、`TRUST_LOOPBACK_PROXY=false` を必ず維持します。Site側の環境設定に `ENGINE_URL` と同じ `ENGINE_TOKEN` を追加すると、画面のAPIを実行アプリへ中継します。動画の素材/状態は実行アプリ側に保存されます。

Web OAuthの場合はWebアプリ用クライアントを使い、`PUBLIC_BASE_URL` をユーザーが開くSiteのHTTPS URL、Googleの許可済みリダイレクトURIを `{PUBLIC_BASE_URL}/api/oauth/callback` に設定します。ログインは常にGoogleの認可画面で行います。Siteは初期状態で所有者のみ閲覧可能です。

## テストと確認結果

```bash
npm run build:local
npm run test:engine
node runner/preview-example.mjs
node runner/preview-type-b.mjs
```

- Nodeの本番用HTTPサーバーを実際に起動し、画面配信、API保存、検証データ分離、送信元制限を確認。
- 40テスト（実行エンジン35件＋既存UI等5件）: 承認解除、暗号化、権利停止、重複、期間整合、同一送信の再開、予約時のstatus保持、投稿ペース増減、改善案の保持、APIデータ削除など。
- TYPE A: 1080×1920 / H.264 / AAC / 24.643秒の字幕プレビューを実際に生成。
- TYPE B: 所有する検証パターンを素材に20秒のMP4を生成し、スロー・リプレイ・囲み・字幕・ツッコミを実行。実際の海外映像を装った素材ではありません。
- 生成物は代表フレームを目視確認。ブラウザの画面操作テストは実施していません。
- Google OAuthの実チャンネル認可、OpenAI/VOICEVOXの有料/外部サービス、実際のYouTube投稿・公開予約・Pexels取得は認証情報未設定のためライブ確認していません。API送受信の主要状態遷移はテスト用応答で確認しました。

同梱 `examples` のMP4は音声未生成の字幕/編集検証用です。本番投稿はできません。

## 主なファイル

| ファイル | 内容 |
|---|---|
| `app/Studio.tsx`, `app/AdvancedPanels.tsx` | 共通管理画面 |
| `lib/core.mjs`, `lib/growth.mjs`, `lib/rights.mjs` | 承認・学習・投稿ペース・権利の共有ロジック |
| `runner/server.mjs`, `runner/store.mjs` | 実行アプリ、SQLite、ジョブ起動 |
| `runner/engine.mjs` | 自動改善ループ、予約・投稿、分析 |
| `runner/providers.mjs`, `runner/oauth-flow.mjs` | API、OAuth、トークン暗号化 |
| `runner/assets.mjs`, `runner/render.mjs` | 素材台帳、確認、動画制作 |
| `worker/api.ts`, `db/schema.ts`, `drizzle/` | オンライン画面の永続保存と中継 |
| `Dockerfile`, `compose.yaml`, `.env.example` | 起動と接続設定 |

調査確認日: 2026-09-07。YouTubeのポリシーやAPIは変わるため、実運用の開始時にも公式資料を確認してください。

## 接続したら自動開始する運用

`AUTO_START_ON_CONNECT=true` と `YOUTUBE_TARGET_EMAIL` を実行アプリに設定します。Web用のGoogle OAuthクライアントの戻り先は、この管理画面の `/api/oauth/callback` です。`PUBLIC_BASE_URL` は管理画面のHTTPS URLにします。YouTube接続後、指定アカウントの一致、AI・動画制作・公開APIの準備がそろうと自動で制作と投稿を開始します。初回設定により公開・完全自動になります。一時停止や安全停止は、再接続しても勝手に解除されません。

AI利用キーとGoogle接続設定は、実行サーバー接続後に画面の「初回だけ必要な接続設定」から暗号化して保存できます。Googleのパスワードは要求・保存しません。既存の環境変数やローカル接続ファイルにも対応します。

常時サーバー向けに `Dockerfile.cloud` と `railway.json` を用意しています。実行サーバーは1台とし、`/app/data` に永続ディスクを接続してください。`ENGINE_TOKEN` と `TOKEN_ENCRYPTION_KEY` は秘密の環境設定に保存します。外部サーバーでは `TRUST_LOOPBACK_PROXY=false` が必須です。公開画面とサーバーの接続は既存の `ENGINE_URL` / `ENGINE_TOKEN` を使います。`/healthz` は接続確認のみ返します。サーバー契約、AI利用枠、Google認可が有効な間動作し、永久・無料稼働を保証するものではありません。

Cloud用Dockerイメージの本番デプロイと有料API・実YouTubeの接続試験は、アカウント未接続のため未実施です。OAuthの指定アカウント照合・自動開始・安全停止の保持・暗号化・一時障害時の待機はテスト用応答で確認しています。


## Railwayでの常時運転

新規サービスは `Dockerfile.cloud`、ヘルスチェック `/healthz`、1レプリカ、再起動 ALWAYS、Sleep無効、Cronなしで構成します。`/app/data` に永続ボリュームを接続してください。新規Railwayサービスでは旧Config as Codeを使用できないため、旧設定は `docs/railway-legacy.json` に保存し、稼働設定はRailwayのサービス設定で管理します。参考: https://docs.railway.com/infrastructure-as-code

Sitesには同じ `ENGINE_TOKEN` と、サーバーの動作確認後の `ENGINE_URL` を設定します。実行サーバーには `PUBLIC_BASE_URL` をSitesのHTTPS URL、`HOST=0.0.0.0`、`PORT=8787`、`DATA_DIR=/app/data`、`TRUST_LOOPBACK_PROXY=false`、`AUTO_START_ON_CONNECT=true` を設定。`TOKEN_ENCRYPTION_KEY` は32バイトBase64のSecretにします。ユーザーのOAuth認可・AI設定と公開投稿の準備がそろうまで自動投稿は待機します。

0.5 GBのボリュームでは `MEDIA_RETENTION_HOURS=24`、`MEDIA_BUDGET_MB=160`、`FFMPEG_THREADS=2` を初期値にします。YouTube上で公開を確認できた動画だけがローカル映像整理の対象で、古いものから整理します。YouTube上の動画を削除する処理はありません。未送信・応答不明・非公開・予約中の動画は保存し、使用者の入力素材も自動削除しません。大量の入力素材は別途容量確保が必要です。ローカル動画を長期保存したい場合は、十分な容量を確保して保存設定を変更してください。

Railway接続だけで稼働開始を保証しません。ソース配置、ヘルスチェック、Sitesとの認証付き接続、Google認可、実動画のアップロード結果を順に確認します。サーバー停止・利用枠・OAuth失効・審査エラーがあれば運転を継続できず、画面に待機または確認待ちとして表示します。
