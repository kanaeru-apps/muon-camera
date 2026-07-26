# 引き継ぎ文書：ZERO Camera ネイティブカメラの未解決問題（原因調査・修正依頼）

## あなた（引き継ぎ先AI）への依頼
下記の「未解決の謎」の原因を特定し、修正方針を立てて実装まで進めてください。
**重要**: これまでの担当AIの仮説は複数が実機で否定されています。本文書の「試行と結果の生データ」を一次情報として、先入観なしに因果を再推論してください。

---

## 1. プロジェクト概要

- アプリ: ZERO Camera（マナーモード連動の無音カメラ、iOS）
- 構成: HTML/CSS/Vanilla JS (PWA) を Capacitor 8 でラップ。ネイティブ実行時はカメラを `@capgo/camera-preview` v8.11.2（ネイティブプレビュー、WebViewの背面に表示 toBack:true、UIは透過WebView）で駆動。Web実行時は getUserMedia（本問題とは無関係に正常動作、Playwrightスモークテスト完備）。
- リポジトリ: `C:\Users\honma\Documents\projects-AI\ツール_無音カメラ`（GitHub: ChihiroHonma/muon-camera）
- 作業ブランチ: `native-video-recording`（最新 eb34846）
- 安定版: `master`（タグ `stable-silent-video`）= Web camera版。ここに戻せば全機能動作（ただし動画音声なし）。
- 開発環境の制約: **開発者はMac/Xcodeを持たない。ビルドはCodemagic(CI)、検証はTestFlight実機のみ。1試行=1ビルド+手動テストで高コスト。**
- 絶対要件: (a)写真撮影がマナーモード時に完全無音 (b)通常モード時はシャッター音が鳴る（マナー連動） (c)動画録画に音声が入る

## 2. 主要ファイル

- `www/js/app.js` — UI/カメラ制御（`useNativeCam`でネイティブ/Web分岐）。`nativeStartOptions()`, `initNativeCamera()`, `captureNativePhoto()`, `startRecording()/stopRecording()/onNativeRecordingFinished()`, `returnToCamera()`
- `ios/App/App/ShutterSoundPlugin.swift` — シャッター音。現在は AudioServicesCreateSystemSoundID(自作shutter.wav)方式
- `ios/App/App/PhotoSaverPlugin.swift` — 写真(base64)/動画(ファイルパス)の写真ライブラリ保存
- `patches/@capgo+camera-preview+8.11.2.patch` — patch-package。現在含むもの: ①録画開始時に.photoプリセット→動画対応プリセットへ一時切替(didFinishRecordingで復元) ②displayPreviewのopacity復元を無条件化
- プラグインソース: `node_modules/@capgo/camera-preview/ios/Sources/CapgoCameraPreviewPlugin/`（CameraController.swift 約3500行 / Plugin.swift）
- ビルド: `codemagic.yaml`（npm install→postinstallでpatch-package適用→cap sync→Xcodeビルド）

## 3. ビルド履歴と実機症状の生データ（最重要・一次情報）

| Build | コミット | 主変更 | 実機での症状（ユーザー報告そのまま） |
|---|---|---|---|
| 13 | 81db155 | ネイティブカメラ初回（disableAudio:false, AVAudioPlayer+.ambientシャッター音） | 写真モードプレビュー**映る**。写真**無音**で撮れる。録画中プレビュー暗転。保存動画は映像音声とも**正常** |
| 14 | f223d8c | 診断オーバーレイ追加のみ | native=true/useNC=true/started=true確認。録画経路NATIVE確認。(プレビュー表示は13と同様) |
| 15 | 55a0110 | enableVideoMode:true追加 | 録画中プレビュー暗転(直らず)。**撮影した写真が反転・黒く壊れる** |
| 16 | b0332f2 | enableVideoMode撤回+診断削除(372e9f8)+videoQuality:'1080p'追加 | 録画中プレビュー映らず。**写真もプレビュー映らず**(以後ずっと) 。保存動画に音声あり |
| 17 | a703014 | 1080p撤回+patch導入(プリセット一時切替+**VideoDataOutput除去**) | 写真モードプレビュー**黒**(保存画像は正常)。録画プレビュー映らず。動画正常。**音が鳴るようになった・マナー連動せず**(1種類) |
| 18 | 22cdb32 | opacity無条件復元patch追加+**マイクをモード分離**(写真=disableAudio:true)+モード切替でカメラ再起動 | プレビュー黒(継続)。**通常=OS標準シャッター音+自作音の2種類、マナー=OS標準音のみ**。動画モード:プレビュー無し・**録画不可** |
| 19 | eb34846 | **VideoDataOutput除去を撤回(復元)**+disableAudio:false固定に戻す+モード切替再起動撤去+シャッター音を**AudioServicesシステムサウンド方式に変更** | プレビュー**依然黒**。**通常/マナーともOS標準シャッター音が鳴る。自作音は聞こえない**。動画モードもプレビュー見えず |

## 4. 試行済みで「否定された」仮説（重要）

1. ×「enableVideoMode:trueで録画中暗転が直る」→直らず、写真撮影を壊した(15)
2. ×「1080pプリセット固定で直る」→直らず、プレビュー全体が黒に(16)
3. ×「VideoDataOutput除去(外部AIレビュー推奨)」→写真プレビュー黒の疑い(17)で撤回したが、**復元しても黒のまま(19)** → 除去は黒の原因ではなかった可能性も、復元で直らない別要因の可能性もある
4. ×「displayPreviewのopacityバグ(毎回0にするが新規挿入時しか1に戻さない)が黒の原因」→無条件復元パッチ(18,19)でも黒のまま。※バグ自体は本物なのでパッチは残してある
5. ×「写真モードからマイクを外せばマナー連動が直る」→OS標準シャッター音が復活して悪化(18)
6. △「マイク入力保持がOS標準シャッター音を抑制する」→13〜16では実際に無音だったが、**19ではマイク保持でもOS標準音が鳴る**（矛盾。理由不明）
7. △「AudioServicesカスタムシステムサウンドはマナースイッチに従う」→**音自体が聞こえない**(19)。録音系音声セッションではシステムサウンドが抑制される可能性。または再生前にreject(エラーはJS側で握りつぶしている: `ShutterSound.play().catch(()=>{})` )

## 5. 未解決の謎（優先度順）

### 謎A【最優先】: プレビューがビルド16以降ずっと黒
- ビルド13〜15では映っていた。16(1080p)で黒くなり、**1080pを17で撤回しても、DataOutputを19で復元しても黒いまま**。
- 19時点のiOS側の実質差分(対13): (a)プリセット一時切替パッチ(captureVideo内のみ=起動時に無関係) (b)opacity無条件復元パッチ (c)ShutterSoundPluginの書き換え (d)PhotoSaverにsaveFile追加。**どれも起動時のプレビュー表示を壊す要素が見当たらない**。
- **検証すべき重要仮説**: 「コードではなく環境(端末状態・iOS状態・TestFlightキャッシュ・権限)が原因」。
  → **切り分け実験(強く推奨・最初にやるべき)**: ビルド13のコミット(81db155)をそのままCodemagicで再ビルドして実機確認する。
  - 映る → コード差分が原因。81db155→eb34846をbisectで特定可能(候補は上記a〜d + JS差分)
  - 黒いまま → 環境要因が確定。端末再起動・アプリ削除→再インストール・設定>ZERO Camera>カメラ権限の確認・iOSバージョン変化を調査
- 別仮説: WebView透過(`makeWebViewTransparent`+CSS `body.native-cam`)が何かで壊れた/カメラ起動自体が失敗している(=start()がrejectしてトースト「カメラの起動に失敗」が出ているか要確認。**ユーザーにエラートーストの有無を必ず聞くこと**)

### 謎B: OS標準シャッター音の挙動が矛盾
- 13〜16: 無音(OS音鳴らず) / 17: 何かの音が鳴り出す / 18: マイク分離でOS音+自作音 / 19: マイク戻してもOS音が鳴る
- 「マイク入力でOS音抑制」理論は19の結果と矛盾。真の抑制条件は別にある可能性:
  - 仮説B1: 抑制条件は「音声セッションが録音アクティブ状態」であり、単なるマイク入力の有無ではない。13〜16はShutterSoundPluginが再生時に.ambient化を試みていた(このsetCategory呼び出し自体が何かに影響?)。19はAudioServicesに変えたことで音声セッション状態が変わった?
  - 仮説B2: 19でstart()自体が失敗しておりセッションが無い→抑制も無い→OS音が鳴る(謎Aと同根!)。**もし謎Aの正体が「カメラ起動失敗」なら、B(OS音)もC(自作音無し)も全部説明がつく**: セッション無→AVCapturePhotoOutputは動かないはずだが…保存画像は正常なので撮影はできている→この仮説は写真が撮れている事実と要整合(captureSample系のフォールバック?)
- ※AudioServicesPlaySystemSound(1108)が常時鳴った過去実験から、保護されたID(1108)はマナー無視で鳴る。**今19で鳴っているOS音はアプリ発ではなくAVCapturePhotoOutput発の強制音**の可能性が高い(日本向けiPhone)

### 謎C: AudioServicesの自作音が聞こえない(19)
- 仮説C1: 録音系AVAudioSessionアクティブ中はシステムサウンド(UIサウンド層)が抑制される
- 仮説C2: AudioServicesCreateSystemSoundIDが失敗しrejectしているがJSがcatchで握りつぶし
- → 診断: play()のreject理由をトースト表示する一時コードを入れれば1ビルドで判別可能

## 6. 推奨する進め方（引き継ぎ先AIへの提案・変更可）

1. **【ビルド不要】ユーザーへのヒアリング**: (a)起動時に「カメラの起動に失敗: ...」等のトーストが出ていないか (b)iOS設定>ZERO Camera の権限一覧(カメラ/マイク/写真) (c)端末再起動+アプリ削除→TestFlight再インストールで変化があるか
2. **【1ビルド】切り分けの原点回帰**: 81db155をそのまま再ビルド(ブランチ切って`git checkout -b bisect 81db155`をpush、Codemagicでそのブランチをビルド)して「今でも映るか」を確認。映る→コード犯人捜し(bisect)。黒→環境要因。
3. 原因特定後に、絶対要件(無音撮影/マナー連動音/動画音声)を満たす最終設計を決める。
4. 修正のたびにWeb版スモークテスト(`.claude/skills/webapp-testing` + scratchpadのsmoke_test.py)でJS回帰がないことを確認する運用を継続。

## 7. 過去に確立できた確かな知見（再利用可）

- 動画+音声の録画・保存・共有パイプラインは実機で動作実績あり(13,16,17で音声入り動画保存成功)
- @capgoのstopRecordVideoは`file://`パスを返す。保存はPhotoSaver.saveFile(パス渡し)、共有は@capacitor/share(パス渡し)でメモリ安全
- 録画の状態機械(recState idle/starting/recording/stopping + recordingFinishedイベント一元処理)は4巡のコードレビュー済み
- patch-packageはpostinstallでCodemagic上でも自動適用される(検証済み)
- .photoプリセットとAVCaptureMovieFileOutputの非互換はApple既知仕様(録画中暗転の有力理論、ただし未検証のまま)
- Web版(master, stable-silent-videoタグ)はいつでも復帰可能な安定版

## 8. 現在のgit状態

- ブランチ `native-video-recording` 最新 `eb34846`(=ビルド19)
- コミット列: 8d03199→dd663b9→6374fd3→81db155(build13)→f223d8c(14)→55a0110(15)→372e9f8→b0332f2(16)→a703014(17)→22cdb32(18)→eb34846(19)
- `master`(stable-silent-video)は無傷
