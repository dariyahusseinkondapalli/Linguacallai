# Known limitations

- Voice capture, ASR, TTS, VAD, Bluetooth route control, ENC, echo cancellation,
  nearby listening, QR pairing and WebRTC calls are not implemented. Screens state this.
- No live provider credentials or endpoint were supplied; adapter tests use HTTP
  fixtures. No live translation accuracy/latency or four-language coverage claim.
- No Android SDK/device/earbuds available: APK, native secure storage, font rendering,
  keyboard/safe areas, route behavior and permission flows remain unverified.
- No production user accounts, PostgreSQL storage, signaling, TURN or deployment.
- One development operator token protects the API. Not suitable for public distribution.
- Request allowance and rate counters reset on process restart. No durable spend cap.
- History is optional, limited to 100 entries, unencrypted app storage. Deletion removes
  app records; it does not guarantee forensic erasure or deletion at a cloud provider.
- Browser preview keeps API tokens in memory and does not support cross-origin API
  connections. Native application is the intended API client.
- App uses system fonts; bundled Noto fonts and native Indic glyph testing remain pending.
