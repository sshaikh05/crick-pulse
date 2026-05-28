# CrickPulse

CrickPulse is a mobile-first cricket highlights app built with Vite, React, TypeScript, Tailwind, shadcn/ui, a Node/Express API, MongoDB, JWT auth, and Capacitor.

## What It Does

- Match video upload with progress, retry, draft, and offline states
- Live scoring with innings, balls, extras, and wickets
- Highlight editor with timeline markers and share flow
- Player profiles, achievements, match history, leaderboard, search, and feed
- Email/password auth, Google OAuth, MongoDB user storage, and JWT sessions
- Capacitor packaging path for iOS and Android

## Requirements

- Node.js 22+
- npm 10+
- MongoDB connection string
- Google OAuth client ID
- iOS builds: macOS with Xcode
- Android builds: Android Studio and Java toolchain

Use the pinned runtime:

```bash
nvm use
```

## Environment

Create frontend `.env` with:

```bash
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Create `server/.env` with:

```bash
PORT=5000
CLIENT_URL=http://localhost:8080
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
```

## Web Development

```bash
npm install
npm run server
```

In another terminal:

```bash
npm run dev
```

The default Vite URL is:

```bash
http://localhost:8080/
```

## Checks

```bash
npm run lint
npm run test
npm run build
npm audit
```

## iOS / Android With Capacitor

Build the web app and sync it into native projects:

```bash
npm run cap:sync
```

Open native projects:

```bash
npm run cap:open:ios
npm run cap:open:android
```

Capacitor uses `dist` as the web output directory. After each web change that should ship in native apps, run `npm run cap:sync` again.

## Current Product Notes

The upload and share flows are ready for the app shell, but real AI highlight detection and downloadable rendered exports still need a processing worker/native export implementation. The UI now labels those states as queued/planned instead of pretending they are complete.
