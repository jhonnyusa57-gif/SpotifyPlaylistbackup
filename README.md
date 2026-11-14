# streamlifyBackup

Back up your Spotify playlists and liked songs as JSON, then import them into a new account.
Built with Next.js and the official Spotify Web API (OAuth). No database and no cookies scraped.

## How it works
1. **Log in** with your old account
2. **Export** to download `streamlify-backup.json`
3. **Switch account** and log in with your new account (Spotify asks which account every time)
4. **Import** the same JSON file and your playlists and liked songs are recreated

> Note: audio files are never downloaded (that would break Spotify's terms). Only the track **list** (names, artists, links) is migrated.

## Run locally
1. Install Node.js 20.9 or newer (nodejs.org)
2. `npm install`
3. Fill in `.env.local` (the Client ID is already set; paste your **new** Client Secret)
4. `npm run dev`
5. Open **http://127.0.0.1:3000** (use `127.0.0.1`, not `localhost`, so it matches the Spotify redirect)

## Spotify dashboard setup
developer.spotify.com/dashboard → your app → add both **Redirect URIs**:
- `http://127.0.0.1:3000/api/callback` (local)
- `https://<your-app>.vercel.app/api/callback` (after you deploy)

## Deploy to Vercel
1. Push the code to GitHub
2. vercel.com → New Project → import the repo
3. Add these **Environment Variables**:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET` (the new one)
   - `SPOTIFY_REDIRECT_URI` = `https://<your-app>.vercel.app/api/callback`
4. Deploy, then add that URL to the Spotify dashboard Redirect URIs as well

## Security
- `.env.local` is not committed (it is in `.gitignore`). Never put the secret in code or a commit.
- If the secret ever leaks, rotate it in the Spotify dashboard right away.
