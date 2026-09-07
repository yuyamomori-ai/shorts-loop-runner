# 最初に読む

1. Docker Desktopを起動し、start-windows.cmdを開きます。
2. http://localhost:8787 で「検証データ」を選ぶと、記憶と学習を試せます。
3. 本番では.envにOpenAI APIキーを設定し、data/client_secret.jsonを配置。運用設定の「YouTubeと接続」で認可します。
4. 最初は非公開・手動承認。動画の確認後に送信してください。

TYPE Bは「素材と権利」で、所有/利用許諾のあるMP4を登録します。Pexels APIキーによる素材取得も対応しています。

詳しい手順・APIの利用条件・接続・予約・自動運転はREADME.mdへ。

examples/renderedの2本は、実際に生成した字幕/編集検証用MP4です。日本語ナレーションは未生成で、本番投稿用ではありません。

Google認可・有料API・実際のYouTube投稿は、利用者の接続設定が必要です。秘密情報は同梱していません。
