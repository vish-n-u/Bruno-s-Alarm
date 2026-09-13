import { StyleSheet, Text, View } from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";

// TEMPORARY — validation test only, not the real video panel.
// Testing an actual public LIVE stream now (not just a regular VOD embed) —
// this is the one thing that was still unverified.
const LIVE_TEST_VIDEO_ID = "mKCieTImjvU";

export default function YoutubeEmbedTest() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>🧪 YouTube LIVE embed test (react-native-youtube-iframe)</Text>
      <YoutubePlayer
        height={220}
        play
        videoId={LIVE_TEST_VIDEO_ID}
        initialPlayerParams={{
          controls: false,
          modestbranding: true,
          rel: false,
          preventFullScreen: true,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: "#2a2e38",
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  label: {
    color: "#9aa0ab",
    fontSize: 12,
    marginBottom: 8,
  },
});
