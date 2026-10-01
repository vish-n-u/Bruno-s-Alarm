import AVFoundation
import ExpoModulesCore
import Foundation
import SwiftUI
#if canImport(AlarmKit)
import ActivityKit
import AlarmKit
#endif

// Real iPhone alarms through Apple's AlarmKit (iOS 26+): they ring through silent mode and Focus,
// even after the app is swiped away or the phone restarts — the system rings them, not our app.
// The ringing screen is Apple's (title, time, app name, slide to stop, one extra button: Snooze).
//
// The JS side (lib/iosAlarms.ts) uses the app's own string ids everywhere ("bruno-session-<ms>",
// "bruno-custom-<id>-<ms>", …). AlarmKit wants UUIDs, so this keeps a UUID → app id map in
// UserDefaults.
//
// NOT YET COMPILED: written without a Mac. Expect small API fixes on the first EAS build.

struct ScheduleOptions: Record {
  /// The app's own id for this alarm.
  @Field var id: String = ""
  @Field var title: String = ""
  /// When it rings, in ms since 1970.
  @Field var timestamp: Double = 0
  /// A file in the app bundle or Library/Sounds, e.g. "bruno_alarm.caf". nil = system default.
  @Field var soundName: String? = nil
  @Field var snoozeMinutes: Int = 10
}

final class AlarmKitError: GenericException<String>, @unchecked Sendable {
  override var reason: String { param }
}

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct BrunoAlarmMetadata: AlarmMetadata {}
#endif

/// UUID (AlarmKit) → app id. Survives restarts so a ringing alarm can be matched after launch.
private enum IdStore {
  static let key = "BrunoAlarmKit.ids"

  static func all() -> [String: String] {
    UserDefaults.standard.dictionary(forKey: key) as? [String: String] ?? [:]
  }

  static func save(_ map: [String: String]) {
    UserDefaults.standard.set(map, forKey: key)
  }

  static func add(_ uuid: UUID, appId: String) {
    var map = all()
    map[uuid.uuidString] = appId
    save(map)
  }

  static func remove(_ uuid: UUID) {
    var map = all()
    map.removeValue(forKey: uuid.uuidString)
    save(map)
  }

  static func uuids(for appId: String) -> [UUID] {
    all().compactMap { $0.value == appId ? UUID(uuidString: $0.key) : nil }
  }
}

public class BrunoAlarmKitModule: Module {
  private var updatesTask: Task<Void, Never>?

  public func definition() -> ModuleDefinition {
    Name("BrunoAlarmKit")

    Events("onAlarmsChanged")

    Function("isSupported") { () -> Bool in
      if #available(iOS 26.0, *) { return true }
      return false
    }

    AsyncFunction("getAuthorizationState") { () async -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return Self.describe(AlarmManager.shared.authorizationState) }
      #endif
      return "unsupported"
    }

    AsyncFunction("requestAuthorization") { () async -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        do {
          return Self.describe(try await AlarmManager.shared.requestAuthorization())
        } catch {
          return Self.describe(AlarmManager.shared.authorizationState)
        }
      }
      #endif
      return "unsupported"
    }

    AsyncFunction("schedule") { (options: ScheduleOptions) async throws in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        try await Self.schedule(options)
        return
      }
      #endif
      throw AlarmKitError("Alarms need iOS 26 or newer")
    }

    AsyncFunction("cancel") { (appId: String) async in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        for uuid in IdStore.uuids(for: appId) {
          try? await AlarmManager.shared.cancel(id: uuid)
          IdStore.remove(uuid)
        }
      }
      #endif
    }

    AsyncFunction("stop") { (appId: String) async in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        for uuid in IdStore.uuids(for: appId) {
          try? await AlarmManager.shared.stop(id: uuid)
        }
      }
      #endif
    }

    // Snooze = AlarmKit's countdown: rings again after the snooze minutes given at scheduling.
    AsyncFunction("snooze") { (appId: String) async in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        for uuid in IdStore.uuids(for: appId) {
          try? await AlarmManager.shared.countdown(id: uuid)
        }
      }
      #endif
    }

    AsyncFunction("list") { () async -> [[String: Any]] in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let alarms = (try? await AlarmManager.shared.alarms) ?? []
        return Self.serialize(alarms, prune: true)
      }
      #endif
      return []
    }

    // Turns a downloaded recording (MP4) into an alarm sound in Library/Sounds and returns its
    // file name. Developers report iOS 26 ignoring sounds there (falls back to the default) —
    // this is what the first iPhone build tests. See PROJECT_GUIDE.md §11.
    AsyncFunction("prepareSound") { (source: String) async throws -> String in
      try await Self.prepareSound(source)
    }

    OnStartObserving {
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        self.updatesTask?.cancel()
        self.updatesTask = Task { [weak self] in
          for await alarms in AlarmManager.shared.alarmUpdates {
            guard let self else { return }
            self.sendEvent("onAlarmsChanged", ["alarms": Self.serialize(alarms, prune: false)])
          }
        }
      }
      #endif
    }

    OnStopObserving {
      self.updatesTask?.cancel()
      self.updatesTask = nil
    }
  }

  // MARK: - AlarmKit

  #if canImport(AlarmKit)
  @available(iOS 26.0, *)
  private static func schedule(_ options: ScheduleOptions) async throws {
    // Same app id again = replace it.
    for uuid in IdStore.uuids(for: options.id) {
      try? await AlarmManager.shared.cancel(id: uuid)
      IdStore.remove(uuid)
    }

    let stopButton = AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.circle")
    let snoozeButton = AlarmButton(text: "Snooze", textColor: .white, systemImageName: "zzz")
    let alert = AlarmPresentation.Alert(
      title: LocalizedStringResource(stringLiteral: options.title),
      stopButton: stopButton,
      secondaryButton: snoozeButton,
      secondaryButtonBehavior: .countdown
    )
    let attributes = AlarmAttributes<BrunoAlarmMetadata>(
      presentation: AlarmPresentation(alert: alert),
      metadata: BrunoAlarmMetadata(),
      tintColor: Color(red: 0.91, green: 0.64, blue: 0.24) // the app's accent
    )
    let sound: AlertConfiguration.AlertSound = options.soundName.map { .named($0) } ?? .default
    let configuration = AlarmManager.AlarmConfiguration<BrunoAlarmMetadata>(
      countdownDuration: Alarm.CountdownDuration(preAlert: nil, postAlert: TimeInterval(options.snoozeMinutes * 60)),
      schedule: .fixed(Date(timeIntervalSince1970: options.timestamp / 1000)),
      attributes: attributes,
      stopIntent: nil,
      secondaryIntent: nil,
      sound: sound
    )

    let uuid = UUID()
    _ = try await AlarmManager.shared.schedule(id: uuid, configuration: configuration)
    IdStore.add(uuid, appId: options.id)
  }

  /// Alarms as the JS side sees them. `prune` drops map entries for alarms the system no longer
  /// has (rang and stopped, or cancelled) — only safe with the full list, not partial updates.
  @available(iOS 26.0, *)
  private static func serialize(_ alarms: [Alarm], prune: Bool) -> [[String: Any]] {
    var map = IdStore.all()
    if prune {
      let present = Set(alarms.map { $0.id.uuidString })
      map = map.filter { present.contains($0.key) }
      IdStore.save(map)
    }
    return alarms.compactMap { alarm in
      guard let appId = map[alarm.id.uuidString] else { return nil }
      var entry: [String: Any] = ["id": appId, "state": describe(alarm.state)]
      if case .fixed(let date) = alarm.schedule {
        entry["timestamp"] = date.timeIntervalSince1970 * 1000
      }
      return entry
    }
  }

  @available(iOS 26.0, *)
  private static func describe(_ state: AlarmManager.AuthorizationState) -> String {
    switch state {
    case .notDetermined: return "notDetermined"
    case .authorized: return "authorized"
    case .denied: return "denied"
    @unknown default: return "denied"
    }
  }

  @available(iOS 26.0, *)
  private static func describe(_ state: Alarm.State) -> String {
    switch state {
    case .scheduled: return "scheduled"
    case .countdown: return "countdown"
    case .paused: return "paused"
    case .alerting: return "alerting"
    @unknown default: return "unknown"
    }
  }
  #endif

  // MARK: - Sound

  private static func prepareSound(_ source: String) async throws -> String {
    let fileManager = FileManager.default
    let sourceURL = source.hasPrefix("file://") ? URL(string: source) : URL(fileURLWithPath: source)
    guard let sourceURL, fileManager.fileExists(atPath: sourceURL.path) else {
      throw AlarmKitError("Recording not found")
    }

    let soundsDir = fileManager.urls(for: .libraryDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("Sounds", isDirectory: true)
    try fileManager.createDirectory(at: soundsDir, withIntermediateDirectories: true)

    // 1. Audio only, first 30 s, as M4A.
    let tempURL = fileManager.temporaryDirectory.appendingPathComponent("bruno_howl_\(UUID().uuidString).m4a")
    defer { try? fileManager.removeItem(at: tempURL) }
    guard let export = AVAssetExportSession(asset: AVURLAsset(url: sourceURL), presetName: AVAssetExportPresetAppleM4A) else {
      throw AlarmKitError("Can't read the recording")
    }
    export.outputURL = tempURL
    export.outputFileType = .m4a
    export.timeRange = CMTimeRange(start: .zero, duration: CMTime(seconds: 30, preferredTimescale: 600))
    await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
      export.exportAsynchronously { continuation.resume() }
    }
    guard export.status == .completed else {
      throw AlarmKitError("Couldn't extract the audio: \(export.error?.localizedDescription ?? "unknown error")")
    }

    // 2. M4A → 16-bit PCM .caf, the format iOS alert sounds reliably accept. A new name each
    // time, so iOS never plays a cached older file with the same name.
    let name = "bruno_howl_\(Int(Date().timeIntervalSince1970)).caf"
    let destination = soundsDir.appendingPathComponent(name)
    let input = try AVAudioFile(forReading: tempURL)
    let format = input.processingFormat
    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVSampleRateKey: format.sampleRate,
      AVNumberOfChannelsKey: format.channelCount,
      AVLinearPCMBitDepthKey: 16,
      AVLinearPCMIsFloatKey: false,
      AVLinearPCMIsBigEndianKey: false,
      AVLinearPCMIsNonInterleaved: false,
    ]
    let output = try AVAudioFile(forWriting: destination, settings: settings, commonFormat: format.commonFormat, interleaved: format.isInterleaved)
    guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 8192) else {
      throw AlarmKitError("Couldn't convert the audio")
    }
    while input.framePosition < input.length {
      try input.read(into: buffer)
      if buffer.frameLength == 0 { break }
      try output.write(from: buffer)
    }

    // 3. Keep only the newest prepared howl.
    let existing = (try? fileManager.contentsOfDirectory(at: soundsDir, includingPropertiesForKeys: nil)) ?? []
    for file in existing where file.lastPathComponent.hasPrefix("bruno_howl_") && file.lastPathComponent != name {
      try? fileManager.removeItem(at: file)
    }
    return name
  }
}
