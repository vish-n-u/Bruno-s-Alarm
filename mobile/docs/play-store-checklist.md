# Play Store readiness checklist

Code-side items are done (see "Done in the repo"). The Play Console items below can only be done
in the dashboard. Form wording changes over time, so treat the names as a guide.

## Done in the repo

- Removed unneeded permissions: `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`,
  `WRITE_EXTERNAL_STORAGE`. Done through `android.blockedPermissions` in `app.json`, and mirrored
  in the generated `android/app/src/main/AndroidManifest.xml` (`tools:node="remove"`).
- Verified in a fresh merged manifest: none of those four remain.
- Privacy policy (`privacy-policy.txt` and `.html`) updated: current permission list, Firebase Cloud
  Messaging (optional live alarm), advertising ID note, Cloudflare R2, Vercel, new effective date.

Final permissions the app declares: `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`,
`USE_FULL_SCREEN_INTENT`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `INTERNET`,
`ACCESS_NETWORK_STATE`, `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE`,
`FOREGROUND_SERVICE_MEDIA_PLAYBACK`, and `com.google.android.c2dm.permission.RECEIVE` (push).
`AD_ID` is blocked in `app.json` (`blockedPermissions`), since the app shows no ads.

## To do in the Play Console

1. **Privacy policy.** Use `https://bruno-s-alarm.vercel.app/privacy` (served by the Next.js site at
   the repo root, `app/privacy/page.tsx`). The app's Settings links there too, and to `/terms`. The
   old Notion page is no longer linked from anywhere.
2. **Permissions declarations** (App content):
   - Full-screen intent: declare that alarms are the app's core function. This is what lets Google
     grant lock-screen display automatically on Android 14+.
   - Exact alarms: declare alarm-clock use (needed for `USE_EXACT_ALARM`).
   - Foreground service (media playback): declare it, and be ready to describe or demo it.
3. **Data safety form.** Declare, at least:
   - App activity and diagnostics (Firebase Analytics, Crashlytics).
   - Device or other IDs (Firebase installation ID, push identifier when the optional live alarm is
     on).
   - User-generated content: **live chat on the Live tab is active for everyone**, even though the
     separate Bruno's Pack tab is hidden.
   - Data is encrypted in transit; describe how deletion works (anonymous IDs, no accounts).
4. **Advertising ID question.** Answer "no": the app shows no ads and `AD_ID` is blocked.
5. **User-generated content policy.** Chat has report and block, moderation, and a contact email, which
   Play's UGC rules ask for. Keep those in place.
6. **Target audience and content rating.** Not directed at children. Answer the rating questionnaire
   with the chat in mind.
7. **Upload** the AAB with a new `versionCode`. Play rejects a versionCode it has already seen.

## Decisions still open

- **If ads ever come back:** unblock `AD_ID` and update the privacy policy and data safety form.
- **When Bruno's Pack or the weather hints are switched on** (see `hidden-features.md`), update the
  privacy policy and data safety form first. Weather uses an IP-based location lookup.
