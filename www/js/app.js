'use strict';

// Release builds do not write native errors, paths, or device details to the
// console. Set this to true only in a local diagnostic build.
const DEBUG_LOGS = false;
function debugLog(message) {
  if (DEBUG_LOGS) console.debug(message);
}

// ── State ──────────────────────────────────────────────
let stream = null;
let currentFacing = 'environment';
let flashOn = false;
let flashSupported = false;
let timerValue = 0;           // 0 / 3 / 5 / 10
let gridVisible = false;
let brightnessValue = 1.0;    // 0.5 – 2.0
let zoomValue = 1.0;
let zoomMin = 1.0;
let zoomMax = 5.0;
let hwZoomSupported = false;
let currentMode = 'photo';  // 'photo' | 'video'
let currentRatio = '1-1'; // '1-1' | '3-4' | '9-16' | 'full'
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let capturedBlob = null;
let capturedType = null;      // 'photo' | 'video'
let capturedMime = null;
let capturedUrl = null;
let burstTimer = null;
let burstInterval = null;
let isBurst = false;
let countdownTimer = null;
let recordingTimer = null;
let recordingSeconds = 0;
let nativeShutterSuppressionSupported = false;
let nativeShutterAlwaysAudible = false;
let nativeFlashTarget = 'torch'; // 'screen' | 'torch' | 'on'
let cameraFlipInProgress = false;
let flashToggleInProgress = false;

// ── DOM ────────────────────────────────────────────────
const video          = document.getElementById('video');
const captureCanvas  = document.getElementById('capture-canvas');
const gridCanvas     = document.getElementById('grid-canvas');
const countdownEl    = document.getElementById('countdown-display');
const toast          = document.getElementById('toast');
const shutterFlash   = document.getElementById('shutter-flash');

const ratioBtn       = document.getElementById('ratio-btn');
const ratioBox       = document.getElementById('ratio-box');
const viewfinder     = document.getElementById('viewfinder');
const flashBtn       = document.getElementById('flash-btn');
const flashLabel     = flashBtn.querySelector('.label');
const timerBtn       = document.getElementById('timer-btn');
const gridBtn        = document.getElementById('grid-btn');
const brightnessSlider = document.getElementById('brightness-slider');
const zoomSlider     = document.getElementById('zoom-slider');
const shutterBtn     = document.getElementById('shutter-btn');
const shutterIcon    = document.getElementById('shutter-icon');
const flipBtn        = document.getElementById('flip-btn');
const thumbnailBtn   = document.getElementById('thumbnail-btn');
const thumbnailImg   = document.getElementById('thumbnail-img');
const captureSoundStatus = document.getElementById('capture-sound-status');

// ── Native plugins (iOS only) ───────────────────────────
// ネイティブアプリ実行時のみ有効。Web版では何もしない（従来通りの挙動にフォールバック）。
const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const ShutterSound  = isNativeApp ? window.Capacitor.registerPlugin('ShutterSound')  : null;
const PhotoSaver    = isNativeApp ? window.Capacitor.registerPlugin('PhotoSaver')    : null;
const CameraPreview = isNativeApp ? window.Capacitor.registerPlugin('CameraPreview') : null;
const CapShare      = isNativeApp ? window.Capacitor.registerPlugin('Share')         : null;
// ネイティブ時はカメラをネイティブプレビュー(@capgo/camera-preview)で動かす。
// Web(PWA)時は従来通り getUserMedia を使う。
const useNativeCam = !!CameraPreview;

// ネイティブ録画の状態
let nativeCamStarted = false;
let nativeVideoPath = null;   // stopRecordVideoで得た動画ファイルパス(file://)
let nativeExposureBias = 0;   // ネイティブカメラの露出補正(EV)
// 録画の状態機械: 'idle' | 'starting' | 'recording' | 'stopping'
// 開始/停止の非同期処理中の多重操作・状態競合を防ぐ。
let recState = 'idle';
let recFinalizedForCurrent = false;

async function playShutterSound() {
  if (!ShutterSound) return true;
  try {
    await ShutterSound.play();
    return true;
  } catch (e) {
    debugLog('Failed to play the app shutter sound');
    showToast('撮影音の再生に失敗しました', 5000);
    return false;
  }
}

function updateCaptureSoundStatus() {
  if (nativeShutterAlwaysAudible) {
    captureSoundStatus.textContent = 'iPad：撮影音あり';
    return;
  }
  captureSoundStatus.textContent = nativeShutterSuppressionSupported
    ? 'iPhone：マナーモード連動'
    : 'iPhone：マナーモード連動（静音撮影）';
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function beginFrontScreenFlash() {
  const shouldUseScreenFlash = useNativeCam
    ? nativeFlashTarget === 'screen'
    : currentFacing === 'user';
  if (!flashOn || !shouldUseScreenFlash) return false;

  shutterFlash.classList.add('screen-flash-active');
  if (ShutterSound) {
    try { await ShutterSound.beginScreenFlash(); } catch (_) {}
  }
  // Give the display light and the front camera's auto exposure time to settle.
  await wait(250);
  return true;
}

async function endFrontScreenFlash(active) {
  if (!active) return;
  shutterFlash.classList.remove('screen-flash-active');
  shutterFlash.style.opacity = '0';
  if (ShutterSound) {
    try { await ShutterSound.endScreenFlash(); } catch (_) {}
  }
}

function updateFlashUIForCamera() {
  const usesScreenFlash = useNativeCam
    ? nativeFlashTarget === 'screen'
    : currentFacing === 'user';
  flashLabel.textContent = usesScreenFlash ? '画面フラッシュ' : 'フラッシュ';
  flashBtn.setAttribute('aria-label', usesScreenFlash ? '画面フラッシュ' : 'フラッシュ');
}

async function syncNativeFacingFromDevice() {
  if (!useNativeCam) return currentFacing;
  try {
    const [{ deviceId }, { devices }] = await Promise.all([
      CameraPreview.getDeviceId(),
      CameraPreview.getAvailableDevices()
    ]);
    const activeDevice = devices?.find(device => device.deviceId === deviceId);
    if (activeDevice?.position === 'front') currentFacing = 'user';
    if (activeDevice?.position === 'rear') currentFacing = 'environment';
  } catch (e) {
    // Keep the last known value on older plugin/device combinations.
    debugLog('Unable to synchronize active camera position');
  }
  return currentFacing;
}

async function refreshNativeFlashTarget() {
  if (!useNativeCam) return currentFacing === 'user' ? 'screen' : 'torch';

  const facing = await syncNativeFacingFromDevice();
  if (facing === 'user') {
    nativeFlashTarget = 'screen';
    updateFlashUIForCamera();
    return nativeFlashTarget;
  }

  try {
    const { result = [] } = await CameraPreview.getSupportedFlashModes();
    if (result.includes('torch')) nativeFlashTarget = 'torch';
    else if (result.includes('on')) nativeFlashTarget = 'on';
    else nativeFlashTarget = 'screen';
  } catch (e) {
    // Rear iPhones normally support torch. Preserve the prior behavior if the
    // capability query itself is unavailable.
    nativeFlashTarget = 'torch';
    debugLog('Unable to read supported flash modes');
  }
  updateFlashUIForCamera();
  return nativeFlashTarget;
}

// ネイティブプレビューを撮影画面全体に敷く（UIは透過したWebViewが上に重なる）。
// width/height/x/y は省略しプラグインのフルスクリーン既定に任せる（座標のズレ回避）。
function nativeStartOptions() {
  return {
    position: currentFacing === 'user' ? 'front' : 'rear',
    toBack: true,          // HTML(UI)を前面、カメラプレビューを背面に
    disableAudio: false,   // 動画に音声を含めるためマイクも有効化
    storeToFile: false,    // capture()はbase64で返す（トリミングのため）
    enableHighResolution: true
  };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const recordingIndicator = document.getElementById('recording-indicator');
const recordingTimeEl    = document.getElementById('recording-time');

const cameraScreen   = document.getElementById('camera-screen');
const previewScreen  = document.getElementById('preview-screen');
const previewImage   = document.getElementById('preview-image');
const previewVideo   = document.getElementById('preview-video');
const shareBtn       = document.getElementById('share-btn');
const saveBtn        = document.getElementById('save-btn');
const retakeBtn      = document.getElementById('retake-btn');

// ── Camera init ────────────────────────────────────────

async function initCamera() {
  if (useNativeCam) {
    return initNativeCamera();
  }

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  const videoConstraints = {
    facingMode: currentFacing,
    width:  { ideal: 3840 },
    height: { ideal: 2160 }
  };

  try {
    // まず音声ありで取得を試みる（動画に音声を含めるため）。
    // マイク拒否や非対応の場合は映像のみで再取得し、カメラ自体は止めない。
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true });
    } catch (audioErr) {
      stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
    }
    video.srcObject = stream;

    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities ? track.getCapabilities() : {};

    // Flash
    flashSupported = currentFacing === 'user' || !!caps.torch;
    flashBtn.classList.toggle('disabled', !flashSupported);
    updateFlashUIForCamera();
    if (!flashSupported && flashOn) {
      flashOn = false;
      flashBtn.classList.remove('active');
    }

    // Hardware zoom
    if (caps.zoom) {
      hwZoomSupported = true;
      zoomMin = caps.zoom.min || 1;
      zoomMax = Math.min(caps.zoom.max || 5, 10);
      zoomSlider.min   = zoomMin;
      zoomSlider.max   = zoomMax;
      zoomSlider.step  = 0.1;
      zoomSlider.value = zoomMin;
      zoomValue = zoomMin;
    } else {
      hwZoomSupported = false;
      zoomSlider.min   = 1;
      zoomSlider.max   = 5;
      zoomSlider.step  = 0.1;
      zoomSlider.value = 1;
      zoomValue = 1;
    }

    // Mirror front camera
    video.style.transform = currentFacing === 'user' ? 'scaleX(-1)' : '';
    captureSoundStatus.textContent = 'ブラウザ撮影';

    // Apply ratio box after stream layout settles
    requestAnimationFrame(applyRatioBox);

  } catch (err) {
    debugLog('Unable to initialize the browser camera');
    showToast('カメラへのアクセスが許可されていません');
  }
}

// ── Native camera (iOS: @capgo/camera-preview) ─────────

async function initNativeCamera() {
  // 既存プレビューを止めてから開始（切替時の二重起動を防ぐ）
  try { await CameraPreview.stop({ force: true }); } catch (_) {}
  nativeCamStarted = false;
  // 撮影画面の背面にネイティブプレビューを出すため、UI側を透過にする
  document.documentElement.classList.add('native-cam');
  document.body.classList.add('native-cam');
  try {
    await CameraPreview.start(nativeStartOptions());
    nativeCamStarted = true;
    await refreshNativeFlashTarget();
    try {
      const support = await CameraPreview.getShutterSoundSuppressionSupport();
      nativeShutterSuppressionSupported = support?.supported === true;
    } catch (e) {
      nativeShutterSuppressionSupported = false;
      debugLog('Unable to read shutter-sound suppression support');
    }
    try {
      const policy = await ShutterSound.getPlaybackPolicy();
      nativeShutterAlwaysAudible = policy?.alwaysAudible === true;
    } catch (e) {
      nativeShutterAlwaysAudible = false;
      debugLog('Unable to read shutter-sound playback policy');
    }
    updateCaptureSoundStatus();
    // フラッシュはネイティブで制御。既定OFF。
    flashSupported = true;
    flashBtn.classList.remove('disabled');
    updateFlashUIForCamera();
    // ズームは setZoom で制御。スライダー範囲を設定。
    hwZoomSupported = true;
    try {
      const z = await CameraPreview.getZoom();
      zoomMin = z.min ?? 1;
      zoomMax = Math.min(z.max ?? 5, 10);
    } catch (_) { zoomMin = 1; zoomMax = 5; }
    zoomSlider.min = zoomMin;
    zoomSlider.max = zoomMax;
    zoomSlider.step = 0.1;
    zoomSlider.value = zoomMin;
    zoomValue = zoomMin;

    // ネイティブではCSSフィルターではなく、カメラ自体の露出補正を使う。
    // これによりライブプレビュー・写真・動画のすべてへ同じ明るさが反映される。
    try {
      const exposure = await CameraPreview.getExposureCompensationRange();
      const exposureMin = exposure.min ?? -2;
      const exposureMax = exposure.max ?? 2;
      nativeExposureBias = Math.min(exposureMax, Math.max(exposureMin, nativeExposureBias));
      brightnessSlider.min = exposureMin;
      brightnessSlider.max = exposureMax;
      brightnessSlider.step = exposure.step || 0.1;
      brightnessSlider.value = nativeExposureBias;
      await CameraPreview.setExposureCompensation({ value: nativeExposureBias });
    } catch (_) {
      // 露出補正を取得できない端末でも、カメラの基本機能は継続する。
      brightnessSlider.min = -2;
      brightnessSlider.max = 2;
      brightnessSlider.step = 0.1;
      brightnessSlider.value = 0;
    }
  } catch (err) {
    debugLog('Native camera initialization failed');
    showToast('カメラの起動に失敗しました', 8000);
  }
}

// ── Photo capture (silent) ─────────────────────────────

function capturePhoto() {
  if (useNativeCam) { captureNativePhoto(); return; }

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  // Crop to selected aspect ratio
  const RATIO_MAP = { '1-1': 1, '3-4': 3/4, '9-16': 9/16 };
  let cropW = vw, cropH = vh;

  if (currentRatio !== 'full') {
    const target = RATIO_MAP[currentRatio];
    if (target > vw / vh) {
      cropW = vw;
      cropH = Math.round(vw / target);
    } else {
      cropH = vh;
      cropW = Math.round(vh * target);
    }
  }

  const sx = Math.round((vw - cropW) / 2);
  const sy = Math.round((vh - cropH) / 2);

  captureCanvas.width  = cropW;
  captureCanvas.height = cropH;
  const ctx = captureCanvas.getContext('2d');

  ctx.save();
  ctx.filter = `brightness(${brightnessValue})`;

  if (currentFacing === 'user') {
    ctx.translate(cropW, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
  ctx.restore();

  captureCanvas.toBlob(blob => {
    setCapture('photo', blob, 'image/jpeg');
    flashShutter();
    playShutterSound();
    // 連写中はプレビューへ遷移せずカメラ画面に留まる（最後の1枚のみ pointerup で表示）
    if (!isBurst) showPreview();
  }, 'image/jpeg', 0.95);
}

// ネイティブ写真撮影:
// - 抑制API対応時はAVCapturePhotoOutputを使い、内蔵音を抑制する。
// - 非対応時はAVCaptureVideoDataOutputの現在フレームを保存し、内蔵音を発生させない。
// どちらもアプリ側の撮影音を使う。iPhoneは消音設定に従い、iPadは常に再生する。
async function captureNativePhoto() {
  let frontScreenFlashActive = false;
  try {
    await refreshNativeFlashTarget();
    frontScreenFlashActive = await beginFrontScreenFlash();
    await playShutterSound();
    const captureResult = nativeShutterSuppressionSupported
      ? await CameraPreview.capture({
          quality: 100,
          photoQualityPrioritization: 'balanced',
          mirrorFrontCamera: currentFacing === 'user',
          withExifLocation: false,
          embedLocation: false,
          suppressShutterSound: true
        })
      : await CameraPreview.captureSample({
          quality: 100,
          mirrorFrontCamera: currentFacing === 'user'
        });
    const { value, shutterSoundSuppressed } = captureResult;
    await endFrontScreenFlash(frontScreenFlashActive);
    frontScreenFlashActive = false;
    if (nativeShutterSuppressionSupported && shutterSoundSuppressed !== true) {
      nativeShutterSuppressionSupported = false;
      updateCaptureSoundStatus();
    }
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const RATIO_MAP = { '1-1': 1, '3-4': 3 / 4, '9-16': 9 / 16 };
      let cropW = iw, cropH = ih;
      if (currentRatio !== 'full') {
        const target = RATIO_MAP[currentRatio];
        if (target > iw / ih) { cropW = iw; cropH = Math.round(iw / target); }
        else { cropH = ih; cropW = Math.round(ih * target); }
      }
      const sx = Math.round((iw - cropW) / 2);
      const sy = Math.round((ih - cropH) / 2);
      captureCanvas.width = cropW;
      captureCanvas.height = cropH;
      const ctx = captureCanvas.getContext('2d');
      // 前面カメラの左右反転はプラグイン側で処理済みのため、ここでは反転しない
      ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
      captureCanvas.toBlob(blob => {
        setCapture('photo', blob, 'image/jpeg');
        flashShutter();
        if (!isBurst) showPreview();
      }, 'image/jpeg', 0.95);
    };
    img.onerror = () => showToast('撮影画像の読み込みに失敗しました');
    img.src = 'data:image/jpeg;base64,' + value;
  } catch (e) {
    await endFrontScreenFlash(frontScreenFlashActive);
    debugLog('Native photo capture failed');
    showToast('撮影に失敗しました', 6000);
  }
}

function flashShutter() {
  // ガイドライン2.5.14対応: 撮影(=記録)したことを視覚的に明示する。
  // マナーモード中も、白フラッシュと明示メッセージで撮影を通知する。
  const captureIndicator = document.getElementById('photo-capture-indicator');
  shutterFlash.style.opacity = '0.7';
  setTimeout(() => { shutterFlash.style.opacity = '0'; }, 150);
  cameraScreen.classList.add('photo-captured');
  clearTimeout(flashShutter.frameTimer);
  flashShutter.frameTimer = setTimeout(() => {
    cameraScreen.classList.remove('photo-captured');
  }, 1500);
  // Keep an explicit, non-configurable in-app indication visible long enough
  // to be perceived even when the photo preview opens immediately.
  captureIndicator.classList.remove('hidden');
  clearTimeout(flashShutter.indicatorTimer);
  flashShutter.indicatorTimer = setTimeout(() => {
    captureIndicator.classList.add('hidden');
  }, 1500);
}

// ── Flash ──────────────────────────────────────────────

async function toggleFlash() {
  if (useNativeCam) {
    if (cameraFlipInProgress) {
      showToast('カメラの切り替え完了後に操作してください');
      return;
    }
    if (flashToggleInProgress) return;
    flashToggleInProgress = true;
    const previousFlashOn = flashOn;
    try {
      const target = await refreshNativeFlashTarget();
      flashOn = !previousFlashOn;
      flashBtn.classList.toggle('active', flashOn);
      if (target === 'screen') {
        showToast(`画面フラッシュ ${flashOn ? 'ON' : 'OFF'}`);
        return;
      }
      await CameraPreview.setFlashMode({ flashMode: flashOn ? target : 'off' });
    } catch (e) {
      showToast('フラッシュの切り替えに失敗しました');
      flashOn = previousFlashOn;
      flashBtn.classList.toggle('active', flashOn);
    } finally {
      flashToggleInProgress = false;
    }
    return;
  }
  if (currentFacing === 'user') {
    flashOn = !flashOn;
    flashBtn.classList.toggle('active', flashOn);
    showToast(`画面フラッシュ ${flashOn ? 'ON' : 'OFF'}`);
    return;
  }
  if (!flashSupported) {
    showToast('このデバイスはフラッシュに非対応です');
    return;
  }
  flashOn = !flashOn;
  flashBtn.classList.toggle('active', flashOn);
  const track = stream.getVideoTracks()[0];
  try {
    await track.applyConstraints({ advanced: [{ torch: flashOn }] });
  } catch (e) {
    showToast('フラッシュの切り替えに失敗しました');
    flashOn = !flashOn;
    flashBtn.classList.toggle('active', flashOn);
  }
}

// ── Camera flip ────────────────────────────────────────

async function flipCamera() {
  if (cameraFlipInProgress) return;
  cameraFlipInProgress = true;
  flipBtn.classList.add('disabled');

  // Turn off the rear torch before switching, while preserving the user's
  // ON/OFF selection for the destination camera.
  if (flashOn && (useNativeCam ? nativeFlashTarget !== 'screen' : currentFacing === 'environment')) {
    try {
      if (useNativeCam) await CameraPreview.setFlashMode({ flashMode: 'off' });
      else {
        const track = stream?.getVideoTracks()[0];
        if (track) await track.applyConstraints({ advanced: [{ torch: false }] });
      }
    } catch (_) {}
  }
  currentFacing = currentFacing === 'environment' ? 'user' : 'environment';
  updateFlashUIForCamera();

  if (useNativeCam) {
    try {
      await CameraPreview.flip();
    } catch (e) {
      // flipが使えない場合はプレビューを再起動して切替
      await initNativeCamera();
    }
    await refreshNativeFlashTarget();
    try { await applyBrightness(nativeExposureBias); } catch (_) {}
    if (flashOn && nativeFlashTarget !== 'screen') {
      try {
        await CameraPreview.setFlashMode({ flashMode: nativeFlashTarget });
      } catch (_) {
        flashOn = false;
        flashBtn.classList.remove('active');
        showToast('フラッシュの切り替えに失敗しました');
      }
    }
    cameraFlipInProgress = false;
    flipBtn.classList.remove('disabled');
    return;
  }
  try {
    await initCamera();
    if (flashOn && currentFacing === 'environment') {
      try {
        const track = stream?.getVideoTracks()[0];
        if (track) await track.applyConstraints({ advanced: [{ torch: true }] });
      } catch (_) {
        flashOn = false;
        flashBtn.classList.remove('active');
        showToast('フラッシュの切り替えに失敗しました');
      }
    }
  } finally {
    cameraFlipInProgress = false;
    flipBtn.classList.remove('disabled');
  }
}

// ── Timer ──────────────────────────────────────────────

const TIMER_CYCLE = [0, 3, 5, 10];

function cycleTimer() {
  const idx = TIMER_CYCLE.indexOf(timerValue);
  timerValue = TIMER_CYCLE[(idx + 1) % TIMER_CYCLE.length];
  timerBtn.querySelector('.label').textContent = timerValue === 0 ? 'タイマー' : `${timerValue}s`;
  timerBtn.classList.toggle('active', timerValue !== 0);
}

function shootWithTimer() {
  if (timerValue === 0) {
    capturePhoto();
    return;
  }
  let remaining = timerValue;
  countdownEl.textContent = remaining;
  countdownEl.style.display = 'flex';

  countdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      countdownEl.style.display = 'none';
      capturePhoto();
    } else {
      countdownEl.textContent = remaining;
    }
  }, 1000);
}

// ── Shutter UI ─────────────────────────────────────────

const ICON_PHOTO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" fill="#1a1a1a"/>
  <circle cx="12" cy="13" r="4" fill="rgba(255,255,255,0.6)"/>
  <circle cx="12" cy="13" r="2.4" fill="none" stroke="#1a1a1a" stroke-width="1"/>
</svg>`;

const ICON_VIDEO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
  <rect x="1" y="5" width="14" height="14" rx="2.5" fill="#fff"/>
  <polygon points="16,8.5 23,6 23,18 16,15.5" fill="#fff"/>
</svg>`;

const ICON_STOP = `<svg viewBox="0 0 24 24" width="28" height="28">
  <rect x="5" y="5" width="14" height="14" rx="3" fill="#fff"/>
</svg>`;

function updateShutterUI() {
  if (currentMode === 'photo') {
    shutterBtn.classList.remove('video-mode');
    shutterIcon.innerHTML = ICON_PHOTO;
  } else {
    shutterBtn.classList.add('video-mode');
    shutterIcon.innerHTML = isRecording ? ICON_STOP : ICON_VIDEO;
  }
}

// ── Mode switcher ──────────────────────────────────────

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (mode === currentMode) return;
    if (useNativeCam) {
      // 録画の開始/録画中/停止処理中はモード切替を無効（開始中に切り替わる競合を防ぐ）。
      // 録画を止めたい場合はシャッターで停止してから切り替える。
      if (recState !== 'idle') return;
    } else {
      if (isRecording) stopRecording();
    }
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    updateShutterUI();
  });
});

// ── Burst mode ─────────────────────────────────────────

shutterBtn.addEventListener('pointerdown', () => {
  if (currentMode === 'video') return;
  if (isRecording) return;
  if (useNativeCam) return; // ネイティブのcapture()は非同期で連写に不向きなため連写は無効
  burstTimer = setTimeout(() => {
    isBurst = true;
    shutterBtn.classList.add('burst-mode');
    capturePhoto();
    burstInterval = setInterval(capturePhoto, 400);
  }, 600);
});

shutterBtn.addEventListener('pointerup', () => {
  if (currentMode === 'video') {
    toggleRecording();
    return;
  }
  clearTimeout(burstTimer);
  if (isBurst) {
    clearInterval(burstInterval);
    shutterBtn.classList.remove('burst-mode');
    isBurst = false;
    // 連写終了時に最後の1枚をプレビュー表示する
    if (capturedUrl) showPreview();
  } else {
    if (!isRecording) shootWithTimer();
  }
});

shutterBtn.addEventListener('pointercancel', () => {
  if (currentMode === 'video') return;
  clearTimeout(burstTimer);
  clearInterval(burstInterval);
  shutterBtn.classList.remove('burst-mode');
  isBurst = false;
});

// ── Zoom ───────────────────────────────────────────────

zoomSlider.addEventListener('input', () => {
  zoomValue = parseFloat(zoomSlider.value);
  applyZoom(zoomValue);
});

async function applyZoom(val) {
  if (useNativeCam) {
    try { await CameraPreview.setZoom({ level: val, ramp: false }); } catch (_) {}
    return;
  }
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  if (hwZoomSupported) {
    try {
      await track.applyConstraints({ advanced: [{ zoom: val }] });
      return;
    } catch (_) {}
  }
  // CSS fallback (does NOT affect canvas capture)
  const origin = currentFacing === 'user' ? 'right center' : 'center';
  video.style.transformOrigin = origin;
  video.style.transform = `${currentFacing === 'user' ? 'scaleX(-1) ' : ''}scale(${val})`;
}

// Pinch zoom
let pinchStart = 0;
let zoomAtPinchStart = 1;

viewfinder.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    // スライダー操作中はピンチズームを発火させない
    if (e.target.tagName === 'INPUT') return;
    pinchStart = pinchDist(e.touches);
    zoomAtPinchStart = zoomValue;
    e.preventDefault();
  }
}, { passive: false });

viewfinder.addEventListener('touchmove', e => {
  if (e.touches.length === 2) {
    const dist = pinchDist(e.touches);
    const scale = dist / pinchStart;
    const newZoom = Math.min(parseFloat(zoomSlider.max), Math.max(parseFloat(zoomSlider.min), zoomAtPinchStart * scale));
    zoomValue = newZoom;
    zoomSlider.value = newZoom;
    applyZoom(newZoom);
    e.preventDefault();
  }
}, { passive: false });

function pinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── Brightness ─────────────────────────────────────────

brightnessSlider.addEventListener('input', () => {
  const value = parseFloat(brightnessSlider.value);
  if (useNativeCam) {
    nativeExposureBias = value;
    applyBrightness(value);
  } else {
    brightnessValue = value;
    video.style.filter = `brightness(${brightnessValue})`;
  }
});

async function applyBrightness(value) {
  if (!useNativeCam) return;
  try {
    await CameraPreview.setExposureCompensation({ value });
  } catch (_) {
    // スライダー操作中の一時的な失敗は次のinputで再試行される。
  }
}

// ── Grid ───────────────────────────────────────────────

function toggleGrid() {
  gridVisible = !gridVisible;
  gridBtn.classList.toggle('active', gridVisible);
  gridCanvas.style.display = gridVisible ? 'block' : 'none';
  if (gridVisible) drawGrid();
}

function drawGrid() {
  const w = gridCanvas.offsetWidth;
  const h = gridCanvas.offsetHeight;
  if (!w || !h) return;
  gridCanvas.width  = w;
  gridCanvas.height = h;
  const ctx = gridCanvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(w * i / 3, 0); ctx.lineTo(w * i / 3, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h * i / 3); ctx.lineTo(w, h * i / 3); ctx.stroke();
  }
}

window.addEventListener('resize', () => {
  if (gridVisible) drawGrid();
  applyRatioBox();
});

// ── Video recording ────────────────────────────────────

function toggleRecording() {
  isRecording ? stopRecording() : startRecording();
}

async function startRecording() {
  if (useNativeCam) {
    if (recState !== 'idle') return; // 開始/停止処理中の多重操作を防ぐ
    recState = 'starting';
    try {
      // disableAudio:false でマイクを含めて録画（@capgoが録画前にマイクを再取得する）
      await CameraPreview.startRecordVideo({ disableAudio: false });
      recState = 'recording';
      recFinalizedForCurrent = false;
      isRecording = true;
      updateShutterUI();
      startRecordingIndicator();
    } catch (e) {
      recState = 'idle';
      stopRecordingIndicator();
      debugLog('Native recording start failed');
      showToast('録画を開始できませんでした', 6000);
    }
    return;
  }

  recordedChunks = [];
  const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType });
  } catch (_) {
    mediaRecorder = new MediaRecorder(stream);
  }
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    const mime = mediaRecorder.mimeType || mimeType;
    const blob = new Blob(recordedChunks, { type: mime });
    setCapture('video', blob, mime);
    showPreview();
  };
  mediaRecorder.start(200);
  isRecording = true;
  updateShutterUI();
  startRecordingIndicator();
}

async function stopRecording() {
  if (useNativeCam) {
    if (recState !== 'recording') return; // 録画中以外は無視（多重停止防止）
    recState = 'stopping';
    try {
      // 手動停止では戻り値とrecordingFinishedイベントの両方が発火する。
      // 戻り値をフォールバックの最終処理に使う（イベントが先なら二重処理はガードされる）。
      const res = await CameraPreview.stopRecordVideo();
      if (res && res.videoFilePath) onNativeRecordingFinished(res.videoFilePath);
    } catch (e) {
      // stopRecordVideoの拒否は「録画がエラー終了した」or「既に録画していない」を意味する
      // （recStateガードで多重停止は起きないため、録画継続中の拒否は実質発生しない）。
      // 録画中UIのまま固まらないよう、失敗として終了処理する。
      debugLog('Native recording stop failed');
      showToast('録画に失敗しました', 6000);
      onNativeRecordingFinished(null);
    }
    return;
  }

  mediaRecorder.stop();
  isRecording = false;
  updateShutterUI();
  stopRecordingIndicator();
}

// ネイティブ録画の終了処理（手動停止・自動終了の両方を一元化）。
// recordingFinished イベントから呼ばれ、二重処理をガードする。
function onNativeRecordingFinished(path) {
  if (recFinalizedForCurrent) return;
  recFinalizedForCurrent = true;
  recState = 'idle';
  isRecording = false;
  updateShutterUI();
  stopRecordingIndicator();
  if (!path) { showToast('録画に失敗しました'); return; }
  if (capturedUrl && capturedBlob) URL.revokeObjectURL(capturedUrl);
  nativeVideoPath = path;
  capturedType = 'video';
  capturedMime = 'video/mp4';
  capturedBlob = null; // ネイティブ動画はファイルパスで扱う
  capturedUrl = (window.Capacitor && window.Capacitor.convertFileSrc)
    ? window.Capacitor.convertFileSrc(path)
    : path;
  thumbnailImg.classList.remove('visible');
  thumbnailImg.src = '';
  thumbnailBtn.dataset.type = 'video';
  showPreview();
}

// ── Recording indicator (視覚的な記録中表示) ───────────

function startRecordingIndicator() {
  recordingSeconds = 0;
  recordingTimeEl.textContent = '00:00';
  recordingIndicator.classList.remove('hidden');
  cameraScreen.classList.add('recording-active');
  if (ShutterSound) {
    ShutterSound.setRecordingActive({ active: true }).catch(e => {
      debugLog('Failed to disable the idle timer while recording');
      showToast('録画中の画面維持を有効にできませんでした', 5000);
    });
  }
  recordingTimer = setInterval(() => {
    recordingSeconds++;
    const m = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
    const s = String(recordingSeconds % 60).padStart(2, '0');
    recordingTimeEl.textContent = `${m}:${s}`;
  }, 1000);
}

function stopRecordingIndicator() {
  clearInterval(recordingTimer);
  recordingIndicator.classList.add('hidden');
  cameraScreen.classList.remove('recording-active');
  if (ShutterSound) {
    ShutterSound.setRecordingActive({ active: false }).catch(e => {
      debugLog('Failed to restore the idle timer after recording');
    });
  }
}

// ── Capture management ─────────────────────────────────

function setCapture(type, blob, mime) {
  if (capturedUrl) URL.revokeObjectURL(capturedUrl);
  capturedBlob = blob;
  capturedType = type;
  capturedMime = mime || (type === 'photo' ? 'image/jpeg' : 'video/mp4');
  capturedUrl = URL.createObjectURL(blob);

  // Thumbnail
  if (type === 'photo') {
    thumbnailImg.src = capturedUrl;
    thumbnailImg.classList.add('visible');
    thumbnailBtn.dataset.type = 'photo';
  } else {
    thumbnailImg.classList.remove('visible');
    thumbnailImg.src = '';
    thumbnailBtn.dataset.type = 'video';
  }
}

// ── Preview ────────────────────────────────────────────

function showPreview() {
  cameraScreen.classList.add('hidden');
  previewScreen.classList.remove('hidden');

  if (capturedType === 'photo') {
    previewImage.src = capturedUrl;
    previewImage.classList.add('visible');
    previewVideo.classList.remove('visible');
    previewVideo.pause();
  } else {
    // 動画ファイルを後で削除しても撮影履歴を表示できるよう、
    // 読み込み完了時に1フレームを静止画サムネイルとして保持する。
    previewVideo.addEventListener('loadeddata', captureVideoThumbnail, { once: true });
    previewVideo.src = capturedUrl;
    previewVideo.classList.add('visible');
    previewImage.classList.remove('visible');
    previewVideo.loop = true;
    previewVideo.muted = true;
    previewVideo.play().catch(() => {});
  }
}

function captureVideoThumbnail() {
  if (capturedType !== 'video' || previewVideo.readyState < 2) return;
  const vw = previewVideo.videoWidth;
  const vh = previewVideo.videoHeight;
  if (!vw || !vh) return;

  // サムネイル枠に合わせて中央を正方形に切り出す。
  const side = Math.min(vw, vh);
  const sx = Math.round((vw - side) / 2);
  const sy = Math.round((vh - side) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  try {
    ctx.drawImage(previewVideo, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
    thumbnailImg.src = canvas.toDataURL('image/jpeg', 0.82);
    thumbnailImg.classList.add('visible');
    thumbnailBtn.dataset.type = 'video';
  } catch (_) {
    // フレーム取得に失敗しても、保存・共有・カメラ復帰は継続する。
  }
}

thumbnailBtn.addEventListener('click', () => {
  if (capturedUrl) showPreview();
});

// ── 共通：ファイル生成・ダウンロード ───────────────────

function fallbackDownload(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast('ダウンロードしました');
}

function buildFile() {
  const ext = capturedType === 'photo' ? 'jpg' : (capturedMime?.includes('webm') ? 'webm' : 'mp4');
  const fileName = `photo_${Date.now()}.${ext}`;
  return new File([capturedBlob], fileName, { type: capturedMime });
}

// ── 保存 ───────────────────────────────────────────────

saveBtn.addEventListener('click', async () => {
  // ネイティブ動画はファイルパスで保存（base64を経由しないので大きい動画も安全）
  if (useNativeCam && capturedType === 'video' && nativeVideoPath) {
    try {
      await PhotoSaver.saveFile({ path: nativeVideoPath, type: 'video' });
      showToast('写真ライブラリに保存しました');
      returnToCamera();
    } catch (e) {
      debugLog('Native video save failed');
      showToast('保存に失敗しました', 8000);
    }
    return;
  }

  if (!capturedBlob) return;

  // ネイティブアプリ環境：共有シートを介さず直接フォトライブラリに保存（写真）
  if (PhotoSaver) {
    try {
      const base64 = await blobToBase64(capturedBlob);
      await PhotoSaver.save({ data: base64, type: capturedType });
      showToast('写真ライブラリに保存しました');
      returnToCamera(); // 保存後は自動でカメラに戻る
    } catch (e) {
      debugLog('Native photo save failed');
      showToast('保存に失敗しました', 8000);
    }
    return;
  }

  const file = buildFile();
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // ① File 共有 API（iOS 15+ / Android Chrome）
  const canShareFiles = navigator.canShare && (() => {
    try { return navigator.canShare({ files: [file] }); } catch (_) { return false; }
  })();

  if (canShareFiles) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  // ② iOS フォールバック：新タブで画像を開き長押し保存を案内
  if (isIOS) {
    window.open(capturedUrl, '_blank', 'noopener,noreferrer');
    showToast('画像を長押し →「写真に追加」で保存');
    return;
  }

  // ③ Android / Desktop：ダウンロード
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast('ダウンロードしました');
});

// ── 共有 ───────────────────────────────────────────────

shareBtn.addEventListener('click', async () => {
  // ネイティブ動画: ファイルパスを@capacitor/shareに渡す（動画をメモリに読み込まない）
  if (useNativeCam && capturedType === 'video' && nativeVideoPath && CapShare) {
    try {
      await CapShare.share({ title: 'ZERO Camera', files: [nativeVideoPath] });
      returnToCamera(); // 共有成功 → 一時ファイル削除してカメラへ戻る
    } catch (e) {
      // キャンセル・失敗時は動画を削除せずプレビューに留め、再共有/保存できるようにする。
      // キャンセルは無言、実エラーはトースト表示。
      const msg = ((e && e.message) || '') + '';
      if (!/cancel/i.test(msg)) showToast('共有に失敗しました', 4000);
    }
    return;
  }

  if (!capturedBlob) return;
  const ext = capturedType === 'photo' ? 'jpg' : 'mp4';
  const file = new File([capturedBlob], `zerocam_${Date.now()}.${ext}`, { type: capturedMime });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'ZERO Camera' });
      returnToCamera(); // 共有完了後は自動でカメラに戻る
      return;
    } catch (e) {
      if (e.name === 'AbortError') { returnToCamera(); return; }
    }
  }
  fallbackDownload(file);
});

// ── Retake / カメラ復帰 ────────────────────────────────

async function cleanupNativeVideo() {
  // 保存/共有/撮り直し後、録画一時ファイルを削除して蓄積を防ぐ
  const p = nativeVideoPath;
  if (!p) return;
  if (CameraPreview && CameraPreview.deleteFile) {
    try {
      await CameraPreview.deleteFile({ path: p });
      nativeVideoPath = null; // 削除成功時のみ参照をクリア
      if (capturedType === 'video' && !capturedBlob) capturedUrl = null;
    } catch (_) {
      // 削除失敗時は参照を保持し次回returnToCamera時に再試行できるようにする
      // （次の録画でonNativeRecordingFinishedが上書きするため蓄積は最小限）。
    }
  } else {
    nativeVideoPath = null;
  }
}

async function returnToCamera() {
  // 一時動画を削除する前に、現在表示中のフレームをサムネイルへ退避する。
  captureVideoThumbnail();
  previewVideo.pause();
  previewVideo.removeAttribute('src');
  previewScreen.classList.add('hidden');
  cameraScreen.classList.remove('hidden');

  if (useNativeCam) {
    // プレビューで参照していた録画一時ファイルを削除
    await cleanupNativeVideo();
    // ネイティブプレビューはプレビュー画面表示中も背面で動き続けているが、
    // 念のため停止していたら再起動する。
    try {
      const s = await CameraPreview.isRunning();
      if (!s?.isRunning) await initNativeCamera();
    } catch (_) { await initNativeCamera(); }
    return;
  }

  // 保存/共有中にiOSのシステムダイアログや共有シートが出ると、
  // getUserMediaの映像トラックが停止して画面が真っ暗になることがある。
  // トラックが生きていれば再生を再開、停止していれば再取得する。
  const track = stream && stream.getVideoTracks()[0];
  if (track && track.readyState === 'live') {
    video.play().catch(() => {});
  } else {
    initCamera();
  }
}

retakeBtn.addEventListener('click', returnToCamera);

// ── Toast ──────────────────────────────────────────────

let toastTimer = null;
function showToast(msg, duration = 2500) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ── Event bindings ─────────────────────────────────────

// ── Aspect ratio ───────────────────────────────────────

const RATIO_CYCLE  = ['1-1', '3-4', '9-16', 'full'];
const RATIO_LABELS = { '1-1': '1:1', '3-4': '3:4', '9-16': '9:16', 'full': '□' };
const RATIO_VALUES = { '1-1': 1/1, '3-4': 3/4, '9-16': 9/16 };

function applyRatioBox() {
  // Full mode: viewfinder covers entire screen, bars become overlays
  if (currentRatio === 'full') {
    cameraScreen.classList.add('ratio-full');
    ratioBox.style.width  = '100%';
    ratioBox.style.height = '100%';
    return;
  }

  cameraScreen.classList.remove('ratio-full');

  const vfW = viewfinder.offsetWidth;
  const vfH = viewfinder.offsetHeight;
  if (!vfW || !vfH) return;

  const target = RATIO_VALUES[currentRatio];
  const testH  = vfW / target;
  let boxW, boxH;
  if (testH <= vfH) {
    boxW = vfW;
    boxH = Math.round(testH);
  } else {
    boxH = vfH;
    boxW = Math.round(vfH * target);
  }

  ratioBox.style.width  = boxW + 'px';
  ratioBox.style.height = boxH + 'px';
}

function cycleRatio() {
  const idx = RATIO_CYCLE.indexOf(currentRatio);
  currentRatio = RATIO_CYCLE[(idx + 1) % RATIO_CYCLE.length];
  ratioBtn.querySelector('.ratio-label').textContent = RATIO_LABELS[currentRatio];
  applyRatioBox();
}

ratioBtn.addEventListener('click', cycleRatio);

flashBtn.addEventListener('click', toggleFlash);
timerBtn.addEventListener('click', cycleTimer);
gridBtn.addEventListener('click', toggleGrid);
flipBtn.addEventListener('click', flipCamera);

// Prevent default scroll/zoom on viewfinder
viewfinder.addEventListener('touchmove', e => {
  if (e.touches.length >= 2) e.preventDefault();
}, { passive: false });

// ── PWA install ────────────────────────────────────────
// Service Worker は Web(PWA)版のオフライン対応専用。
// ネイティブアプリ(Capacitor)ではアセットをローカルから読むため不要で、
// むしろ Cache First がアプリ更新後も古いJS/CSSを配信し続けるリスクがあるため登録しない。
if (!isNativeApp && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    debugLog('Service worker registration failed');
  });
}

// ── Start ──────────────────────────────────────────────

// ネイティブ録画の自動終了(maxDuration/OS割り込み等)や手動停止を一元処理するため、
// recordingFinished イベントを1回だけ購読する。
if (useNativeCam && CameraPreview.addListener) {
  CameraPreview.addListener('recordingFinished', (data) => {
    onNativeRecordingFinished(data && data.videoFilePath);
  });
}

// 画面が非表示になると、ユーザーが録画状態を視認できなくなるため録画を終了する。
document.addEventListener('visibilitychange', () => {
  if (document.hidden && isRecording) stopRecording();
});

// ガイドライン2.5.14対応: 初回起動時に「撮影表示は無効化できない・通常時は
// シャッター音が鳴る・消音撮影はシステムが許可する端末だけ」と明示し同意を得る。
// 同意後にカメラを起動する(=カメラ権限ダイアログも同意後に出る)。
const USAGE_NOTICE_KEY = 'zerocam-usage-notice-v2';

async function startCamera() {
  // 前回の異常終了でDocumentsに残ったネイティブ録画を、次の録画開始前に回収する。
  // startCameraは初回起動フローからだけ呼び出されるため、進行中の録画とは競合しない。
  if (PhotoSaver && PhotoSaver.cleanupOrphanedCaptures) {
    try {
      await PhotoSaver.cleanupOrphanedCaptures();
    } catch (_) {
      // 回収失敗でカメラを使用不能にはしない。次回のコールドスタートで再試行する。
      debugLog('Failed to clean up orphaned native recordings');
    }
  }
  await initCamera();
  // Apply initial ratio box size after first layout paint
  requestAnimationFrame(() => requestAnimationFrame(applyRatioBox));
}

let noticeAccepted = false;
try { noticeAccepted = !!localStorage.getItem(USAGE_NOTICE_KEY); } catch (e) {}

if (noticeAccepted) {
  startCamera();
} else {
  const noticeEl = document.getElementById('first-launch-notice');
  noticeEl.classList.remove('hidden');
  document.getElementById('first-launch-ok').addEventListener('click', () => {
    try { localStorage.setItem(USAGE_NOTICE_KEY, '1'); } catch (e) {}
    noticeEl.classList.add('hidden');
    startCamera();
  }, { once: true });
}
