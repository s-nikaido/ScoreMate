# ScoreMate

紙楽譜を撮影・管理する個人開発アプリ（買い切り想定・PC/Android/iOS向け）。

## 現在の状態（v1.3.0時点）

- 本体は単一HTMLファイル `index.html`（Vanilla JS、5000行超）。**このリポジトリ直下の`index.html`が編集の master です。**
- データ・写真はすべて端末内のIndexedDBに保存。外部サーバーへの通信は基本なし（Gemini APIキーを設定してAI読み取りを使う場合と、Google Drive/Dropbox同期を使う場合のみ、その場面だけ通信します）。
- 保存方法は「ローカル保存のみ」「フォルダに保存（PCのみ・File System Access API）」「クラウドに保存（Google DriveまたはDropbox、どちらか一方のみ）」から選択可能。**自動同期（更新日時を比較して衝突時のみ確認する方式）は実装済み**で、現在選択中の保存方法だけを同期する仕様（他の保存先の接続情報が残っていても同期対象にはならない）。
- 機能：曲名・作曲家・パート・演奏会のマスタ管理、傾き・歪み補正（OpenCV.jsによる自動検出＋手動調整）、影のムラ補正、複数画像のPDF化、YouTube動画リンク紐付け＋アプリ内ミニプレイヤー、データ診断・自己修復機能など。
- ログイン機能なし（1人の端末内〜複数端末間の私的な同期で完結するため不要）。

## 公開先

- 開発確認用：GitHub Pages（`https://s-nikaido.github.io/ScoreMate/`）※個人サイトなので一般公開はしない
- 本番公開用：Netlify（`https://scoremate-app.netlify.app/`）※GitHub連携のAuto Deployは解除済み。ドラッグ&ドロップの手動デプロイのみ（クレジット節約のため）

**注意**：`manifest.json`と`sw.js`の登録パスはルート絶対パス（`/manifest.json`, `/sw.js`）です。Netlifyのようにドメイン直下で公開する場合は問題ありませんが、GitHub Pagesのようにサブパス（`/ScoreMate/`）で公開する場合はPWAのmanifest/Service Workerが正しく解決されません。PWABuilder等でPWA判定・MSIX化を行う際は、**Netlifyの本番URLを使ってください**。

## `www/` フォルダについて（Capacitor用・現在は未作成）

`www/`は、Capacitor（iOS/Androidのネイティブラッパー化）用に`index.html`・`manifest.json`・`sw.js`・`privacy.html`・`icons/`をコピーしたミラー用フォルダで、`capacitor.config.json`の`webDir`が参照する場所です。Android/iOS対応は当面の優先度が低いため、**現在このフォルダはあえて作成していません**（`npx cap ...`系のコマンドは今は使いません）。

実際にAndroid対応（`npx cap add android`）やiOS対応に着手するタイミングで、その時点のルート直下の`index.html`・`manifest.json`・`sw.js`・`privacy.html`・`icons/`を`www/`へコピーしてから作業を始めてください。

## ファイル構成

```
ScoreMate/
├─ index.html          ← アプリ本体（編集はここ。全機能1ファイル、5000行超）
├─ manifest.json, sw.js ← PWA用（ルート公開用）
├─ icons/               ← アイコン
├─ privacy.html         ← プライバシーポリシー・免責事項（日英併記、要専門家レビュー）
├─ test/data-tests.js   ← 自動テスト（jsdom + fake-indexeddb、9件）
├─ capacitor.config.json, package.json ← Capacitor設定（iOS/Android用。www/は未作成、着手時に用意）
```

## バージョン運用ルール

形式：`あ.い.う`
- **あ**：指示があったときのみ変更
- **い**：機能追加ごとに+1、うを0に戻す
- **う**：既存修正・調整ごとに+1

`index.html`内の`APP_VERSION`という1つのJS定数を書き換えるだけで、ヘッダー・フッター・完全エクスポートのmanifest等に連動します。

## テストの実行方法

```bash
cd ScoreMate
npm install jsdom fake-indexeddb --no-save
node test/data-tests.js
```

修正の都度、構文チェック（`node -e "new Function(...)"`等）とこのテスト（9件成功）を確認してから納品しています。

## 次にやるとよいこと（優先順）

1. **PC向けリリース準備**（最優先）：Netlifyでの正式公開の最終確認、Microsoft Store個人開発者登録、MSIXパッケージ作成（PWABuilder等を使用。上記の通り必ずNetlifyの本番URLを対象にすること）
2. Android版：`www/`を最新化した上でCapacitorの実機動作確認（`npx cap add android` → Android Studio）
3. iOS版：同様にCapacitorで実機動作確認（Macのみ・Xcodeが必要）
4. ストア掲載用の説明文・スクリーンショットの準備
