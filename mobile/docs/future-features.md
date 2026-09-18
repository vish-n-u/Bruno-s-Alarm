# Future direction

## 1. Usage analytics + crash/error reporting — done

Firebase Analytics + Crashlytics are integrated (`lib/analytics.ts`, `app.json`'s
`@react-native-firebase/analytics`/`/crashlytics` plugins). Crashlytics auto-groups crashes
by device model/OS version/app version.

## 2. Ads / monetization — not started

No tool chosen yet. `react-native-google-mobile-ads` (AdMob) is the natural fit for an
Android/Expo app.

## 3. Live chat — text chat done, images/usernames still deferred

Real-time anonymous text chat during Bruno's live sessions is built — see
[live-chat-setup.md](live-chat-setup.md). It deliberately stayed within the existing
**anonymous, no-accounts** architecture: Firebase Anonymous Auth gives each device a stable
uid without any sign-up, and display names are auto-generated ("Viewer 4821"), not
user-chosen — no username system was needed.

User-uploaded images remain unscoped and would be a bigger step: images need their own
storage/moderation pipeline (Firebase Storage + a way to moderate image content before it's
visible, not just text), and are still not built. When picked up, treat it as its own
project rather than bolting onto the current text-only chat.
