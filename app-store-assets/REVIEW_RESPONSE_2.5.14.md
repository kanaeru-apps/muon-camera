# Guideline 2.5.14 対応（返信文）

## 第2回リジェクト（2026-07-25レビュー、提出ID 340da054-…、審査機 iPad Air 第5世代）への返信

新ビルドを添えて再提出する際に、App Review への返信欄（Resolution Center）に以下を送る。
`[DEMO VIDEO URL]` は撮影後のデモ動画URL（YouTube限定公開等）に差し替えること。

### 英語（送信用）

Hello App Review Team,

Thank you for your continued review. We would like to respectfully clarify a point about the shutter sound, and describe the changes made in this new build.

**The app does play an audible shutter sound by default, and it never disables the sound on its own.** The shutter sound simply follows the device's user-controlled system settings, in the same way other app sounds do:

- On iPhone, the shutter sound plays whenever the Ring/Silent switch is set to Ring. It is muted only when the user has physically set the hardware switch to Silent.
- We noticed that the previous review was performed on an iPad Air (5th generation). iPads have no hardware Ring/Silent switch, and if silent mode was enabled in Control Center (or the media volume was down), the shutter sound would not have been audible during the review. We apologize that this behavior was not clearly explained in our previous notes.

To remove any ambiguity, we made the following changes in this build:

1. **On iPad, the shutter sound now always plays**, regardless of the silent setting, since iPads have no hardware Ring/Silent switch.
2. **A first-launch notice screen** was added. Before the camera starts for the first time, the user must acknowledge that (a) capture and recording always produce on-screen indicators that cannot be disabled, (b) a shutter sound plays in normal mode, and (c) the sound follows the device's Silent Mode setting.
3. The existing indicators remain in place and cannot be disabled: a persistent "Camera Active" badge on the viewfinder, a white shutter flash plus a "Photo Captured" confirmation on every capture, and a red "Recording" label with elapsed time during video recording. The camera preview never goes blank while recording, and the app has no feature to darken or blank the screen while capturing.

We recorded a demo video on a physical iPhone showing the shutter sound with the Ring/Silent switch in each position, together with all indicators:
[DEMO VIDEO URL]

To verify on the review device:
- iPhone: set the Ring/Silent switch to Ring and raise the volume, then take a photo — the shutter sound plays along with the visual indicators.
- iPad: raise the media volume and take a photo — the shutter sound always plays.

Thank you very much for reviewing the revised build.

### 日本語参考訳（送信しない・確認用）

App Reviewチームの皆様

継続してご審査いただきありがとうございます。シャッター音について1点補足させていただくとともに、新ビルドでの変更点をご説明します。

**本アプリはデフォルトでシャッター音を再生しており、アプリ側から音を無効化することはありません。** シャッター音は、他のアプリの音と同様に、端末のユーザー設定に従うだけです。

- iPhoneでは、着信/サイレントスイッチが着信側であれば必ずシャッター音が鳴ります。消音されるのは、ユーザー自身がハードウェアスイッチをサイレントに切り替えた場合のみです。
- 前回の審査はiPad Air（第5世代）で行われたと承知しています。iPadにはハードウェアの着信/サイレントスイッチがなく、コントロールセンターで消音が有効（またはメディア音量が下がった状態）だった場合、審査中にシャッター音が聞こえなかった可能性があります。前回のノートでこの挙動を明確にご説明できておらず申し訳ありません。

曖昧さをなくすため、本ビルドでは以下を変更しました。

1. **iPadではサイレント設定にかかわらずシャッター音が常に鳴る**ようにしました（iPadにはハードウェアスイッチがないため）。
2. **初回起動時の通知画面**を追加しました。初めてカメラが起動する前に、(a)撮影・録画時は必ず画面表示が出て無効化できないこと、(b)通常モードではシャッター音が鳴ること、(c)音は端末の消音設定に従うこと、をユーザーが確認する必要があります。
3. 既存のインジケーターは引き続き無効化できません：ビューファインダーの「カメラ使用中」常時バッジ、撮影ごとの白フラッシュ＋「写真を撮影しました」確認、録画中の赤い「録画中」表示＋経過時間。録画中にプレビューが暗転することはなく、撮影中に画面を暗くする機能はアプリに存在しません。

iPhone実機で、スイッチ両ポジションでのシャッター音と全インジケーターを撮影したデモ動画をご用意しました：
[DEMO VIDEO URL]

審査デバイスでの確認方法：
- iPhone：着信/サイレントスイッチを着信側にして音量を上げ、写真を撮影 → シャッター音と視覚表示を確認できます。
- iPad：メディア音量を上げて写真を撮影 → シャッター音が常に鳴ります。

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
