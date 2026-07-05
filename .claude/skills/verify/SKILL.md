---
name: verify
description: Build/launch/drive recipe for verifying TooManyStreams changes end-to-end in a real browser.
---

# Verifying TooManyStreams

## Launch

- `npm run dev` → Vite on **http://localhost:4173** (background it).
- Twitch embeds only work on `localhost` or HTTPS (the `parent` param rejects LAN IPs). For a real phone, tunnel: `cloudflared tunnel --url http://localhost:4173`.

## Drive (no Playwright in repo)

Use **puppeteer-core** with the system Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`); install it in the session scratchpad, not the repo. Launch args that matter: `--autoplay-policy=no-user-gesture-required --mute-audio`.

- Mobile experience: `page.setViewport({width: 390, height: 844, isMobile: true, hasTouch: true})` — the app switches at `max-width: 767px` (`src/useMobileViewport.js`). Use `page.touchscreen` for drag gestures (PiP handle bar, resize grip).
- Headless profiles start with empty localStorage: seed streams by clicking "Add Stream" → "Add Sample Streams". Sample channels are often offline — the Twitch "X is offline" screen still proves the embed loaded.
- Prefer clicking by `aria-label` (`Focus <title>`, `Watch <title>`, `Minimize to mini player`, `Resize mini player`, …). Text-matching "Add Stream" is ambiguous — the header, empty state, and mobile Multiview tab all have one.

## Flows worth driving

- Feed → card Focus button → cinema (desktop overlay ≥768px, mobile tabbed view <768px).
- Mobile: Chat/Streams/Multiview tabs; Multiview add-sheet → add companions → reload → re-enter same stream → companions restored (localStorage `multiwatch.wall.focus`).
- PiP: minimize button → drag bar (snaps to edges), corner grip resize, tap bar to restore. Prefs in `multiwatch.mobile.pip`.
- Cross the 768px boundary while focused — should swap presentations without crashing.

## Gotchas

- **Headless Chrome does not reproduce the Twitch iframe occlusion tracker or mobile autoplay policy** — real playback/autoplay verdicts need a real device via the tunnel.
- `[page:error] Player stopping playback ... 404` console noise = offline sample channels, not a bug.
- `dist/` is tracked; `npm run build` rewrites it — expect diff noise.
- Tests: `node --test src/*.test.js` (node:test, no vitest).
