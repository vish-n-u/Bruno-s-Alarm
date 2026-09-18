const { withAppBuildGradle } = require("@expo/config-plugins");

// android/ is regenerated from scratch on every `expo prebuild --clean` (it's gitignored — see
// .gitignore), so the release build.gradle template's default of signing "release" with the
// debug keystore (fine for local `expo run:android --variant release` testing, not acceptable
// for a real Play Store upload) needs to be re-applied every time via this plugin instead of a
// one-off manual edit. The real keystore + passwords live in credentials/ at the repo root,
// outside android/ (so they survive the wipe) and outside git (see .gitignore) — generated once
// with keytool, never committed. Falls back to the debug keystore automatically when that file
// is missing (e.g. a fresh clone without the private keystore), so this never breaks local dev.
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error("withReleaseSigning only supports Groovy build.gradle files");
    }

    let contents = config.modResults.contents;

    const debugSigningConfigBlock = `debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }`;

    if (!contents.includes(debugSigningConfigBlock)) {
      throw new Error("withReleaseSigning: debug signingConfig block not found — template may have changed.");
    }

    contents = contents.replace(
      debugSigningConfigBlock,
      `${debugSigningConfigBlock}
        release {
            def propsFile = rootProject.file("../credentials/release.keystore.properties")
            if (propsFile.exists()) {
                def props = new Properties()
                props.load(new FileInputStream(propsFile))
                storeFile rootProject.file("../credentials/" + props["storeFile"])
                storePassword props["storePassword"]
                keyAlias props["keyAlias"]
                keyPassword props["keyPassword"]
            }
        }`
    );

    const debugKeystoreReleaseSigningLine =
      "            // Caution! In production, you need to generate your own keystore file.\n" +
      "            // see https://reactnative.dev/docs/signed-apk-android.\n" +
      "            signingConfig signingConfigs.debug";

    if (!contents.includes(debugKeystoreReleaseSigningLine)) {
      throw new Error("withReleaseSigning: release buildType signingConfig line not found — template may have changed.");
    }

    contents = contents.replace(
      debugKeystoreReleaseSigningLine,
      "            def releaseKeystoreProps = rootProject.file(\"../credentials/release.keystore.properties\")\n" +
        "            signingConfig releaseKeystoreProps.exists() ? signingConfigs.release : signingConfigs.debug"
    );

    config.modResults.contents = contents;
    return config;
  });
};
