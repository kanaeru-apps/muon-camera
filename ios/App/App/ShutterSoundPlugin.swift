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
 * 対策として、独自の音声ファイル(shutter.wav)を AVAudioPlayer で再生し、
 * AVAudioSession のカテゴリを .ambient に設定する方式に変更した。
 * .ambient はサイレントスイッチに従って自動的に消音されるカテゴリ。
 *
 * iPad（互換モード実行を含む）にはサイレントスイッチが存在せず「マナーモード連動」が
 * 成立しないため、.playback（消音設定を無視して再生されるカテゴリ）で常に音を鳴らす。
 * App Review はiPhone専用アプリをiPad互換モードで審査することがあり、ガイドライン
 * 2.5.14（記録中の聴覚的表示）をiPad上でも満たすための措置でもある。
 */
@objc(ShutterSoundPlugin)
public class ShutterSoundPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShutterSoundPlugin"
    public let jsName = "ShutterSound"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise)
    ]

    private var player: AVAudioPlayer?

    @objc func play(_ call: CAPPluginCall) {
        guard let url = Bundle.main.url(forResource: "shutter", withExtension: "wav") else {
            call.reject("shutter.wav not found in app bundle")
            return
        }

        do {
            // iPhone: .ambient＝本体サイレントスイッチに連動して消音される。
            // iPad: サイレントスイッチ非搭載のため .playback で常に再生する。
            let category: AVAudioSession.Category =
                UIDevice.current.userInterfaceIdiom == .pad ? .playback : .ambient
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
}
