import { createAudioPlayer, type AudioPlayer } from "expo-audio";

// One-shot UI sound effects — separate from lib/alarmSound.ts (the guaranteed native alarm
// clip) and lib/iosAlarmEngine.ts (the background keep-alive/ringing players). These are short,
// bundled, fire-and-forget confirmation sounds, same expo-audio player API those already use.

let deletePlayer: AudioPlayer | null = null;

/** The short descending two-note chime played when something gets deleted — pairs with the
 * warning haptic so removing an alarm has a clear, pleasant "that's gone" confirmation instead
 * of just silently vanishing. */
export function playDeleteSound(): void {
  try {
    // A fresh player each call rather than reusing one — deleting twice in quick succession
    // (unusual, but the old sheet no longer confirms first) should hear both, not have the
    // second call cut the first one off mid-chime.
    deletePlayer = createAudioPlayer(require("../assets/audio/delete_confirm.mp3"));
    deletePlayer.volume = 0.7;
    deletePlayer.play();
  } catch {
    // A missed UI sound is never worth surfacing — the haptic already confirmed the action.
  }
}
