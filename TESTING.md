# Testing

Automated checks: `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build:api`, `npm run build:web`. Tests cover auth, unavailable provider,
input validation, quota exhaustion, sanitization, provider pair checks,
low-confidence detection and consent-controlled history. HTTP fixtures are test
fixtures only, never available as a production translation option.

Manual Android acceptance (not yet executed):
- Fresh install → onboarding → language choice → tabs; Android Back and deep links.
- Font scaling, TalkBack labels, 48dp targets, Telugu/Devanagari glyphs, keyboard,
  portrait/landscape and tablet layouts.
- Enter an authenticated HTTPS API; wrong token, timeout, offline, unsupported pair,
  manual language fallback, cancel during request and switch language during response.
- Save history only after consent; restart persistence, search, delete and disable saving.
- Delete local data and verify token/history removed after restart.
- Future audio tests: permission denial/revocation, Bluetooth attach/detach, phone mic
  versus headset capture, actual active ENC/AEC, interruptions and feedback loops.
- Future quality tests: quiet room, street, office, transit, restaurant, fans/traffic;
  native-speaker review, latency to first audio, battery and memory measurements.

No automated test replaces the physical-device or native-speaker acceptance gates.
See docs/progress.md for commands actually run and their outcomes.

Browser smoke reproduction after exporting the web bundle:

```sh
npx playwright install chromium
python -m http.server 8080 --bind 127.0.0.1 --directory apps/mobile/dist
# In a second terminal:
npm run test:browser
```

The smoke test exercises actual UI components in Chromium. Native React Native
component behavior and permission tests remain pending until audio is implemented.
