# Guessly

Guessly is an installable forehead guessing game for groups. It includes five original decks, 30/60/90-second rounds, device-tilt scoring, touch and keyboard fallbacks, local stats, sound, haptics, and offline play.

## Run locally

```bash
npm install
npm run dev
```

Vite serves the app at `http://localhost:5173` by default.

## Quality checks

```bash
npm run lint
npm test
npm run build
```

## Production PWA

```bash
npm run build
npm run preview
```

The service worker is registered only in production builds. Device orientation and PWA installation require HTTPS in production; localhost is accepted for development and preview.

On a phone, hold the device sideways at your forehead, tilt down for a correct answer, and tilt up to pass. Touch controls remain available. On desktop, use the on-screen controls, `Enter`/down arrow for correct, and `Backspace`/up arrow to pass.
