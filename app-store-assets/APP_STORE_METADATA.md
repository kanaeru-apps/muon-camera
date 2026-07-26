# ZERO Camera — App Store登録内容

## 基本情報

- アプリ名：`ZERO Camera`
- サブタイトル：`マナーモードに合わせて静かに撮影`
- プライマリカテゴリ：写真／ビデオ
- セカンダリカテゴリ：ユーティリティ
- 著作権：`2026 KANAERU`
- サポートURL：`https://kanaeru-apps.github.io/support.html`
- プライバシーポリシーURL：`https://kanaeru-apps.github.io/privacy-policy.html`

## 説明文

ZERO Cameraは、端末のマナーモードに合わせて静かに撮影できる、シンプルなカメラアプリです。

通常モードでは撮影時にシャッター音が鳴り、撮影したことをお知らせします。静かに撮影したいときは、iPhoneをマナーモードにしてください。マナー撮影はiPhoneをマナーモードに！

赤ちゃんやペットの撮影、飲食店・図書館などマナーへの配慮が必要な場所での撮影に便利です。写真だけでなく、音声付き動画の撮影にも対応しています。

撮影した写真や動画は端末内で処理され、外部サーバーへ送信されません。必要な写真・動画だけを写真ライブラリへ保存したり、iOSの共有機能を使ってほかのアプリへ送ったりできます。

主な機能
・写真撮影
・音声付き動画撮影
・マナーモードに連動した撮影音
・前面／背面カメラの切り替え
・ズーム調整
・明るさ調整
・1:1、3:4、9:16、全画面の画角切り替え
・撮影タイマー
・グリッド表示
・フラッシュ切り替え
・写真ライブラリへの保存
・iOS標準の共有機能

会員登録やログインは必要ありません。広告やアクセス解析機能も使用していません。

※動画撮影では音声を記録するため、マイクへのアクセスが必要です。
※シャッター音が静かになるのは、端末がマナーモード（消音モード）の場合のみです。
※撮影・録画時は画面に必ず表示が出ます（この表示はオフにできません）。

## キーワード（43文字）

`カメラ,マナー,写真,動画,撮影,ペット,赤ちゃん,ズーム,タイマー,グリッド,明るさ`

（変更履歴：2026-07-26「静音」を外し「ペット,赤ちゃん」を追加。審査対策＋用途訴求）

## App Review Notes（2026-07-26 全面改訂・2回目リジェクト対応版）

This is a camera application supporting photo and video capture. No login is required.

IMPORTANT — About the shutter sound (Guideline 2.5.14):
The app plays an audible shutter sound by default and never disables it on its own. The sound follows the device's user-controlled system settings:
- On iPhone, the shutter sound plays whenever the Ring/Silent switch is set to Ring. It is muted only when the user sets the hardware switch to Silent — the same system setting that silences sounds from other apps.
- On iPad (compatibility mode), there is no hardware Ring/Silent switch, so in this build the shutter sound ALWAYS plays regardless of the silent setting.

A demo video recorded on a physical iPhone, showing the shutter sound and all indicators, is available here: [DEMO VIDEO URL]

Recording indicators (cannot be disabled by the user):
- A "Camera Active" badge is always visible on the viewfinder while the camera is in use.
- Every photo capture shows a white shutter flash and a "Photo Captured" confirmation.
- Video recording shows a red "Recording" label with elapsed time for the entire recording. The camera preview remains visible throughout and never goes blank.
- On first launch, the app shows a notice screen describing these indicators and the shutter sound behavior, which the user must acknowledge before the camera starts.
- The app has no feature to darken or blank the screen while capturing.

To test:
1. Launch the app, acknowledge the first-launch notice, and allow Camera / Microphone / Add Photos permissions.
2. On iPhone: set the Ring/Silent switch to Ring and raise the volume, then take a photo. The shutter sound plays, together with the white flash and the "Photo Captured" indicator.
3. On iPad: raise the media volume and take a photo. The shutter sound always plays.
4. On iPhone, set the switch to Silent and take a photo. The sound is muted by the user's system setting, while all visual indicators remain visible.
5. Switch to Video and record a short clip. The red Recording indicator and timer stay visible, and the saved video contains audio.
6. Select Save to add the captured media to the photo library.

Camera permission is used for photo and video capture. Microphone permission is used only to record audio with videos. Photo Library Add permission is used only when the user selects Save. Captured media is processed on the device and is never uploaded anywhere.

## 申告方針

- App Privacy：このアプリからデータを収集しない
- 年齢制限：各コンテンツ項目なし（想定4+）
- Made for Kids：選択しない
- 非免除暗号化：なし（`ITSAppUsesNonExemptEncryption=false`）
- リリース方法：審査通過後に手動でリリース
