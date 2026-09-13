const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// react-native-alarmageddon plays its own alarm sound via a native MediaPlayer on
// AudioAttributes.USAGE_ALARM (the DND-exempt stream) — that's what makes the alarm
// audible reliably before the JS/React tree (and the video's own audio) has even started.
// It looks for a raw Android resource named exactly "alarm_default" in the host app
// (see AlarmReceiver.kt's RAW_RES constant); without it, it falls back to the system's
// default alarm ringtone. This plugin copies our own Bruno-howl audio into that exact
// location on every prebuild, since android/ is regenerated from scratch each time.
module.exports = function withAlarmSound(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const src = path.join(config.modRequest.projectRoot, "assets/audio/alarm_default.mp3");
      const rawDir = path.join(config.modRequest.platformProjectRoot, "app/src/main/res/raw");
      fs.mkdirSync(rawDir, { recursive: true });
      fs.copyFileSync(src, path.join(rawDir, "alarm_default.mp3"));
      return config;
    },
  ]);
};
