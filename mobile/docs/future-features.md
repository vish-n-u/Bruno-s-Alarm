# Future direction (not scoped yet)

Deferred until after the YouTube video-embed bug (see
[youtube-embed-error-153.md](youtube-embed-error-153.md)) is fixed and the app is closer to
a Play Store launch.

## 1. Usage analytics + crash/error reporting

Goal: understand how users interact with the app, catch bugs, and specifically isolate
whether an issue is tied to a particular phone model or OS version.

Not wedded to a specific tool yet. Two real candidates depending on what matters most:
- **Firebase (Analytics + Crashlytics)** — Crashlytics auto-groups crashes by device
  model/OS version/app version, which matches the "is this a specific-phone problem" need
  directly.
- **PostHog** — stronger for flexible product-usage analytics, funnels, and session replay
  if deeper engagement insight matters more than crash triage.

Likely ends up being both, or Firebase as the simpler single-vendor path.

## 2. Ads / monetization

Mentioned as a future direction, no tool chosen yet. `react-native-google-mobile-ads`
(AdMob) is the natural fit for an Android/Expo app.

## 3. Messaging with user-uploaded images (longer-term, least defined)

The one with the biggest architectural implication. Requires unique usernames per user,
which means moving off the current **deliberately anonymous, no-accounts,
local-device-only** architecture — both the website's push-subscription-by-timezone model
and the mobile app's on-device-only alarm scheduling — to a real backend with user
accounts, image upload/storage, and moderation.

Not scoped yet. Worth keeping in mind when touching shared architecture: don't over-optimize
the current "no accounts ever" assumption, since it's slated to change.

## How to apply

Don't build any of this proactively. When picked back up: the tool choice for #1 should
follow from whether crash-triage-by-device or product-usage-analysis is the primary driver;
#3 should be scoped as a real backend/accounts project, not bolted onto the current
local-only design.
