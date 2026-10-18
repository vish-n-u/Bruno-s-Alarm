import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import HowlingDogScene, { INK, ORANGE, SKY } from "../components/HowlingDogScene";
import Touchable from "../components/Touchable";
import type { HomeStackParamList } from "../App";
import { getAlarmClipVideoUri } from "../lib/alarmSound";
import { track } from "../lib/analytics";
import { tapLight } from "../lib/haptics";
import { raisePreviewVolume, restorePreviewVolume } from "../lib/previewVolume";
import { fonts, spacing } from "../lib/theme";

type Props = NativeStackScreenProps<HomeStackParamList, "About">;

/**
 * Settings → About Bruno's Alarm. The whole screen is the morning line drawing
 * (components/HowlingDogScene.tsx): sky above, ground below, Bruno walking in and howling at
 * the far church bell. Just two short lines of text. Tap anywhere to hear the real howl.
 * Always the warm morning colours, whatever the app theme.
 */
export default function AboutScreen({ navigation }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const [sceneHeight, setSceneHeight] = useState(Math.round(windowHeight * 0.75));
  const isFocused = useIsFocused();

  // The header blends into the sky.
  useLayoutEffect(() => {
    navigation.setOptions({
      title: "",
      headerStyle: { backgroundColor: SKY },
      headerTintColor: INK,
    });
  }, [navigation]);

  // Tap: his real howl (saved recording if any, else the built-in one), on the media stream
  // with a low volume raised while it plays.
  const playerRef = useRef<AudioPlayer | null>(null);
  const [playing, setPlaying] = useState(false);

  function stopHowl() {
    const player = playerRef.current;
    playerRef.current = null;
    if (player) {
      player.pause();
      player.remove();
    }
    setPlaying(false);
    restorePreviewVolume();
  }

  async function toggleHowl() {
    tapLight();
    if (playerRef.current) {
      stopHowl();
      return;
    }
    const saved = await getAlarmClipVideoUri().catch(() => undefined);
    const player = createAudioPlayer(saved ? { uri: saved } : require("../assets/audio/alarm_default.mp3"));
    playerRef.current = player;
    player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish && playerRef.current === player) stopHowl();
    });
    setPlaying(true);
    track.howlPreview("about");
    await raisePreviewVolume();
    player.play();
  }

  useEffect(() => {
    if (!isFocused) stopHowl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);
  useEffect(() => () => stopHowl(), []);

  return (
    <Touchable style={styles.root} onPress={toggleHowl} onLayout={(e) => setSceneHeight(e.nativeEvent.layout.height)}>
      {isFocused && <StatusBar style="dark" />}
      {/* The whole screen is the scene; the words float in its sky. */}
      <HowlingDogScene height={sceneHeight} dogScale={0.52} rounded={false} />
      <View style={styles.words} pointerEvents="none">
        <Text style={styles.line}>A real dog. A real bell.{"\n"}Twice a day.</Text>
        <Text style={styles.hint}>{playing ? "tap to stop" : "tap to hear him"}</Text>
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SKY,
  },
  words: {
    position: "absolute",
    top: spacing.lg,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: spacing.sm,
  },
  line: {
    color: INK,
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 32,
    textAlign: "center",
  },
  hint: {
    color: ORANGE,
    fontFamily: fonts.hand,
    fontSize: 22,
  },
});
