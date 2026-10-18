import { VolumeManager } from "react-native-volume-manager";

// Onboarding's "Hear Bruno" sample plays on the media stream, so a phone with its media volume
// low would barely hear it. While it plays, the media volume is raised to at least
// PREVIEW_VOLUME (never lowered), then put back when it stops, the way alarm apps preview
// their sounds. Real alarms don't use this: they ring on the alarm stream.

const PREVIEW_VOLUME = 0.7;

// What the volume was before we raised it, and what we raised it to. null = nothing to undo.
let boost: { original: number; raisedTo: number } | null = null;

export async function raisePreviewVolume(): Promise<void> {
  try {
    if (boost) return;
    const { volume } = await VolumeManager.getVolume();
    if (volume >= PREVIEW_VOLUME) return;
    boost = { original: volume, raisedTo: PREVIEW_VOLUME };
    await VolumeManager.setVolume(PREVIEW_VOLUME, { type: "music", showUI: false });
  } catch {
    // A quiet preview is not worth an error.
  }
}

export async function restorePreviewVolume(): Promise<void> {
  const raised = boost;
  boost = null;
  if (!raised) return;
  try {
    // If the viewer changed the volume themselves while it played, keep their choice.
    const { volume } = await VolumeManager.getVolume();
    if (Math.abs(volume - raised.raisedTo) > 0.05) return;
    await VolumeManager.setVolume(raised.original, { type: "music", showUI: false });
  } catch {
    // Nothing to do.
  }
}
