# Espace iOS

Native SwiftUI shell for the Espace resident portal.

## Scope

- Resident-first app that uses the existing Espace backend API.
- Login with `/api/auth/login`, then resident data from `/api/resident/*`.
- Tabs for Acasa, Facturi, Contoare, Cereri, Avizier, and Cont.
- App Intents for opening a resident section and creating a quick request.

## Run

1. Open `ios/Espace.xcodeproj` in Xcode.
2. Select the `Espace` scheme and an iPhone Simulator.
3. Start the Espace backend locally:

```bash
npm run dev
```

4. Build and run the iOS app.

The default API base URL is `http://localhost:4000/api`, which works from the iOS Simulator when the backend is running on the same Mac. Change `AppConfig.defaultAPIBaseURL` for staging or production.

## Notes

- Tokens are stored in Keychain under `md.espace.resident`.
- `NSAllowsArbitraryLoads` is enabled for local HTTP development. Tighten this before production/TestFlight.
- App Intents are in `Espace/Intents` and intentionally expose a small surface: open a section or create a resident request.
