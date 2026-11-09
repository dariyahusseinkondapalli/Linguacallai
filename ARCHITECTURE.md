# Architecture

`apps/mobile` uses Expo development builds, React Navigation bottom tabs and shared
language metadata. Preferences and opt-in transcripts use AsyncStorage; operator
API tokens use SecureStore on Android/iOS and memory only in web preview. Text is
submitted only through an explicit action. No audio permission is requested yet.

`apps/api` validates and authenticates requests before invoking a TranslationProvider.
LibreTranslate is the first concrete adapter: /languages verifies installed pairs,
/detect resolves automatic source selection and /translate returns translated text.
The API does not persist text or audio and does not log request bodies. Provider
retention is outside the API's control. HTTPS is required off loopback. Detection
confidence is provider-reported, not an independently calibrated probability.

Request cancellation propagates to fetch and timeouts bound inference. Errors are
sanitized. Rate limiting and a conservative process-lifetime request allowance are
local-development protections, not a durable financial cap. The shared token is an
operator development credential; identity/OIDC and per-user authorization must replace
it before multi-user release. Browser CORS is deliberately not enabled.

## Planned native audio boundary (not implemented)

An Android Expo module will own AudioRecord, microphone permissions, audio focus,
AudioDeviceCallback, AudioManager routes and supported NoiseSuppressor /
AcousticEchoCanceler effects tied to the actual capture audio session. The UI must
receive measured supported/active states. No headset mic quality assumptions.
Capture → suppression → VAD → ASR/language detection → translation → TTS → playback.
Cancellation must stop capture and synthesis; route loss must pause playback until
confirmed to avoid private speech leaking through speakers. Half-duplex gating
prevents playback feedback initially; full duplex requires device validation.

## Planned session boundary (not implemented)

PostgreSQL will store user/session membership and consent metadata, without default
conversation storage. OIDC-backed access tokens, short-lived single-use invites,
WebSocket membership authorization, two-participant limits, heartbeat expiry and
reconnection leases precede WebRTC integration. ICE uses configured STUN/TURN.
Media encryption terminates wherever cloud AI processing occurs; this cannot be
advertised as end-to-end encrypted through the AI provider. No production schema
or signaling service is claimed in this version.

## Native beta implementation (supersedes planned boundaries above)

Expo Speech Recognition adapts Android SpeechRecognizer and performs speech endpointing;
Expo Speech uses installed TTS voices. Foreground listening is half-duplex: recognition
stops for translation/playback and restarts afterwards. No recording files are retained.
`LinguaAudioModule` handles communication-device enumeration/selection, focus,
route-change callbacks and app-owned capture-session NoiseSuppressor/AcousticEchoCanceler.
Effects are attached only to non-redacted recording session IDs; actual enabled state
is emitted separately from support. Android-controlled speech capture remains a limitation.

`Accounts` stores salted scrypt passwords and hashed seven-day bearer tokens in local
SQLite. Registration requires a beta enrollment secret; login is rate-limited. Delete
revokes tokens and sessions. This is a single-instance beta; PostgreSQL migration,
password recovery and production identity controls are not implemented.

`Sessions` issues 72-bit single-use invite codes and 256-bit scoped member capabilities.
WebSocket clients authenticate in their first message within five seconds. Two users
maximum, bounded message schemas, rate limits, heartbeats, one-hour expiry and 30-second
reconnect grace constrain session lifetime. Captions are relayed, never persisted.
Only the designated initiator creates WebRTC offers. ICE configuration comes from the
operator. WebRTC requests audio processing and encrypts media; cloud translation and
OS speech services are separate trust boundaries.

Translated voice turns detach/stop the WebRTC sender track, let the speech service
capture, and replace the sender track when returning to the call. Incoming translated
speech pauses recognition to limit feedback. Physical-device testing is still required.
