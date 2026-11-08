# Dependency decisions

Expo SDK 54, React Native, React Navigation, React, TypeScript, Express, Zod,
Vitest, Supertest, ESLint and esbuild use permissive MIT/Apache/BSD licenses
(see installed packages for their notices). No inference model is bundled.
Expo development builds support future native audio; Expo Go cannot validate that work.
Metro and Node run locally; use a physical Android phone on an 8 GB laptop.
No Docker, GPU, paid hosting or API subscription is required for development.

Translation uses an optional operator-supplied LibreTranslate endpoint. LibreTranslate
is AGPL-3.0; hosted operators set their own pricing and supported model languages.
Its installed model catalog must advertise a pair before the app enables it.
Telugu/Hindi/Marathi/English are UI selections, not claims of provider coverage.
Argos/LibreTranslate avoids proprietary coupling but model coverage may exclude
Telugu and Marathi. IndicTrans2 is a future evaluation candidate, not included:
model licensing, memory and remote hosting need review. Cloud ASR/TTS providers
remain unselected until regional language quality and budget are validated.
