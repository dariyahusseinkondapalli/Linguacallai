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
