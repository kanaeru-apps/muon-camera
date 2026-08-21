# Guideline 2.5.14 対応（返信文）

## 第2回リジェクト（2026-07-25レビュー、提出ID 340da054-…、審査機 iPad Air 第5世代）への返信

新ビルドを添えて再提出する際に、App Review への返信欄（Resolution Center）に以下を送る。
`[DEMO VIDEO URL]` は撮影後のデモ動画URL（YouTube限定公開等）に差し替えること。

### 英語（送信用）

Hello App Review Team,

Thank you for your continued review. We would like to transparently describe the shutter-sound and capture behavior in this new build.

**The app plays its own audible shutter sound in normal sound mode.** The sound uses the ambient audio category and follows the user's system-controlled Silent Mode setting on both iPhone and iPad.

The photo implementation has two explicit paths:
- If AVFoundation reports that system shutter-sound suppression is supported, the app uses AVCapturePhotoOutput with Apple's documented suppression setting and plays the app-managed shutter sound.
- If suppression is unavailable for the current device or jurisdiction, the app saves the current AVCaptureVideoDataOutput frame instead of invoking AVCapturePhotoOutput. This path does not generate a built-in system shutter sound and uses the same app-managed sound.

To remove any ambiguity, we made the following changes in this build:

1. **The sound behavior is consistent on iPhone and iPad:** audible in normal sound mode and muted only by the user's Silent Mode setting.
2. **A first-launch notice screen** explains that (a) capture and recording always produce on-screen indicators that cannot be disabled, (b) a shutter sound plays in normal mode, and (c) the sound follows the device's Silent Mode setting.
3. The existing indicators remain in place and cannot be disabled: a persistent "Camera Active" badge on the viewfinder, a white shutter flash plus a "Photo Captured" confirmation on every capture, and a red "Recording" label with elapsed time during video recording. The camera preview never goes blank while recording, and the app has no feature to darken or blank the screen while capturing.

We recorded a demo video on a physical iPhone showing the shutter sound with the Ring/Silent switch in each position, together with all indicators:
[DEMO VIDEO URL]

To verify on the review device:
- Disable Silent Mode, raise the media volume, and take a photo — the app-managed shutter sound plays along with the visual indicators.
- Enable Silent Mode and take another photo — the sound follows that user setting, while the same visible indicators remain present.

Thank you very much for reviewing the revised build.

### 日本語参考訳（送信しない・確認用）

App Reviewチームの皆様

継続してご審査いただきありがとうございます。新ビルドの撮影音と撮影方式について、透明性をもってご説明します。

**本アプリは通常のサウンドモードでは独自のシャッター音を再生します。** この音はambientオーディオカテゴリを使用し、iPhone・iPadともユーザーが設定した消音モードに従います。

写真撮影には2つの経路があります。AVFoundationがシステム撮影音の抑制に対応している場合は、Appleの公式設定を有効にしたAVCapturePhotoOutputを使用します。端末または地域の条件により非対応の場合は、AVCapturePhotoOutputを呼ばず、AVCaptureVideoDataOutputの現在フレームを保存します。どちらも同じ独自撮影音と視覚表示を使用します。

曖昧さをなくすため、本ビルドでは以下を変更しました。

1. **iPhone・iPadで同じ挙動**とし、通常モードでは音が鳴り、ユーザーが消音モードにした場合だけ音が消えます。
2. **初回起動時の通知画面**を追加しました。初めてカメラが起動する前に、(a)撮影・録画時は必ず画面表示が出て無効化できないこと、(b)通常モードではシャッター音が鳴ること、(c)音は端末の消音設定に従うこと、をユーザーが確認する必要があります。
3. 既存のインジケーターは引き続き無効化できません：ビューファインダーの「カメラ使用中」常時バッジ、撮影ごとの白フラッシュ＋「写真を撮影しました」確認、録画中の赤い「録画中」表示＋経過時間。録画中にプレビューが暗転することはなく、撮影中に画面を暗くする機能はアプリに存在しません。

iPhone実機で、スイッチ両ポジションでのシャッター音と全インジケーターを撮影したデモ動画をご用意しました：
[DEMO VIDEO URL]

審査デバイスでの確認方法：
- 消音モードを解除して音量を上げ、写真を撮影 → 独自撮影音と視覚表示を確認できます。
- 消音モードを有効にして再度撮影 → 音は端末設定に従って消えますが、視覚表示は同じように必ず表示されます。

修正版ビルドのご審査、何卒よろしくお願いいたします。

---

## （アーカイブ）第1回リジェクトへの返信 — 2026-07-23送信済み

> Hello App Review Team,
>
> Thank you for your review and for identifying the issue under Guideline 2.5.14.
>
> We revised the app so that recording activity is always clearly indicated and the indicators cannot be disabled:
>
> 1. The camera viewfinder now continuously displays a visible "Camera Active" indicator whenever the camera is in use.
> 2. Every photo capture displays a conspicuous "Photo Captured" confirmation and a white shutter flash.
> 3. Video recording continuously displays a red "Recording" indicator and elapsed recording time. The camera preview remains visible throughout recording and does not go blank.
>
> To verify the changes, please enable Silent Mode, open the camera, and take a photo. The Camera Active and Photo Captured indicators will remain visible even though the shutter sound follows the device's Silent Mode setting. Then switch to Video and start recording; the red Recording indicator and timer will remain visible until recording stops.
>
> Thank you for reviewing the revised build.

結果：2026-07-25、iPad Air（第5世代）での審査で再度2.5.14リジェクト。
指摘：「写真撮影時にカメラのシャッター音を自動的に無効にする」。
→ 審査機のiPadにはサイレントスイッチがなく、`.ambient`再生の自作シャッター音が
消音状態で聞こえなかった可能性が高い（推測）。第2回返信はこの誤認の反証を軸にする。
