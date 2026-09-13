// One-time local OAuth flow to get a YouTube Data API refresh token for this project's
// backend. Run this yourself once, from your own machine, signed into the Google account
// that owns Bruno's YouTube channel — it is not run by the app or by any cron job.
//
// Before running:
//   1. In Google Cloud Console, create a project, enable "YouTube Data API v3", and
//      create an OAuth 2.0 Client ID of type "Web application".
//   2. Add http://localhost:4321/oauth2callback to that client's "Authorized redirect URIs".
//   3. Run: GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/get-youtube-refresh-token.js
const http = require("http");
const { google } = require("googleapis");

const PORT = 4321;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (from your Google Cloud OAuth client) " +
      "as env vars, then re-run this script."
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/youtube"],
});

console.log("1. Open this URL, sign in with the account that owns Bruno's channel, and approve access:\n");
console.log(authUrl);
console.log(`\n2. Waiting for the redirect back to ${REDIRECT_URI} ...`);

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.url.startsWith("/oauth2callback")) {
    res.end("Not found");
    return;
  }
  const code = new URL(req.url, REDIRECT_URI).searchParams.get("code");
  if (!code) {
    res.end("No code in redirect — check the terminal for details.");
    return;
  }
  res.end("Success — you can close this tab and go back to the terminal.");
  server.close();

  const { tokens } = await oauth2Client.getToken(code);
  console.log("\nAdd these to your .env.local:\n");
  console.log(`GOOGLE_CLIENT_ID=${clientId}`);
  console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log("\n(YOUTUBE_CHANNEL_ID still needs to be set separately — it's the channel ID, not from this flow.)");
  process.exit(0);
});

server.listen(PORT);
