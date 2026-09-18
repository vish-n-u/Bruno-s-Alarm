# Live chat setup

Status: **code complete, not yet deployed**. Everything in this doc's "Steps only you can
do" section is required before chat will actually work — until then, the app will build and
run fine, but anonymous sign-in and every chat send will fail (Firestore/Auth aren't enabled
yet, and the Cloud Function isn't deployed).

## What this is

Real-time text chat, scoped to one real Bruno session at a time (see
`lib/schedule.ts`'s `currentSessionId()`), active only while a session is actually live. Uses
the same Firebase project already wired in for Analytics/Crashlytics (`bruno-s-howl`) — no
new project needed.

- `lib/firebase.ts` — anonymous auth bootstrap.
- `lib/chat.ts` — send (via the Cloud Function, never a direct Firestore write),
  subscribe, block-list, terms-acceptance, and report helpers.
- `components/LiveChat.tsx` — the chat overlay itself (bottom-anchored on the video, only
  the message list/input capture taps, everything else passes through to the video's own
  tap-to-mute).
- `components/ChatTermsGate.tsx` — one-time conduct-rules acceptance before a device's first
  ever send.
- `components/ReportMessageModal.tsx` — long-press a message → Report/Block.
- `functions/` (repo root) — the `sendChatMessage` callable Cloud Function. This is the
  **only** place messages are actually written — length, profanity, the per-device rate
  limit (~1 per 3s), and the 500-message-per-session cap are all enforced here, not
  trusted to the client. Direct client writes to `sessions/{id}/messages` are blocked
  entirely by `firestore.rules` (repo root).

## Steps only you can do

These need your Firebase console access / billing details — nothing here can be done from
code.

1. **Enable Firestore and Anonymous Authentication** on the `bruno-s-howl` project:
   - [Firebase console](https://console.firebase.google.com/) → `bruno-s-howl` → Build →
     Firestore Database → Create database (production mode, any region close to your
     users is fine).
   - Build → Authentication → Sign-in method → enable **Anonymous**.

2. **Upgrade the project to the Blaze (pay-as-you-go) plan.** Cloud Functions don't run at
   all on the free Spark plan. This needs a card on file — Blaze still has a generous free
   tier underneath it (Firestore and Functions both bill only past a monthly free quota), so
   realistic chat volume here should cost close to nothing, but the plan itself must be
   Blaze for the function to deploy or run.
   - Console → ⚙️ Project settings → Usage and billing → Details & settings → Modify plan.

3. **Set a budget alert** as a safety net — a bug in the function's logic (an infinite retry
   loop, a runaway trigger) could theoretically rack up cost on Blaze in a way that simply
   isn't possible on Spark. This won't stop spending on its own, but it'll email you before
   it becomes a surprise.
   - [Google Cloud Console](https://console.cloud.google.com/billing) → select the
     billing account linked to `bruno-s-howl` → Budgets & alerts → Create budget. A small
     threshold (e.g. $5-10/month) is plenty to catch something going wrong early.

4. **Install the Firebase CLI and log in** (one-time, on your machine):
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

5. **Deploy the security rules and the Cloud Function** from the repo root (not `mobile/`):
   ```bash
   firebase deploy --only firestore:rules,functions
   ```
   This builds `functions/` (via its own `npm run build`) and deploys both the rules and the
   `sendChatMessage` function to the `bruno-s-howl` project (already set as the default via
   `.firebaserc`).

## Verifying it after deploy

1. `npx tsc --noEmit` clean in both `mobile/` and `functions/` (already true as of this
   change — re-check after any further edits).
2. On-device: open the Live tab during a live (or debug-forced-live) session — the chat
   overlay should appear at the bottom of the video instead of the "Chat opens when Bruno
   goes live" placeholder.
3. Send a message from two devices (or two app instances) — confirm each sees the other's
   message appear in real time.
4. Confirm anonymous auth is stable: force-quit and reopen the app, send another message —
   it should show the same "Viewer NNNN" name as before, not a new one.
5. Long-press a message → confirm both "Report message" (writes to the `reports` collection
   — check the Firebase console) and "Block this viewer" (that user's messages disappear
   from your own view only) work.
6. Try to trigger the rate limit (send several messages in under 3 seconds) and confirm the
   later ones are rejected with "you're sending messages too fast."
7. In the Firebase console's Firestore tab, try manually adding a document under
   `sessions/{any-id}/messages` directly — it should be rejected (rules block all direct
   client/console writes; only the Admin SDK inside the Cloud Function can write there).
