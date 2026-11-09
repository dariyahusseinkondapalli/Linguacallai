# Known limitations — native beta

Implemented code now includes OS speech recognition/TTS, foreground nearby listening,
Android communication-device selection, capture-session NS/AEC attachment, paired
captions/voice turns, account lifecycle, authorized WebSocket sessions and WebRTC audio.
These native features still require real-phone acceptance testing.

- No translation endpoint/key was supplied; no real language-pair accuracy or latency
  is verified. LibreTranslate's installed models may omit Telugu/Marathi.
- Automatic speech-language switching depends on Android 14+ and installed models.
  Speech services may send audio to their own cloud. There is no app audio-file storage.
- ENC/AEC can attach only to an exposed app-owned audio session. A provider-managed
  capture session may not be visible; UI must not infer activation from availability.
- Translated calling uses explicit voice turns; original WebRTC microphone capture is
  released while the speech service owns the microphone. This is not full-duplex AI
  interpretation. Both phones need physical testing for microphone handoff and routing.
- The OS controls speech-service microphone selection. Bluetooth communication output
  selection can also change the microphone, and accessory compatibility varies.
- No background microphone service: backgrounding ends listening/calling. No push
  ringing, address book, password recovery, email verification or account federation.
- Local beta accounts use salted scrypt hashes and opaque expiring tokens in SQLite.
  Multi-instance PostgreSQL identity/session storage and durable spend metering remain.
- Sessions are in memory, expire after one hour and close after a 30-second disconnect
  grace period. API restart loses all sessions. No automatic session recovery after restart.
- Reliable remote calling requires operator-provided STUN/TURN. No service is deployed.
- Request counters reset with the API. Set provider-side hard quotas before paid use.
- Native testing, battery/latency/noise benchmarks and TalkBack audits are pending.
- Local optional history uses unencrypted app storage, with a 100-entry limit.
