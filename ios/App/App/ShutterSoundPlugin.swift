import Foundation
import Capacitor
import AVFoundation
import UIKit

/**
 * マナーモード連動シャッター音プラグイン。
 *
 * 実機検証の結果、AudioServicesPlaySystemSound(1108)（標準カメラのシャッター音ID）は
 * サイレントスイッチを無視して常に鳴ることが判明した（Appleが盗撮防止のため意図的に
 * 消せない設計にしている可能性が高い）。
 *
 * 独自の音声ファイル(shutter.wav)を AVAudioPlayer で再生する。
 * iPhone は .ambient でサイレントスイッチに従う一方、iPad は審査要件に合わせて
 * .playback を使い、消音設定にかかわらず撮影音を出す。
 * どちらの端末でも撮影フラッシュと「撮影しました」表示を必ず出す。
 */
@objc(ShutterSoundPlugin)
public class ShutterSoundPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShutterSoundPlugin"
    public let jsName = "ShutterSound"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPlaybackPolicy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginScreenFlash", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endScreenFlash", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setRecordingActive", returnType: CAPPluginReturnPromise)
    ]

    private var player: AVAudioPlayer?
    private var brightnessBeforeScreenFlash: CGFloat?

    // iPhone専用アプリをiPadの互換モードで実行した場合も物理端末を判定できるよう、
    // interface idiomに加えてUIDevice.modelも確認する。
    private var isIPadDevice: Bool {
        UIDevice.current.userInterfaceIdiom == .pad ||
            UIDevice.current.model.localizedCaseInsensitiveContains("iPad")
    }

    @objc func getPlaybackPolicy(_ call: CAPPluginCall) {
        call.resolve([
            "alwaysAudible": isIPadDevice,
            "device": isIPadDevice ? "iPad" : "iPhone"
        ])
    }

    @objc func play(_ call: CAPPluginCall) {
        guard let url = Bundle.main.url(forResource: "shutter", withExtension: "wav") else {
            call.reject("shutter.wav not found in app bundle")
            return
        }

        do {
            // iPadは消音設定にかかわらず再生し、iPhoneはサイレントスイッチに従う。
            let category: AVAudioSession.Category = isIPadDevice ? .playback : .ambient
            try AVAudioSession.sharedInstance().setCategory(category, options: [.mixWithOthers])
            // notifyOthersOnDeactivation is only valid while deactivating a session.
            // Passing it with setActive(true) is rejected by newer iOS versions,
            // which previously made the JS call fail silently before playback.
            try AVAudioSession.sharedInstance().setActive(true)

            player = try AVAudioPlayer(contentsOf: url)
            player?.prepareToPlay()
            guard player?.play() == true else {
                call.reject("Failed to start shutter sound playback")
                return
            }
            call.resolve()
        } catch {
            call.reject("Failed to play shutter sound: \(error.localizedDescription)")
        }
    }

    @objc func setRecordingActive(_ call: CAPPluginCall) {
        let active = call.getBool("active", false) ?? false
        DispatchQueue.main.async {
            // Guideline 2.5.14: the display must not go blank while video is
            // recording. Restore the normal idle-timer behavior immediately
            // after recording ends or fails.
            UIApplication.shared.isIdleTimerDisabled = active
            call.resolve(["active": active])
        }
    }

    @objc func beginScreenFlash(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.brightnessBeforeScreenFlash == nil {
                self.brightnessBeforeScreenFlash = UIScreen.main.brightness
            }
            UIScreen.main.brightness = 1.0
            call.resolve()
        }
    }

    @objc func endScreenFlash(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let previousBrightness = self.brightnessBeforeScreenFlash {
                UIScreen.main.brightness = previousBrightness
                self.brightnessBeforeScreenFlash = nil
            }
            call.resolve()
        }
    }
}
