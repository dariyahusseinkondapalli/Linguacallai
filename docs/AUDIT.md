# Repository audit — 2026-11-08

Base commit: 667d330. Initial tracked files: `plan.md` only. Working tree was clean.
No app, backend, tests, dependencies or working features existed. Branch:
`feat/mobile-foundation`. The original roadmap is preserved below its progress note.

Current structure: apps/mobile (Expo), apps/api (Express), packages/shared
(language catalog/contracts), tests (API/provider/privacy tests), docs and CI.

Primary risks: Indian-language ASR/translation/TTS coverage, noisy-room quality,
Android microphone/output route differences, echo loops, battery use, TURN relay
cost, authenticating users, and inference latency. No physical Android device,
Bluetooth accessory, configured AI service or TURN credentials were supplied.

Development order: foundation → provider-backed text with native speaker review →
native microphone/route/ENC integration → VAD/ASR/TTS → nearby conversation →
authenticated pairing → normal WebRTC calling → bidirectional AI calling → beta.
This change implements the foundation and an independently testable text adapter;
it does not mark milestones requiring device or human verification complete.

Budget: dependency installation and local checks require no new paid services.
Public infrastructure and AI activation are deferred. See COST_ESTIMATE.md.
