# Multiwatch

Simple multi-stream browser viewer for Twitch and YouTube Live.

## Run

1. Install dependencies and start the Vite development server:

```powershell
npm install
npm run dev
```

2. Open `http://localhost:4173`.

Serving the app over `localhost` matters for Twitch embeds because Twitch requires a `parent` domain parameter.

## Twitch Discovery Setup

The header search uses Twitch OAuth in the browser and does not require a client
secret.

1. Register a Twitch application and add `http://localhost:4173/` as an OAuth
   redirect URL.
2. Copy `.env.example` to `.env.local` and set `VITE_TWITCH_CLIENT_ID` to the
   registered app's client ID.
3. Set `VITE_TWITCH_REDIRECT_URI` to the exact registered redirect URL when
   using a different hostname or deployment URL.

The Twitch connection token is saved in browser local storage until it expires
or the user selects Disconnect.

## Features

- immediate stream mounting for a responsive multi-stream wall
- responsive full-width grid with a saved global `2` / `3` / `4` cards-per-row maximum
- multi-select stream focus with at least one selected at all times
- theater mode with a large featured stage and bottom rail navigation
- dual-main theater stage when theater mode starts with exactly two focused streams
- `All Audio` toggle to unmute every loaded stream
- drag-and-drop card reordering
- add/remove stream cards
- Twitch channel discovery with live/offline status and quick add
- connected Twitch projects place currently live channels first
- stream cards stay mounted while scrolling, with Twitch embeds started muted when autoplay is permitted
- cinema mode requests playback explicitly for focused Twitch streams
- local persistence for streams, selection, audio mode, and column preference

## Notes

- Browsers may block autoplay with sound until you interact with the page.
- Twitch and Kick embed behavior can vary by browser and by each platform's current autoplay policies.
- Theater mode is intentionally session-only and resets back to the grid after refresh.
