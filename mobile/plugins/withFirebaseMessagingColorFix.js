const { withAndroidManifest } = require("@expo/config-plugins");

// expo-notifications (see app.json) writes a com.google.firebase.messaging.default_notification_color
// entry into the app manifest, and @react-native-firebase/messaging declares its own for the same
// key — the manifest merger refuses to pick one. Marking the app's copy as the winner keeps the
// brand notification color from app.json instead of the library's default white.
module.exports = function withFirebaseMessagingColorFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    const metaData = manifest.application?.[0]?.["meta-data"] ?? [];
    const colorEntry = metaData.find(
      (entry) => entry.$["android:name"] === "com.google.firebase.messaging.default_notification_color"
    );
    if (colorEntry) colorEntry.$["tools:replace"] = "android:resource";

    return config;
  });
};
