const { IOSConfig, withDangerousMod, withXcodeProject } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// iPhone only — the counterpart of withAlarmSound.js (Android). AlarmKit plays an alarm sound
// named when the alarm is scheduled, from the app bundle or Library/Sounds. This puts the
// built-in Bruno howl (assets/audio/bruno_alarm.caf, the same clip as Android's alarm_default,
// converted to 16-bit PCM CAF) into the app bundle, so lib/iosAlarms.ts can always fall back to
// it. Touches nothing on Android.
const SOUND_FILE = "bruno_alarm.caf";

function withIOSAlarmSoundFile(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const { projectRoot, platformProjectRoot, projectName } = config.modRequest;
      const src = path.join(projectRoot, "assets/audio", SOUND_FILE);
      const dest = path.join(platformProjectRoot, projectName, SOUND_FILE);
      fs.copyFileSync(src, dest);
      return config;
    },
  ]);
}

function withIOSAlarmSoundResource(config) {
  return withXcodeProject(config, (config) => {
    const { projectName } = config.modRequest;
    const filepath = `${projectName}/${SOUND_FILE}`;
    if (!config.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath,
        groupName: projectName,
        project: config.modResults,
        isBuildFile: true,
        verbose: true,
      });
    }
    return config;
  });
}

module.exports = function withIOSAlarmSound(config) {
  return withIOSAlarmSoundResource(withIOSAlarmSoundFile(config));
};
