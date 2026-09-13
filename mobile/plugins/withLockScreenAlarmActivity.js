const { withAndroidManifest } = require("@expo/config-plugins");

// react-native-alarmageddon's full-screen intent launches the host app's existing
// MainActivity — it doesn't ship its own dedicated ringing activity. Without these two
// attributes, Android briefly wakes the screen for the launch and then reverts to the lock
// screen instead of keeping the activity visible and interactive over it.
module.exports = function withLockScreenAlarmActivity(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    const mainActivity = application?.activity?.find(
      (activity) => activity.$["android:name"] === ".MainActivity"
    );

    if (mainActivity) {
      mainActivity.$["android:showWhenLocked"] = "true";
      mainActivity.$["android:turnScreenOn"] = "true";
    }

    return config;
  });
};
