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

ZERO Cameraは、iPhoneのマナーモードに合わせて静かに撮影できる、シンプルなカメラアプリです。iPadでは撮影を明示するため、消音設定にかかわらず撮影音が鳴ります。

通常モードでは撮影時にシャッター音が鳴り、撮影したことをお知らせします。静かに撮影したいときは、iPhoneをマナーモードにしてください。マナー撮影はiPhoneをマナーモードに！

赤ちゃんやペットの撮影、飲食店・図書館などマナーへの配慮が必要な場所での撮影に便利です。写真だけでなく、音声付き動画の撮影にも対応しています。

撮影した写真や動画は端末内で処理され、外部サーバーへ送信されません。必要な写真・動画だけを写真ライブラリへ保存したり、iOSの共有機能を使ってほかのアプリへ送ったりできます。

主な機能
・写真撮影
・音声付き動画撮影
・iPhoneのマナーモードに連動した撮影音（iPadでは常時再生）
・前面／背面カメラの切り替え
・ズーム調整
・明るさ調整
・1:1、3:4、9:16、全画面の画角切り替え
・撮影タイマー
・グリッド表示
・フラッシュ切り替え
・前面カメラの画面フラッシュ（オン／オフ切り替え）
・写真ライブラリへの保存
・iOS標準の共有機能

会員登録やログインは必要ありません。広告やアクセス解析機能も使用していません。

※動画撮影では音声を記録するため、マイクへのアクセスが必要です。
※シャッター音が静かになるのは、端末がマナーモード（消音モード）の場合のみです。
※撮影・録画時は画面に必ず表示が出ます（この表示はオフにできません）。

## キーワード（43文字）

`カメラ,マナー,写真,動画,撮影,ペット,赤ちゃん,ズーム,タイマー,グリッド,明るさ`

（変更履歴：2026-07-26「静音」を外し「ペット,赤ちゃん」を追加。審査対策＋用途訴求）

## App Review Notes（build 42・iPad常時撮影音対応版）

This is a camera application supporting photo and video capture. No login is required.

IMPORTANT — Guideline 2.5.14 changes in build 42:
- On iPad, every photo capture plays the app-managed shutter sound using the playback audio category. The sound plays even when iPad Silent Mode is enabled.
- On iPhone, the app-managed shutter sound uses the ambient audio category and follows the user's Ring/Silent setting. The mandatory visual capture indicators remain visible in both modes.

For transparency, the photo implementation has two paths:
- When AVFoundation reports that system shutter-sound suppression is supported, the app uses AVCapturePhotoOutput with Apple's documented suppression setting and plays the app-managed shutter sound described above. On iPad, this app-managed sound is always audible regardless of Silent Mode.
- When that suppression is unavailable for the current device or jurisdiction, the app saves the current AVCaptureVideoDataOutput frame instead of invoking AVCapturePhotoOutput. The same app-managed shutter sound policy and visible indicators are used; on iPad the app-managed sound is always audible.

A demo video recorded on a physical iPhone, showing the shutter sound and all indicators, is available here: [DEMO VIDEO URL]

Recording indicators (cannot be disabled by the user):
- A "Camera Active" badge is always visible on the viewfinder while the camera is in use.
- Every photo capture shows a white shutter flash and a "Photo Captured" confirmation.
- Video recording shows a red "Recording" label with elapsed time for the entire recording. The camera preview remains visible throughout and never goes blank.
- On first launch, the app shows a notice screen describing these indicators and Silent Mode behavior, which the user must acknowledge before the camera starts.
- The app has no feature to darken or blank the screen while capturing.

Front-camera flash:
- The front camera has no LED flash, so the app provides an optional screen flash controlled by the same Flash button.
- When enabled for a front-camera photo, the app briefly displays a white screen at maximum display brightness before capture, then restores the user's previous brightness.

To test:
1. Launch the app, acknowledge the first-launch notice, and allow Camera / Microphone / Add Photos permissions.
2. On iPad, raise the media volume, enable Silent Mode, and take a photo. The app-managed shutter sound still plays together with the white flash and "Photo Captured" indicator.
3. On iPhone, switch to Ring mode and take a photo. The app-managed shutter sound plays. Switch to Silent Mode and repeat; the sound follows the user's setting while the mandatory visual indicators remain visible.
4. On both iPhone and iPad, confirm the first-launch notice accurately describes the device-specific shutter-sound behavior.
5. Switch to Video and record a short clip. The red Recording indicator and timer stay visible, and the saved video contains audio.
6. Select Save to add the captured media to the photo library.

Camera permission is used for photo and video capture. Microphone permission is used only to record audio with videos. Photo Library Add permission is used only when the user selects Save. Captured media is processed on the device and is never uploaded anywhere.

## 申告方針

- App Privacy：このアプリからデータを収集しない
- 年齢制限：各コンテンツ項目なし（想定4+）
- Made for Kids：選択しない
- 非免除暗号化：なし（`ITSAppUsesNonExemptEncryption=false`）
- リリース方法：審査通過後に手動でリリース
