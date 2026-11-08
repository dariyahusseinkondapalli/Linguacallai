# LinguaCall AI

Break Language Barriers. Connect Every Voice.

Android-first Expo/React Native application and a local Node API. This is an early
implementation, **not a complete voice translation product**. The repository began
with only `plan.md`. See `docs/AUDIT.md` and `KNOWN_LIMITATIONS.md`.

## Implemented

- Light-first responsive UI, onboarding, five tabs, language selection and deep links.
- Telugu, Hindi, English and Marathi language metadata.
- Real LibreTranslate HTTP adapter, provider catalog checks, automatic language
  detection, low-confidence fallback, cancellation and error handling.
- Explicit text submission; history off by default; optional local history/search/deletion.
- Native secure token storage, authenticated development API, input validation,
  rate limiting and bounded requests. No runtime mock translator.

Translation requires a configured provider whose installed models support the pair.
No language accuracy or physical-device compatibility has been validated yet.
Nearby listening, Bluetooth/ENC, pairing and calls are explicitly unavailable.

## Run locally

Use Node 22.13+ or Node 24, npm, and a physical Android phone. No Docker is required.

```sh
npm ci
cp apps/api/.env.example apps/api/.env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the generated value in `API_TOKEN` in `apps/api/.env`. Configure
`LIBRETRANSLATE_URL` with an endpoint you operate or explicitly choose; optionally
set its server-side key. Without it the API starts but translation returns 503.
Never put the provider key in the mobile app. Review provider prices and retention
before sending real conversations. No provider is provisioned by this project.

```sh
npm run dev:api
npm run dev:mobile
```

In mobile Settings enter the API URL and development token. For a USB-connected
Android device, run `adb reverse tcp:3000 tcp:3000` and use `http://localhost:3000`.
Remote endpoints require HTTPS. The API binds to loopback by default. The shared
operator token is for local development only: do not distribute it in a public app.
The browser export is a UI preview; cross-origin API access is not enabled.

## Android development build / APK

Install JDK 17 and the Android SDK (Android Studio command-line tools are enough).
Set `ANDROID_HOME` and put platform-tools in PATH. Enable USB debugging on a phone.
Then, from `apps/mobile`:

```sh
npx expo prebuild --platform android
npx expo run:android --device
# Windows
cd android
gradlew.bat assembleDebug
# Linux/macOS: ./gradlew assembleDebug
```

The development APK appears under `android/app/build/outputs/apk/debug/` and uses
Metro for the development JS bundle. A distributable release needs signing and a
release build with bundled JS; it has not been generated or verified here. Do not
commit signing keys. No paid EAS build is necessary for local builds.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run build:api
npm run build:web
```

See `TESTING.md` for exact evidence and remaining device checks. Architecture,
provider choices and budget assumptions are in `ARCHITECTURE.md`,
`docs/DEPENDENCIES.md`, and `COST_ESTIMATE.md`.
