import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Anton_400Regular } from "@expo-google-fonts/anton";
import { CourierPrime_400Regular, CourierPrime_700Bold } from "@expo-google-fonts/courier-prime";
import { Caveat_600SemiBold } from "@expo-google-fonts/caveat";
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  getFocusedRouteNameFromRoute,
} from "@react-navigation/native";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Onboarding from "./components/Onboarding";
import HomeScreen from "./components/HomeScreen";
import AlarmRingingScreen from "./components/AlarmRingingScreen";
import SettingsScreen from "./screens/SettingsScreen";
import CustomAlarmScreen from "./screens/CustomAlarmScreen";
import LiveScreen from "./screens/LiveScreen";
import BrunosPackScreen from "./screens/BrunosPackScreen";
import WeatherPreviewScreen from "./screens/WeatherPreviewScreen";
import { hasOnboarded, markOnboarded } from "./lib/onboarding";
import { getActiveRingingAlarm, onAlarmRinging } from "./lib/notifications";
import { registerBackgroundAlarmSoundRefresh } from "./lib/backgroundRefresh";
import { resumeIOSAlarmEngineIfNeeded } from "./lib/iosAlarmEngine";
import { useThemeColors, useTimeOfDay } from "./lib/theme";

type Screen = "checking" | "onboarding" | "home";

// Built and working (see docs/live-chat-setup.md), but held back for later — flip this to
// bring the tab back. Kept as a flag (rather than deleting the screen/import) so re-enabling
// later is a one-line change. See docs/hidden-features.md.
const CHAT_ENABLED = false;

// The Home tab's own internal stack — Settings/CustomAlarm are reached by pushing on top of
// Home, same as before the tab bar existed. Editing an alarm is a true in-place popup
// (components/EditCustomAlarmModal.tsx) opened via local state, not a route here. The Live
// and Messages tabs are single screens with no stack of their own (yet).
export type HomeStackParamList = {
  Home: undefined;
  Settings: undefined;
  CustomAlarm: undefined;
  OnboardingPreview: undefined;
  WeatherPreview: undefined;
};

type RootTabParamList = {
  HomeTab: undefined;
  LiveTab: undefined;
  MessagesTab: undefined;
};

const HomeStackNav = createNativeStackNavigator<HomeStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

// expo-splash-screen keeps the native splash up until hideAsync() is explicitly called from
// JS — it does not auto-dismiss on its own. Call preventAutoHideAsync() as early as possible
// (module scope, before the first render) so there's no gap where it could hide itself
// before fonts/state are actually ready.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Renders the same Onboarding flow shown on first launch, but "Done"/"Skip" just pops
// back to Settings instead of marking real onboarding state — lets it be checked any time
// without resetting the app.
function OnboardingPreviewScreen({ navigation }: NativeStackScreenProps<HomeStackParamList, "OnboardingPreview">) {
  return <Onboarding onDone={() => navigation.goBack()} />;
}

// Extracted so it can be dropped straight in as the Home tab's screen component below —
// everything here is exactly what the single root Stack.Navigator used to render directly.
// Reads the theme itself (rather than taking it as a prop) since Tab.Screen's `component`
// only ever passes navigation/route props.
function HomeStack() {
  const colors = useThemeColors();
  return (
    <HomeStackNav.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <HomeStackNav.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStackNav.Screen name="Settings" component={SettingsScreen} />
      <HomeStackNav.Screen name="CustomAlarm" component={CustomAlarmScreen} options={{ title: "Your alarms" }} />
      <HomeStackNav.Screen
        name="OnboardingPreview"
        component={OnboardingPreviewScreen}
        options={{ headerShown: false }}
      />
      <HomeStackNav.Screen name="WeatherPreview" component={WeatherPreviewScreen} options={{ headerShown: false }} />
    </HomeStackNav.Navigator>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("checking");
  const [ringingAlarmId, setRingingAlarmId] = useState<string | null>(null);
  const colors = useThemeColors();
  const timeOfDay = useTimeOfDay();
  // Night is the only phase with a dark background — everything else (dawn/midday/sunset)
  // wants the light system chrome, matching whichever palette useThemeColors() picked.
  const isNight = timeOfDay === "night";
  const [fontsLoaded] = useFonts({
    Anton_400Regular,
    CourierPrime_400Regular,
    CourierPrime_700Bold,
    Caveat_600SemiBold,
    BricolageGrotesque_400Regular,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
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
    // No-ops on Android. On iOS, re-establishes the keep-alive background audio session if
    // an alarm was still armed from before this app process started — e.g. the OS restarted
    // it, as opposed to the user force-quitting it (which this can't recover from).
    resumeIOSAlarmEngineIfNeeded();
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
    ...(isNight ? DarkTheme : DefaultTheme),
    colors: {
      ...(isNight ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      border: colors.border,
      text: colors.textPrimary,
      primary: colors.accent,
    },
  };

  return (
    <SafeAreaProvider style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isNight ? "light" : "dark"} />
      {ringingAlarmId ? (
        <AlarmRingingScreen alarmId={ringingAlarmId} />
      ) : screen === "onboarding" ? (
        <Onboarding onDone={completeOnboarding} />
      ) : screen === "home" ? (
        <NavigationContainer theme={navigationTheme}>
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: colors.accent,
              tabBarInactiveTintColor: colors.textSecondary,
              tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
            }}
          >
            <Tab.Screen
              name="HomeTab"
              component={HomeStack}
              options={({ route }) => ({
                title: "Home",
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
                ),
                // OnboardingPreview and WeatherPreview are both meant to be full-screen
                // takeovers just like real onboarding — without this, the tab bar stays
                // visible (and tappable) underneath them, since they're routes nested inside
                // this same tab's stack. (Editing an alarm no longer needs this — it's an
                // in-place popup, not a route, so it already renders over everything
                // including the tab bar.)
                tabBarStyle: ["OnboardingPreview", "WeatherPreview"].includes(
                  getFocusedRouteNameFromRoute(route) ?? "",
                )
                  ? { display: "none" }
                  : { backgroundColor: colors.surface, borderTopColor: colors.border },
              })}
            />
            <Tab.Screen
              name="LiveTab"
              component={LiveScreen}
              options={{
                title: "Live",
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons name={focused ? "play-circle" : "play-circle-outline"} size={size} color={color} />
                ),
              }}
            />
            {CHAT_ENABLED && (
              <Tab.Screen
                name="MessagesTab"
                component={BrunosPackScreen}
                options={{
                  title: "Bruno's Pack",
                  tabBarIcon: ({ color, size, focused }) => (
                    <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={size} color={color} />
                  ),
                }}
              />
            )}
          </Tab.Navigator>
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
