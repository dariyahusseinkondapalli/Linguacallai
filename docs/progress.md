# Progress — 2026-11-08

Base: 667d330 (`plan.md` only). Branch: feat/mobile-foundation.

## Implemented

- Expo/React Native strict TypeScript foundation, reusable visual primitives and tokens,
  onboarding, five destinations, deep-link routes, native secure token storage.
- Language preferences and private-by-default local history, search/delete/reset.
- Node API and configurable LibreTranslate adapter with catalog-aware pair checks,
  detection confidence fallback, auth, limits, timeout and cancellation handling.
- API/provider/privacy tests, browser smoke script, CI and setup/architecture/cost docs.

## Verified in this environment

- `npm run typecheck`: passed for API, mobile and shared packages.
- `npm run lint`: passed.
- `npm test`: 10 tests passed, using explicitly labeled provider fixtures.
- `npm run build:api`: passed; built artifact starts and /health returns 200.
- `npm run build:web`: passed, 609 Metro modules.
- Chromium smoke: onboarding, navigation, unavailable-API feedback, history consent,
  deletion, reset and tablet viewport passed with no page errors.
- Phone-size home screenshot visually inspected at 390×844.
- `git diff --check`: passed.

## Blockers and next work

No physical Android device, Bluetooth accessory, Android SDK/adb, configured AI
endpoint/key or TURN service supplied. Java and Node are available. No APK was built.
Native glyphs, accessibility, audio/ENC, voice, pairing and calling are not validated
or implemented. No native-speaker review or real translation latency measurement.

Next: configure and review an actual regional-language provider; validate the Expo
app on a physical phone; implement Android capture/route/effect management before
ASR/TTS/VAD, pairing, and calling. Production account identity and durable metering
are required before exposing any multi-user service. No paid services or deployment.

# Native beta iteration — 2026-11-09

User requested the remaining implementation and an Android app, with provider setup
left for later. Added native speech recognition/TTS, foreground listening, automatic
speech endpointing and supported language switching, Android route/focus management,
NS/AEC attachment to visible app-owned capture sessions, local beta account lifecycle,
QR/invite pairing, authorized WebSocket signaling, WebRTC audio/mute and translated
voice turns with microphone handoff. No provider/backend/TURN service was purchased
or deployed. Added a manual Android build workflow and beta setup guide.

Validation so far: strict TypeScript and lint pass; all 15 tests pass; API bundle
builds; web export and Chromium phone/tablet interaction smoke pass. Account/session
tests use local sockets and SQLite; no media/device testing is implied. Android SDK,
NDK, CMake and JDK 17 were installed locally for APK build validation. Final APK build
result is recorded separately below when available.
