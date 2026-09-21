const { withMainActivity } = require("@expo/config-plugins");

// While an alarm is ringing, the ringing screen (MainActivity, shown over the lock screen by
// plugins/withLockScreenAlarmActivity.js) swallows the hardware volume keys. Android never sees
// the press, so the volume can't be changed and the system volume bar never appears — the same
// behavior as other alarm apps. react-native-alarmageddon's own volume guard (see
// patches/react-native-alarmageddon+*.patch) stays as the backup for when this screen isn't on
// top, e.g. the phone is unlocked and in use and the alarm shows only as a banner.
const BEGIN = "// @brunos begin volume-key-block";
const END = "// @brunos end volume-key-block";

const OVERRIDE = `  ${BEGIN}
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (com.rnalarmmodule.AlarmReceiver.activeAlarmId != null) {
      when (event.keyCode) {
        KeyEvent.KEYCODE_VOLUME_UP,
        KeyEvent.KEYCODE_VOLUME_DOWN,
        KeyEvent.KEYCODE_VOLUME_MUTE -> return true
      }
    }
    return super.dispatchKeyEvent(event)
  }
  ${END}

`;

function addVolumeKeyBlock(contents) {
  if (contents.includes(BEGIN)) return contents;
  let out = contents;
  if (!out.includes("import android.view.KeyEvent")) {
    out = out.replace("import android.os.Bundle\n", "import android.os.Bundle\nimport android.view.KeyEvent\n");
  }
  const anchor = "  /**\n   * Returns the name of the main component";
  if (!out.includes(anchor)) {
    throw new Error("withVolumeKeyBlock: couldn't find where to insert into MainActivity.kt");
  }
  return out.replace(anchor, OVERRIDE + anchor);
}

module.exports = function withVolumeKeyBlock(config) {
  return withMainActivity(config, (config) => {
    config.modResults.contents = addVolumeKeyBlock(config.modResults.contents);
    return config;
  });
};
module.exports.addVolumeKeyBlock = addVolumeKeyBlock;
