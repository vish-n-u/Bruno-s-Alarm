# Bruno's Alarm

Read `PROJECT_GUIDE.md` before doing anything — it covers how the app, website and backend
work, how to build/deploy, known traps, and the prioritised list of open issues (§10).

Quick orientation:
- `mobile/` — Expo/React Native Android app (the product). `mobile/android/` is generated and
  gitignored; native customisations live in `mobile/plugins/` and `mobile/patches/`.
- repo root — Next.js website + `/api/latest-recording`, auto-deployed to Vercel on push to `main`.
- `functions/` — Firebase Cloud Functions (chat, live-alert webhook). Deploy with `npm run deploy`.
- Release builds are local Gradle builds; bump `versionCode` in both `mobile/app.json` and
  `mobile/android/app/build.gradle`.
- Never write files containing regex/unicode backslash escapes via Bash heredocs (§9).
