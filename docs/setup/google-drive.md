# Google Drive Setup

Locoris supports Google Drive sync through the hidden `appDataFolder` space.

Desktop builds use the recommended native flow:

- system browser
- OAuth authorization code + PKCE
- local loopback callback on `127.0.0.1`
- refresh token stored in native secure storage

Web builds keep the browser OAuth flow.

## What You Need

- A Google Cloud project
- Google Drive API enabled
- An OAuth 2.0 **Web application** client for the web build
- An OAuth 2.0 **Desktop app** client for macOS and Windows builds
- A local `.env` file with the correct client IDs

## 1. Enable Google Drive API

In Google Cloud Console:

1. Create or open your project.
2. Open **APIs & Services**.
3. Enable **Google Drive API**.

## 2. Create OAuth Clients

In Google Cloud Console:

1. Open **APIs & Services → Credentials**.
2. Create **OAuth client ID** for the web app.
3. Choose **Web application**.
4. Add your local dev origins to **Authorized JavaScript origins**.

Typical local origins:

- `http://localhost:4173`
- `http://127.0.0.1:4173`

If you use a different Vite port, add that origin too.

Then create a second client:

1. Create another **OAuth client ID**.
2. Choose **Desktop app**.
3. Keep that client ID for the native macOS and Windows builds.

## 3. Configure Local Env

Create a local `.env` file in `apps/app`:

```bash
cp apps/app/.env.example apps/app/.env
```

Then set:

```env
VITE_GOOGLE_DRIVE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_ID=your-desktop-client-id.apps.googleusercontent.com
```

Notes:

- web uses `VITE_GOOGLE_DRIVE_CLIENT_ID`
- desktop prefers `VITE_GOOGLE_DRIVE_DESKTOP_CLIENT_ID`
- if the desktop variable is missing, desktop falls back to `VITE_GOOGLE_DRIVE_CLIENT_ID`

## 4. Run The App

### Web

```bash
cd /Users/dzen/bots/locoris
npm install
npm run dev
```

### Desktop

```bash
cd /Users/dzen/bots/locoris
npm install
npm run desktop:dev
```

Open the app, then:

1. Go to `Settings`
2. Open `Synchronization`
3. Click `Add connection`
4. Choose `Google Drive`
5. Authorize access in the system browser

After authorization, Locoris stores vault data in Google Drive `appDataFolder`, not in the user-visible Drive UI.

## 5. Desktop Callback Details

Native builds complete Google OAuth through a local loopback callback.

- Locoris opens the system browser
- Google redirects back to `http://127.0.0.1:<random-port>/oauth/google-drive`
- Locoris captures the authorization code locally
- the refresh token is stored in native secure storage

This keeps desktop OAuth out of embedded webviews and avoids browser-only popup flows.

## 6. What To Expect

- Google Drive becomes a regular sync method inside the existing multi-vault UI.
- Each remote vault gets its own file in `appDataFolder`.
- A manifest file tracks available remote vaults.
- Desktop builds can refresh Google sessions silently by using the stored refresh token.

## Current Limitation

At the current stage:

- Google Drive sync works through snapshot sync
- delta sync for Google Drive is not implemented yet
- encrypted Google Drive payload import is not enabled yet

The payload contract is already prepared for future E2EE rollout.
