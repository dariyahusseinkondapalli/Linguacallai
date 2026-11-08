# Implementation progress — 2026-11-08

Repository audited: only this roadmap existed. Foundation and provider-backed text
implementation added on `feat/mobile-foundation`. See `docs/progress.md`.
Physical-device milestone exits remain pending; no voice/call capability is claimed.

# LinguaCall AI — Complete Step-by-Step Product & Engineering Plan

**Status:** Planning | **Version:** 1.0 | **Date:** 2026-11-06

**Tagline:** *Your Language. Their Language. One Conversation.*

## Mission and constraints

Build a premium, accessible, Android-first multilingual communication product for families, travelers, and workers. Users can use compatible Bluetooth TWS earbuds, neckbands, wired earphones, USB-C headsets, and phone speakers. Start with a realistic Telugu ↔ Marathi demonstration and grow toward other languages and translated WebRTC in-app calling.

- Hardware: HP Intel Core i5, 8 GB RAM, 512 GB SSD; test with physical Android phones instead of emulators.
- Coding: existing Codex subscription; modular TypeScript and open-source-first components.
- Operating budget: ₹1,000/month during prototype, with expense tracking and no paid recurring services without explicit approval.
- 100+ languages is a language catalog architecture target, **not** verified ASR/translation/TTS support for 100+ languages.
- Do not claim to translate SIM/WhatsApp calls or bypass operating system audio restrictions.
- No fake demos or simulated functionality presented as real.

## Product principles

1. Native-language labels, large accessible controls, a simple home screen, one-tap session start, and premium navy/blue/white design.
2. Two prominently visible tasks: **Translate Now** and **Start AI Call**.
3. Device and microphone status visible at all times during voice translation or calling.
4. Honest language capability badges based on provider and actual tests.
5. Secure and private by default: opt-in transcript saving, clear consent, and no default recording.
6. Android-first; plan for iOS later without promising parity.

## Technology decisions

- **App:** React Native + TypeScript, Expo development builds (not Expo Go for custom native audio).
- **Navigation/UI:** React Navigation or Expo Router, design tokens, accessible components, localization.
- **Android audio:** Native module using AudioManager/AudioDeviceInfo and appropriate communication-device routing; handle permissions, audio focus, wired/Bluetooth disconnection, and supported foreground services.
- **Backend:** Node.js, Express, WebSocket, SQLite for local development.
- **Calling:** WebRTC, signaling via WebSocket, STUN and configurable TURN. TURN has bandwidth/hosting implications.
- **AI pipeline:** Voice activity detection → speech-to-text → translation → speech synthesis, all behind interchangeable provider interfaces. Benchmark each actual model's supported languages, performance, RAM/VRAM, licensing, and latency. If only a mock exists, mark it as mock.
- **Scale:** separate stateless signaling/API, media transport, GPU inference, identity, monitoring and metering; don't use a laptop as a production server.

## Milestone 0 — Product validation and setup

- [ ] Define Telugu ↔ Marathi family call and Telugu ↔ Kannada workplace scenarios.
- [ ] Define measurable quality: task completion, comprehensibility, errors, time to first audio, end-to-end latency, cost per translated minute.
- [ ] Audit competing products without assuming unique features.
- [ ] Confirm Android devices and earbuds/neckbands available for hands-on tests.
- [ ] Install Git, Node LTS, VS Code, Android platform tooling, and Codex on laptop; validate versions and free disk/RAM.
- [ ] Choose project license, branch strategy, backlog, acceptance tests, and secret-handling rules.

**Exit:** documented target user, test devices, setup verified, no unapproved recurring costs.

## Milestone 1 — Repository foundation and premium app UI

- [x] Monorepo: `apps/mobile`, `apps/api`, `packages/shared`, `docs`, `tests`.
- [x] React Native/Expo TypeScript development-build setup and Node/Express health endpoint.
- [ ] Theme tokens: midnight navy, electric blue, soft white, accessible contrast, large touch targets and light/dark modes.
- [ ] Screen navigation: Home, Text Translate, Live Voice, Conversation, AI Calling, Language Picker, Settings.
- [ ] Large primary buttons for Translate Now / Start AI Call, language swap, and audio status.
- [ ] Basic reusable states: loading, recording, translating, speaking, disconnected, error.
- [ ] Automated lint, TypeScript checks, unit tests and CI where free.

**Exit:** mobile app builds on a physical Android phone; navigation and accessibility reviewed; every mock screen clearly labeled.

## Milestone 2 — Language catalog and real text translation

- [ ] Catalog architecture for 100+ language metadata entries; each has native name, locale, directionality and capability flags.
- [ ] Separate text/ASR/TTS/live/call/offline support records by provider and validated language pair.
- [ ] Implement real text translation behind a provider abstraction; document model weights, licensing, deployment and failure fallback.
- [ ] Prioritize Telugu, Marathi, Hindi, English, Tamil, Kannada and Malayalam.
- [ ] Test translations on sample everyday family/travel/workplace phrases reviewed by fluent speakers.

**Exit:** at least one actual Indian-language text pair passes human review; unsupported pairs are clearly unavailable, never silently mocked.

## Milestone 3 — Android audio compatibility (mandatory)

- [ ] Device detection: phone microphone/speaker, standard Bluetooth TWS, Bluetooth neckband, Bluetooth over-ear, wired 3.5 mm and USB-C headsets.
- [ ] Input/output indicators and route-selector UI where Android supports the operation.
- [ ] Test both Bluetooth audio playback and headset microphone capture separately; account for A2DP versus Bluetooth communication-profile limitations.
- [ ] Detect headset attach/detach and audio-focus interruptions, handle phone calls, reconnect and permission denial.
- [ ] Use appropriate supported Android routing APIs and foreground service behavior for live microphone sessions.
- [ ] Test Bluetooth earbuds and neckbands before and after session start, device switching and switching to speaker.
- [ ] Ensure no unintended speaker leakage after device transitions where feasible.

**Exit:** translated test audio plays via actual earbuds, neckbands and wired devices, with route-change results recorded for each tested Android phone. Do not assume compatibility for every model.

## Milestone 4 — Hands-free live translation

- [ ] Explicit session Start/Pause/Resume/Stop; continuous listening while session active without tapping per sentence.
- [ ] VAD/turn detection; ASR → text translation → TTS; original and translated captions.
- [ ] Prevent speaker playback from triggering repeated transcription where feasible, with echo control and clear turn states.
- [ ] Handle silence, overlapping speech, loud locations, weak network, microphone errors and timeouts.
- [ ] Track end-to-end latency, word errors, understandability, memory use and translated-minute costs.
- [ ] Test Telugu ↔ Marathi, Telugu ↔ Kannada and Hindi ↔ English on real devices; record failures and model language limits.

**Exit:** reproducible hands-free demo on at least one validated pair through real earphones/neckband, with actual measured metrics.

## Milestone 5 — Face-to-face conversation mode

- [ ] Two user-language panels with readable original and translated captions.
- [ ] Automatic or explicit turn switching as appropriate; no uncontrolled listening loops.
- [ ] Volume/audio routing options and privacy notice.
- [ ] Test practical tasks with two different-language speakers in a shared room.

**Exit:** two participants can complete a short task with understandable translated turns and measured latency.

## Milestone 6 — In-app WebRTC calling foundation

- [ ] Account onboarding, authentication, contact/invite workflow, consent and call controls.
- [ ] WebSocket signaling, WebRTC audio, STUN and TURN configuration.
- [ ] Call states: ringing, accept/reject, mute, route select, disconnect/reconnect and errors.
- [ ] Network handling for Wi-Fi, mobile data, NAT restrictions, packet loss and interruptions.
- [ ] Security model documented: server translation requires decrypting media at the trusted processing boundary; do not falsely claim end-to-end encryption end-to-end through AI processing.

**Exit:** reliable normal in-app calls on two separate devices and networks before adding translation.

## Milestone 7 — Bidirectional translated AI calling

- [ ] Speaker A's audio → STT → translation to B's language → TTS sent to B; reverse independently for B → A.
- [ ] Separate caller and callee languages and synchronized captions; maintain low delay and understandable turn-taking.
- [ ] Respect selected audio device on both phones; explicit microphone/call and translation consent.
- [ ] Validate Telugu-speaking family member ↔ Marathi-speaking family member scenario with live users.
- [ ] Meter per-direction speech inference and call infrastructure to prevent unexpected costs.
- [ ] Measure real-world quality, privacy, end-to-end latency and call completion rate.

**Exit:** real two-device Telugu ↔ Marathi translated call, both wearing standard compatible earphones, with evidence and logged performance; no fake demo.

## Milestone 8 — Quality, accessibility and security

- [ ] Usability tests with first-time smartphone users and speakers of target regional languages.
- [ ] Accessibility: font scaling, high contrast, screen-reader labels, touch targets, RTL languages and clear microphone indicators.
- [ ] Privacy review: minimal logs, clear retention and deletion, no recording/transcript storage by default, transport encryption, secret management.
- [ ] Unit, integration, Android-device, audio route, latency, network recovery and battery tests.
- [ ] Crash reporting and privacy-conscious observability; basic security review and threat model.

**Exit:** high-priority defects resolved and test evidence documented.

## Milestone 9 — Limited public beta and cost validation

- [ ] Recruit 20–50 initial testers from real family, traveler and employee use cases.
- [ ] Define free-tier minutes and hard rate/cost caps; cap total monthly spend at ₹1,000 unless approved otherwise.
- [ ] Monitor active users, sessions, completion, repeat usage, accuracy, latency and unit economics.
- [ ] No unlimited free translated calls unless infrastructure and inference costs are proven sustainable.
- [ ] Review app store policies, privacy statement, support contact, accessibility and user feedback.

**Exit:** documented usage metrics, satisfaction, costs and next go/no-go decision.

## Milestone 10 — Investor demo and production-scale readiness

- [ ] Create honest live demo with real-language translations, supported Bluetooth accessories and translated calls.
- [ ] Benchmark competitors and validate a specific advantage for Indian regional-language accessibility and simplicity.
- [ ] Build architecture for horizontal API/signaling scale, resilient TURN, media services, distributed inference, database and monitoring.
- [ ] Capacity plan around **concurrent translated call minutes**, not registered users; load-test rather than guessing GPU counts.
- [ ] Prepare realistic unit-economics, retention, technical differentiation, privacy story and investor deck.
- [ ] Defer paid global scale infrastructure until validation or funding.

**Exit:** working demonstrable core experience, credible cost model and grounded investor story.

## Monthly ₹1,000 guardrail

| Budget line | Maximum planned spend |
|---|---:|
| AI/testing usage | ₹500 |
| Hosting/networking | ₹200 |
| Test data and incidental costs | ₹200 |
| Contingency | ₹100 |
| **Total** | **₹1,000** |

These are budget envelopes, not provider prices. Start at ₹0 recurring where possible. Track every provider's pricing and disable any service approaching the cap. This covers experimentation, not general public translated calling at scale.

## Test device acceptance matrix

- [ ] Bluetooth TWS before starting session
- [ ] Bluetooth neckband before starting session
- [ ] Earbuds connected mid-session
- [ ] Neckband disconnected mid-session
- [ ] Bluetooth microphone capture verified separately
- [ ] Translated playback routed to earbuds/neckband
- [ ] Wired 3.5 mm headset
- [ ] USB-C headset
- [ ] Switch between speaker, wired and Bluetooth
- [ ] Bluetooth on both sides of an in-app call
- [ ] Wi-Fi and cellular call testing
- [ ] Incoming phone calls/audio focus interruptions
- [ ] Permissions denied/revoked
- [ ] Background/foreground behavior as Android versions permit

Record: phone model, Android version, headset model, transport/profile, input route, output route, observed result, latency, bugs and evidence.

## Codex execution protocol

1. Read `plan.md` fully and summarize the current milestone and its dependencies.
2. Implement **only the next incomplete milestone** using small, reviewable changes.
3. Prefer simple solutions on an 8 GB laptop and test on an actual Android phone.
4. Before adding packages/models, document license, hardware usage, cost and language coverage.
5. Add automated tests and a physical-device checklist for each change.
6. Run available checks and report exact outcomes; do not claim any unrun tests passed.
7. Update `plan.md` milestone checkboxes and `docs/progress.md` with verified progress, blockers and next tasks.
8. Do not spend money, deploy paid services or claim production readiness without explicit approval.

## First Sunday session

- [ ] Clone repository on the HP laptop.
- [ ] Inspect Node, Git, Android and Codex installation; avoid unnecessary emulator overhead.
- [ ] Scaffold React Native/TypeScript Expo development build and Express backend.
- [ ] Create premium design tokens and Home/navigation screens.
- [ ] Run lint/typecheck/tests, launch app on Android physical device and record any setup issues.
- [ ] Commit work and update plan progress.

**Definition of done:** A milestone is completed only when code, tests, manual verification where required, documentation and cost reporting are complete.