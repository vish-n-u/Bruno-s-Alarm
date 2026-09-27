import type { Metadata } from "next";
import LegalPage from "../_components/LegalPage";
import { CONTACT_EMAIL, PACKAGE_NAME, PRIVACY_EFFECTIVE } from "../site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Bruno's Alarm does and doesn't do with your data.",
};

// Same content as mobile/privacy-policy.txt, plus section 6 about this website itself.
// Change both together.
const PERMISSIONS: [string, string][] = [
  ["POST_NOTIFICATIONS", "Lets the app show you anything at all. Required on Android 13+ for any notification, including the alarm itself."],
  ["SCHEDULE_EXACT_ALARM · USE_EXACT_ALARM", "Let Bruno's alarm fire at the exact scheduled minute, the same permissions every alarm-clock app uses."],
  ["USE_FULL_SCREEN_INTENT", "Lets the alarm screen wake your phone and show over the lock screen when it goes off."],
  ["WAKE_LOCK", "Keeps the phone awake while the alarm is ringing."],
  ["RECEIVE_BOOT_COMPLETED", "Lets your alarms survive a phone restart, so a reboot overnight doesn't cancel tomorrow's wake-up."],
  ["MODIFY_AUDIO_SETTINGS · FOREGROUND_SERVICE · FOREGROUND_SERVICE_MEDIA_PLAYBACK", "Let the alarm sound play reliably, including while the app isn't open, and keep it audible while it rings."],
  ["VIBRATE", "Lets the alarm vibrate your phone alongside the sound."],
  ["INTERNET · ACCESS_NETWORK_STATE", "Download Bruno's latest recording and play the live video."],
  ["com.google.android.c2dm.permission.RECEIVE", "Lets the optional live alerts reach your phone (Firebase Cloud Messaging)."],
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effective={PRIVACY_EFFECTIVE}
      other={{ href: "/terms", label: "Terms of Service" }}
      summary={
        <p>
          There&rsquo;s no sign-up and we never learn your real name, email, or phone number. Your
          alarms are stored only on your phone. When you use live chat, the app creates an
          anonymous device ID so messages can be moderated and rate-limited, and anything you
          send in chat is public to everyone watching that session. We use Firebase Analytics
          and Crashlytics for basic usage and crash data, and Cloudflare to deliver the video.
          No ads, nothing sold to anyone.
        </p>
      }
    >
      <p>
        Bruno&rsquo;s Alarm (<code>{PACKAGE_NAME}</code>) wakes you up with a real dog&rsquo;s
        twice-daily howl, and lets you chat with other viewers while he&rsquo;s live. This page
        explains, plainly, what the app does and doesn&rsquo;t do with your data.
      </p>

      <h2><span className="num">1</span>Information we collect</h2>
      <ul>
        <li>
          <strong>Automatically, via Firebase Analytics and Crashlytics:</strong> basic
          app-usage events (like which screens you open), device and OS info, and crash or error
          reports. Analytics also works out an approximate location (country or region) from a
          masked IP address. This is standard diagnostic data and isn&rsquo;t tied to your name or
          contact info.
        </li>
        <li>
          <strong>If you use live chat:</strong> an anonymous device ID (created by Firebase
          Anonymous Authentication, with no name, email, or phone attached), the text of any
          message you send, a display name, and a timestamp. The display name is the nickname
          you typed during onboarding or, if you skipped that, a generated one like{" "}
          <code>Viewer 4821</code>. Either way it&rsquo;s never linked to your real name. A typed
          nickname is automatically checked and replaced with a generated one if it&rsquo;s
          inappropriate or impersonates staff. These are stored in a shared database (Cloud
          Firestore) and are visible to everyone viewing that session&rsquo;s chat, since
          that&rsquo;s the point of a public chat.
        </li>
        <li>
          <strong>If you turn on &ldquo;Ring when Bruno goes live&rdquo;:</strong> Firebase Cloud
          Messaging gives your device a push identifier, and the app subscribes it to a
          &ldquo;live&rdquo; topic so it can be told when Bruno starts streaming. No name, email,
          or phone number is attached, and turning the option off unsubscribes it.
        </li>
        <li>
          <strong>If you report a chat message:</strong> the message you reported, your reason,
          and your anonymous device ID, so we can review it.
        </li>
      </ul>
      <p>
        We do not collect your real name, email address, phone number, or precise location, and
        there is no account or sign-up anywhere in the app.
      </p>

      <h2><span className="num">2</span>What stays on your device</h2>
      <p>Never sent anywhere:</p>
      <ul>
        <li>Your scheduled alarm times, held by Android&rsquo;s own <code>AlarmManager</code>.</li>
        <li>Whether you&rsquo;ve finished onboarding, and whether you turned on the live alarm.</li>
        <li>The nickname you optionally typed during onboarding (it&rsquo;s only sent along with a chat message you choose to send).</li>
        <li>
          Whether you&rsquo;ve accepted live chat&rsquo;s rules, and anyone you&rsquo;ve blocked.
          Blocking is local only: it hides that person&rsquo;s messages on your device, and
          doesn&rsquo;t remove them for anyone else or notify them.
        </li>
        <li>The most recently cached copy of Bruno&rsquo;s howl, so the alarm can play without a connection.</li>
      </ul>
      <p>Uninstalling the app removes all of this.</p>

      <h2><span className="num">3</span>Live chat and moderation</h2>
      <p>
        Chat is only open while Bruno is live, and resets with each session. Every message goes
        through a server-side check before it&rsquo;s posted: length, a language filter, a rate
        limit, and a per-session cap so chat can&rsquo;t be flooded. Posted messages are public to
        anyone viewing that session. A session&rsquo;s messages are automatically deleted a couple
        of hours after it goes quiet, so there&rsquo;s no running chat history. We don&rsquo;t
        sell or share chat content, and it&rsquo;s never linked to your name, email, or an
        account.
      </p>
      <p>If something in chat bothers you:</p>
      <ul>
        <li><strong>Report a message</strong> sends it to us for review, with your reason.</li>
        <li><strong>Block a viewer</strong> hides their messages for you, immediately, on your device only.</li>
      </ul>

      <h2><span className="num">4</span>Services we use</h2>
      <ul>
        <li>
          <strong>Firebase (Google):</strong> Anonymous Authentication, Cloud Firestore, and Cloud
          Functions run live chat; Cloud Messaging delivers the optional live alerts; Analytics
          and Crashlytics provide usage and crash data. See{" "}
          <a href="https://policies.google.com/privacy" rel="noopener">Google&rsquo;s Privacy Policy</a>.
        </li>
        <li>
          <strong>Cloudflare Stream and R2:</strong> Stream delivers the live video, and R2 stores
          the recording your phone downloads for the alarm. Loading either means your
          device&rsquo;s IP address and standard request data reach Cloudflare, the same as
          loading anything from a CDN. See{" "}
          <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">Cloudflare&rsquo;s Privacy Policy</a>.
        </li>
        <li>
          <strong>Vercel:</strong> hosts this website and the small server the app asks for the
          link to Bruno&rsquo;s latest recording. Your IP address and standard request data reach
          it, and we don&rsquo;t keep them. See{" "}
          <a href="https://vercel.com/legal/privacy-policy" rel="noopener">Vercel&rsquo;s Privacy Policy</a>.
        </li>
      </ul>
      <p>None of these are used to show you ads, and Bruno&rsquo;s Alarm runs no ad network.</p>

      <h2><span className="num">5</span>Permissions the app requests, and why</h2>
      <dl className="perm-list">
        {PERMISSIONS.map(([name, why]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{why}</dd>
          </div>
        ))}
      </dl>
      <p>The app does not ask for your microphone, contacts, photos, files, or location.</p>

      <h2><span className="num">6</span>This website</h2>
      <p>
        This site has no analytics, no cookies, and no trackers. Its fonts are served from the
        site itself, not from Google. The only thing it works out about you is your timezone,
        in your own browser, to show Bruno&rsquo;s schedule in your local time. That never leaves
        your device.
      </p>

      <h2 id="delete-your-data"><span className="num">7</span>Deleting your data</h2>
      <p>There&rsquo;s no account, so most of this you can do yourself, straight away:</p>
      <ul>
        <li><strong>Everything on your phone:</strong> uninstall the app. Alarms, your nickname, blocks, and the cached recording are all removed.</li>
        <li><strong>Live alerts:</strong> turn off &ldquo;Ring when Bruno goes live&rdquo; in Settings. Your device is unsubscribed from the alert topic.</li>
        <li><strong>Chat messages:</strong> these delete themselves a couple of hours after each session ends. You don&rsquo;t need to ask.</li>
      </ul>
      <p>
        To have something removed sooner, such as a message you sent or a report you filed,
        email <a href={`mailto:${CONTACT_EMAIL}?subject=Delete%20my%20data`}>{CONTACT_EMAIL}</a>{" "}
        with the subject &ldquo;Delete my data&rdquo;. Because there&rsquo;s no account to look
        up, include the display name you used and roughly when you chatted, so we can find it.
        We&rsquo;ll delete it and reply within 30 days.
      </p>
      <p>
        Usage and crash data from Firebase Analytics and Crashlytics isn&rsquo;t linked to your
        name or anything that identifies you, so we can&rsquo;t match it to a request. It&rsquo;s
        deleted automatically under Firebase&rsquo;s retention periods (crash reports after 90
        days).
      </p>

      <h2><span className="num">8</span>Children</h2>
      <p>
        Bruno&rsquo;s Alarm isn&rsquo;t directed at children, and live chat&rsquo;s public nature
        means it isn&rsquo;t meant for them either. We don&rsquo;t knowingly collect information
        from children. If you believe a child has used chat inappropriately or shared personal
        information, email us and we&rsquo;ll remove it.
      </p>

      <h2><span className="num">9</span>Changes to this policy</h2>
      <p>
        If this policy changes, the date at the top changes with it. Continuing to use the app
        after an update means you accept the revised policy.
      </p>

      <h2><span className="num">10</span>Contact</h2>
      <p>
        Questions about this policy, the app, or a chat report:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
