import type { Metadata } from "next";
import LegalPage from "../_components/LegalPage";
import { CONTACT_EMAIL, TERMS_EFFECTIVE } from "../site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using Bruno's Alarm and its live chat.",
};

// Same content as mobile/terms-of-service.txt. Change both together.
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      effective={TERMS_EFFECTIVE}
      other={{ href: "/privacy", label: "Privacy Policy" }}
      summary={
        <p>
          Bruno&rsquo;s Alarm is provided as-is. It can&rsquo;t promise it&rsquo;ll always wake
          you, or that the video or chat will always be up. Be decent in chat, don&rsquo;t make
          it your only alarm for anything important, and see the Privacy Policy for how data is
          handled.
        </p>
      }
    >
      <p>
        These terms cover your use of Bruno&rsquo;s Alarm. By installing or using the app, you
        agree to them. If you don&rsquo;t, please don&rsquo;t use the app.
      </p>

      <h2><span className="num">1</span>What Bruno&rsquo;s Alarm is</h2>
      <p>
        Bruno&rsquo;s Alarm streams a real dog&rsquo;s twice-daily howl and lets you set alarms,
        either tied to Bruno&rsquo;s 6AM/6PM IST sessions or at a time you choose, plus a live
        chat while a session is on, and an always-open chat room, Bruno&rsquo;s Pack. There&rsquo;s no account or sign-up. Bruno is a real dog in a
        real home, so sessions, timing, and features can change or be interrupted without
        notice.
      </p>

      <h2><span className="num">2</span>Not a guaranteed wake-up device</h2>
      <p>
        The app depends on your phone&rsquo;s battery, its operating system, the right
        permissions being granted, and (for video and chat) an internet connection. None of
        these work every time. Don&rsquo;t rely on it as your only way to wake up for anything
        where being late would cause real harm, such as medical appointments, work, flights, or
        exams. We&rsquo;re not liable for missed alarms or their consequences.
      </p>

      <h2><span className="num">3</span>Live chat: conduct and moderation</h2>
      <p>Live chat is open only while a session is live; Bruno&rsquo;s Pack is always open. Both are public to everyone in them. By sending a message you agree to:</p>
      <ul>
        <li>Be respectful: no harassment, hate speech, threats, or targeting anyone, including us or Bruno&rsquo;s household.</li>
        <li>Not spam, flood, or try to disrupt chat for other viewers.</li>
        <li>Not impersonate anyone, including using a name reserved for moderators or staff.</li>
        <li>Not post anything illegal, or anything you don&rsquo;t have the right to share.</li>
      </ul>
      <p>
        Messages are checked automatically before posting (length, a profanity and
        impersonation filter, and rate limits). We may remove a message, block a device from
        chat, or restrict chat entirely, at our discretion and without notice. That isn&rsquo;t a
        promise we&rsquo;ll catch every violation. You can report a message or block a viewer
        yourself at any time; the Privacy Policy explains exactly what each does.
      </p>

      <h2><span className="num">4</span>No account, and what that means</h2>
      <p>
        There&rsquo;s no username, password, or account recovery. Your chat identity is a random
        per-device ID plus an optional nickname. If you uninstall or switch phones, that
        identity is gone and there&rsquo;s nothing for us to look up or restore.
      </p>

      <h2><span className="num">5</span>Your content</h2>
      <p>
        What you type into chat (a message or a display name) is yours, but sending it gives us
        permission to store, display, and moderate it to run the service, including keeping a
        reported message for review. Don&rsquo;t send anything you don&rsquo;t want that
        session&rsquo;s viewers to see.
      </p>

      <h2><span className="num">6</span>Intellectual property</h2>
      <p>
        The Bruno&rsquo;s Alarm name, app design, and Bruno&rsquo;s video belong to us or are used
        with permission. You can use the app for personal, non-commercial enjoyment. You may not
        copy, redistribute, rebroadcast, or make derivative works from the stream or recordings,
        or reverse-engineer the app, without our permission.
      </p>

      <h2><span className="num">7</span>No warranty</h2>
      <p>
        Bruno&rsquo;s Alarm is provided &ldquo;as is,&rdquo; without warranties of any kind,
        express or implied, including that it will be uninterrupted, error-free, or fit for a
        particular purpose. Video and chat depend on third-party infrastructure we don&rsquo;t
        control.
      </p>

      <h2><span className="num">8</span>Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, we aren&rsquo;t liable for indirect, incidental, or
        consequential damages from using (or being unable to use) the app, including a missed
        alarm, lost data, or anything you see in chat. Where local law doesn&rsquo;t allow some of
        these limits, only the ones it allows apply to you.
      </p>

      <h2><span className="num">9</span>Children</h2>
      <p>
        Bruno&rsquo;s Alarm isn&rsquo;t directed at children, and live chat isn&rsquo;t meant for
        them. If you believe a child is using the app inappropriately or has shared personal
        information in chat, email us.
      </p>

      <h2><span className="num">10</span>Changes to these terms</h2>
      <p>
        If these terms change, the date at the top changes with it. Continuing to use the app
        after an update means you accept the revised terms.
      </p>

      <h2><span className="num">11</span>Contact</h2>
      <p>
        Questions about these terms, or anything in chat:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
