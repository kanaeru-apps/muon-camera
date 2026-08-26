import Foundation
import Capacitor
import Photos

/**
 * 撮影した写真・動画を共有シートを介さず直接フォトライブラリに保存するプラグイン。
 *
 * JS側から Base64 エンコードしたデータと種別(photo/video)を受け取り、
 * PHPhotoLibrary.performChanges で直接カメラロールに追加する。
 * NSPhotoLibraryAddUsageDescription（Info.plist設定済み）が前提。
 */
@objc(PhotoSaverPlugin)
public class PhotoSaverPlugin: CAPPlugin, CAPBridgedPlugin {
    private let maxEncodedMediaSize = 96 * 1024 * 1024
    private let maxDecodedMediaSize = 72 * 1024 * 1024

    public let identifier = "PhotoSaverPlugin"
    public let jsName = "PhotoSaver"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cleanupOrphanedCaptures", returnType: CAPPluginReturnPromise)
    ]

    @objc func save(_ call: CAPPluginCall) {
        guard let base64 = call.getString("data") else {
            call.reject("Missing 'data' parameter")
            return
        }
        guard let type = call.getString("type"), type == "photo" || type == "video" else {
            call.reject("Missing or invalid 'type' parameter (expected 'photo' or 'video')")
            return
        }
        guard base64.utf8.count <= maxEncodedMediaSize else {
            call.reject("Media data is too large")
            return
        }
        guard let fileData = Data(base64Encoded: base64), fileData.count <= maxDecodedMediaSize else {
            call.reject("Invalid or oversized media data")
            return
        }
        guard hasExpectedSignature(fileData, type: type) else {
            call.reject("Media content does not match the declared type")
            return
        }

        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            switch status {
            case .authorized, .limited:
                if type == "photo" {
                    self.savePhoto(fileData, call: call)
                } else {
                    self.saveVideo(fileData, call: call)
                }
            case .denied, .restricted:
                call.reject("写真へのアクセスが拒否されています。設定＞ZERO Camera＞写真 を許可してください")
            case .notDetermined:
                call.reject("写真へのアクセス許可が未確定です。もう一度お試しください")
            @unknown default:
                call.reject("写真へのアクセス状態が不明です")
            }
        }
    }

    /**
     * ファイルパスから写真ライブラリへ保存する（ネイティブ録画の動画など、
     * base64をbridgeに通すと壊れる大きなファイル向け）。
     */
    @objc func saveFile(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else {
            call.reject("Missing 'path' parameter")
            return
        }
        guard let type = call.getString("type"), type == "photo" || type == "video" else {
            call.reject("Missing or invalid 'type' parameter")
            return
        }
        guard let fileURL = validatedCaptureFileURL(path: path, type: type) else {
            call.reject("File path is outside the camera capture directory")
            return
        }
        let isRegularFile = (try? fileURL.resourceValues(forKeys: [.isRegularFileKey]))?.isRegularFile == true
        guard FileManager.default.fileExists(atPath: fileURL.path), isRegularFile else {
            call.reject("Capture file does not exist or is not a regular file")
            return
        }

        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            switch status {
            case .authorized, .limited:
                PHPhotoLibrary.shared().performChanges({
                    if type == "video" {
                        PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: fileURL)
                    } else {
                        PHAssetChangeRequest.creationRequestForAssetFromImage(atFileURL: fileURL)
                    }
                }) { success, _ in
                    if success {
                        call.resolve()
                    } else {
                        call.reject("写真ライブラリへの保存に失敗しました")
                    }
                }
            case .denied, .restricted:
                call.reject("写真へのアクセスが拒否されています。設定＞ZERO Camera＞写真 を許可してください")
            default:
                call.reject("写真へのアクセス許可が未確定です。もう一度お試しください")
            }
        }
    }

    /**
     * 前回の異常終了などでDocuments直下に残ったネイティブ録画の一時ファイルを削除する。
     * 対象を通常ファイルかつ cpcp_video_*.mp4 に限定し、リンクは追跡しない。
     */
    @objc func cleanupOrphanedCaptures(_ call: CAPPluginCall) {
        guard let documentsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?
            .standardizedFileURL else {
            call.resolve(["removed": 0])
            return
        }

        let requestedKeys: Set<URLResourceKey> = [.isRegularFileKey, .isSymbolicLinkKey]
        let contents = (try? FileManager.default.contentsOfDirectory(
            at: documentsDirectory,
            includingPropertiesForKeys: Array(requestedKeys),
            options: [.skipsHiddenFiles]
        )) ?? []

        var removed = 0
        for fileURL in contents {
            let candidate = fileURL.standardizedFileURL
            let resourceValues = try? candidate.resourceValues(forKeys: requestedKeys)
            guard candidate.deletingLastPathComponent().path == documentsDirectory.path,
                  candidate.lastPathComponent.hasPrefix("cpcp_video_"),
                  candidate.pathExtension.lowercased() == "mp4",
                  resourceValues?.isRegularFile == true,
                  resourceValues?.isSymbolicLink != true else {
                continue
            }

            do {
                try FileManager.default.removeItem(at: candidate)
                removed += 1
            } catch {
                // Continue cleaning other known capture files. Do not expose or log
                // private file paths; a later cold start will retry failed removals.
            }
        }

        call.resolve(["removed": removed])
    }

    private func savePhoto(_ data: Data, call: CAPPluginCall) {
        PHPhotoLibrary.shared().performChanges({
            let request = PHAssetCreationRequest.forAsset()
            request.addResource(with: .photo, data: data, options: nil)
        }) { success, _ in
            if success {
                call.resolve()
            } else {
                call.reject("写真の保存に失敗しました")
            }
        }
    }

    private func saveVideo(_ data: Data, call: CAPPluginCall) {
        let tmpURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("mp4")

        do {
            try data.write(to: tmpURL)
        } catch {
            call.reject("動画の一時ファイルを作成できませんでした")
            return
        }

        PHPhotoLibrary.shared().performChanges({
            PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: tmpURL)
        }) { success, _ in
            try? FileManager.default.removeItem(at: tmpURL)
            if success {
                call.resolve()
            } else {
                call.reject("動画の保存に失敗しました")
            }
        }
    }

    private func hasExpectedSignature(_ data: Data, type: String) -> Bool {
        if type == "photo" {
            return data.starts(with: [0xFF, 0xD8, 0xFF])
        }
        guard data.count >= 12 else { return false }
        return data[4..<8].elementsEqual(Data("ftyp".utf8))
    }

    private func validatedCaptureFileURL(path: String, type: String) -> URL? {
        let rawURL: URL
        if path.hasPrefix("file://") {
            guard let parsedURL = URL(string: path), parsedURL.isFileURL else { return nil }
            rawURL = parsedURL
        } else {
            rawURL = URL(fileURLWithPath: path)
        }

        let candidate = rawURL.standardizedFileURL.resolvingSymlinksInPath()
        let searchDirectory: FileManager.SearchPathDirectory = type == "video" ? .documentDirectory : .cachesDirectory
        guard let baseDirectory = FileManager.default.urls(for: searchDirectory, in: .userDomainMask).first?
            .standardizedFileURL.resolvingSymlinksInPath() else { return nil }

        let expectedPrefix = type == "video" ? "cpcp_video_" : "cpcp_capture_"
        let expectedExtension = type == "video" ? "mp4" : "jpg"
        guard candidate.deletingLastPathComponent().path == baseDirectory.path,
              candidate.lastPathComponent.hasPrefix(expectedPrefix),
              candidate.pathExtension.lowercased() == expectedExtension else { return nil }
        return candidate
    }
}
