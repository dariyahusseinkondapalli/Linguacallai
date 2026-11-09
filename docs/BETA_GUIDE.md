# Android beta setup

This is an early ARM64 Android test build, not a production release. Android 7+
(API 24+) is required; Android 13+ is recommended for the speech capture pipeline,
and Android 14+ for automatic speech-language switching. No provider key, backend
URL, account or paid service is included. It does not translate cellular or other-app calls.

## Install

Download the APK from the GitHub beta release, open it on the phone, and permit
installation from that browser/file manager if Android asks. The release-variant
APK includes its JS bundle and does not need Metro. It uses a development signing
key and is intended for controlled testing. Use production signing before a public
store release. This APK supports arm64-v8a phones only.

## Connect your backend

1. On your computer install Node 22.13+ and run `npm ci` in the repository.
2. Copy `apps/api/.env.example` to `apps/api/.env`. Generate a random API_TOKEN per README.
3. Configure LIBRETRANSLATE_URL and optional provider key later. Start `npm run dev:api`.
4. For one USB-connected phone, run `adb reverse tcp:3000 tcp:3000` and enter
   `http://localhost:3000` and the operator token in Settings → Development API.
   For two phones or remote calls, use an HTTPS API you operate and configure it on both.
   No hosting is provisioned automatically. Release networking allows loopback HTTP only.
5. Settings → Beta account: choose a name and password (12+ characters); enter the
   operator enrollment token to register. Create a different account for each phone.
   Account tokens are stored in Android SecureStore. The operator token is only for
   enrollment/development; do not distribute it publicly.

## Translate nearby speech

In Translate choose FROM and TO. Tap Start listening and grant microphone permission.
The installed Android speech service may process audio in the cloud. The application
does not save audio recordings. Translation requires an installed provider language
pair. Install appropriate system TTS voices for spoken output. Captions are shown even
when no matching TTS voice is installed. Source-language selection is the reliable
fallback when automatic detection/switching is unavailable.

The app pauses recognition while playing translated speech. Stop, backgrounding,
audio interruption and route changes cancel capture/playback. Noise suppression and
echo cancellation attach only when Android exposes this app's active capture session.
The noise suppression badge reports the actual enabled effect state; availability
alone is not activation. Effectiveness is unmeasured until physical-device tests.

## Pair or call

Create a paired session or internet voice call in Calls. Share the 12-character invite
or QR; the other participant can scan it using their camera or enter it in Calls.
Both phones must use the same backend. Invites admit one other account; sessions
expire after one hour. Disconnected participants have a 30-second reconnection grace
period. Restarting the API ends all sessions. Going into the background ends the local
session; background microphone services are not implemented.

Paired mode exchanges recognized phrases over authenticated WebSocket signaling and
translates on the receiving phone through the API. When using nearby listening,
incoming translated phrases pause capture and play through TTS. Text phrases work too.
WebRTC voice calls carry original audio. Switch to translated voice turns to release
the WebRTC microphone before starting recognition; return to the call to restore it.
Both participants should enable translated turns for automatic translated speech
playback. In regular call mode translated captions can be played explicitly.
This is turn-based beta behavior, not validated simultaneous interpretation.

Configure ICE_SERVERS_JSON with your approved STUN/TURN services for internet calls.
Without TURN, some Wi-Fi/mobile/NAT combinations cannot connect. No TURN subscription
or guaranteed internet connectivity is bundled. Bluetooth output follows Android;
Settings → Audio output requests communication routing on Android 12+.

## Please test before relying on it

Validate Telugu, Hindi, English and Marathi with native speakers and a real provider.
Test microphone denial, no speech service, missing TTS voice, earbuds disconnect,
phone calls/audio focus, cancel during translation, Wi-Fi changes and session end.
Record device models and results before treating any language/device combination as validated.
