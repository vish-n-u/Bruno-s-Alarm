import Countdown from "./Countdown";
import VideoPanel from "./VideoPanel";
import NotifyButton from "./NotifyButton";

export default function Home() {
  return (
    <main>
      <header>
        <h1>🐕 Bruno's Alarm</h1>
        <p>Bruno reacts to the 6AM &amp; 6PM church bell, every single day.</p>
      </header>

      <div className="card">
        <Countdown />
      </div>

      <div className="card">
        <VideoPanel />
      </div>

      <div className="card">
        <NotifyButton />
      </div>

      <footer>Sessions air twice daily at 6:00 and 18:00 India Standard Time.</footer>
    </main>
  );
}
