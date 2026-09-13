import { useEffect, useState } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque";
import { SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Onboarding from "./components/Onboarding";
import HomeScreen from "./components/HomeScreen";
import AlarmRingingScreen from "./components/AlarmRingingScreen";
import SettingsScreen from "./screens/SettingsScreen";
import CustomAlarmScreen from "./screens/CustomAlarmScreen";
import { hasOnboarded, markOnboarded } from "./lib/onboarding";
import { onAlarmRinging } from "./lib/notifications";
import { useThemeColors } from "./lib/theme";

type Screen = "checking" | "onboarding" | "home";

export type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  CustomAlarm: undefined;
  OnboardingPreview: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Renders the same Onboarding flow shown on first launch, but "Done"/"Skip" just pops
// back to Settings instead of marking real onboarding state — lets it be checked any time
// without resetting the app.
function OnboardingPreviewScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "OnboardingPreview">) {
  return <Onboarding onDone={() => navigation.goBack()} />;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("checking");
  const [ringingAlarmId, setRingingAlarmId] = useState<string | null>(null);
  const colors = useThemeColors();
  const scheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_500Medium,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  useEffect(() => {
    hasOnboarded()
      .then((seen) => setScreen(seen ? "home" : "onboarding"))
      .catch(() => setScreen("home"));
  }, []);

  useEffect(() => {
    const subscription = onAlarmRinging(setRingingAlarmId);
    return () => subscription?.remove();
  }, []);

  async function completeOnboarding() {
    await markOnboarded();
    setScreen("home");
  }

  if (!fontsLoaded) return null;

  const navigationTheme = {
    ...(scheme === "light" ? DefaultTheme : DarkTheme),
    colors: {
      ...(scheme === "light" ? DefaultTheme.colors : DarkTheme.colors),
      background: colors.background,
      card: colors.surface,
      border: colors.border,
      text: colors.textPrimary,
      primary: colors.accent,
    },
  };

  return (
    <SafeAreaProvider style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === "light" ? "dark" : "light"} />
      {ringingAlarmId ? (
        <AlarmRingingScreen alarmId={ringingAlarmId} />
      ) : screen === "onboarding" ? (
        <Onboarding onDone={completeOnboarding} />
      ) : screen === "home" ? (
        <NavigationContainer theme={navigationTheme}>
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.textPrimary,
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen
              name="CustomAlarm"
              component={CustomAlarmScreen}
              options={{ title: "Set Alarm" }}
            />
            <Stack.Screen
              name="OnboardingPreview"
              component={OnboardingPreviewScreen}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      ) : null}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
