import { useEffect, useState } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Anton_400Regular } from "@expo-google-fonts/anton";
import { CourierPrime_400Regular, CourierPrime_700Bold } from "@expo-google-fonts/courier-prime";
import { Caveat_600SemiBold } from "@expo-google-fonts/caveat";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Onboarding from "./components/Onboarding";
import HomeScreen from "./components/HomeScreen";
import AlarmRingingScreen from "./components/AlarmRingingScreen";
import SettingsScreen from "./screens/SettingsScreen";
import CustomAlarmScreen from "./screens/CustomAlarmScreen";
import EditCustomAlarmScreen from "./screens/EditCustomAlarmScreen";
import { hasOnboarded, markOnboarded } from "./lib/onboarding";
import { getActiveRingingAlarm, onAlarmRinging } from "./lib/notifications";
import { registerBackgroundAlarmSoundRefresh } from "./lib/backgroundRefresh";
import { useThemeColors } from "./lib/theme";

type Screen = "checking" | "onboarding" | "home";

export type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  CustomAlarm: undefined;
  EditCustomAlarm: { alarmId?: string };
  OnboardingPreview: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// expo-splash-screen keeps the native splash up until hideAsync() is explicitly called from
// JS — it does not auto-dismiss on its own. Call preventAutoHideAsync() as early as possible
// (module scope, before the first render) so there's no gap where it could hide itself
// before fonts/state are actually ready.
SplashScreen.preventAutoHideAsync().catch(() => {});

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
    Anton_400Regular,
    CourierPrime_400Regular,
    CourierPrime_700Bold,
    Caveat_600SemiBold,
  });

  useEffect(() => {
    hasOnboarded()
      .then((seen) => setScreen(seen ? "home" : "onboarding"))
      .catch(() => setScreen("home"));
  }, []);

  useEffect(() => {
    // Covers the cold-start case: the phone was locked, the alarm fired, and the OS
    // launched the app fresh over the lock screen — the native side already started
    // ringing before this listener could attach, so that initial event is missed and
    // must be checked for explicitly instead of only watching for future changes.
    getActiveRingingAlarm().then((id) => {
      if (id) setRingingAlarmId(id);
    });
    const subscription = onAlarmRinging(setRingingAlarmId);
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    registerBackgroundAlarmSoundRefresh();
  }, []);

  // Only dismiss the splash once there's real content ready to replace it with — fonts
  // loaded and past the "checking" state — so there's no flash of a blank/unstyled screen
  // underneath.
  useEffect(() => {
    if (fontsLoaded && screen !== "checking") {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, screen]);

  async function completeOnboarding() {
    await markOnboarded();
    setScreen("home");
  }

  if (!fontsLoaded || screen === "checking") return null;

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
              options={{ title: "Your alarms" }}
            />
            <Stack.Screen
              name="EditCustomAlarm"
              component={EditCustomAlarmScreen}
              options={{ headerShown: false, presentation: "modal" }}
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
