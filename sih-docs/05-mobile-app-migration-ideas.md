# Mobile App Migration: Ideas and Approach

> Planning reference for when the team moves from the current Next.js web platform to a cross-platform mobile app. No mobile code exists yet.

---

## What Changes vs What Stays

The Gemini-powered AI backend (Genkit flows) lives server-side and stays completely unchanged. Only the client layer changes from a browser to a native app. Firebase Auth and Firestore work identically on mobile via their native SDKs — same project, same data, same security rules.

| Layer | Web (current) | Mobile (target) |
|---|---|---|
| UI | Next.js + React + Tailwind | React Native + Expo |
| Auth | Firebase Auth web SDK | Firebase Auth React Native SDK |
| Database | Firestore web SDK | Firestore React Native SDK |
| AI flows | Next.js Server Actions | Next.js API routes or Firebase Callable Functions |
| Camera | Browser file picker | expo-camera (live viewfinder) |
| Voice recording | MediaRecorder API | expo-av |
| Images | Base64 in Firestore | Firebase Cloud Storage (URL in Firestore) |
| Deployment | Vercel | Vercel (backend) + EAS Build (app binaries) |

---

## Recommended Framework: React Native with Expo

React Native is the right call here over Flutter because the entire existing codebase is TypeScript and React. Component concepts, hooks, context, and JSX transfer directly. The team does not need to learn a new language.

Expo specifically adds:
- `expo-camera`: live camera viewfinder for the image enhancer, no native config needed
- `expo-av`: audio recording for the voice cataloger
- `expo-file-system`: local file access for image processing
- Expo Go: test on a real phone instantly by scanning a QR code, no build required
- EAS Build: produces signed APK/IPA binaries for Play Store and App Store

---

## How Each Feature Maps to Mobile

### Feature 1: AI Image Enhancer

Web uses a file upload input and browser-side `@imgly/background-removal` (WebAssembly).

Mobile:
- Replace file input with `expo-camera` CameraView component for live capture
- Background removal via `@imgly/background-removal` does not run on React Native (no WebAssembly support)
- Use `remove.bg` REST API instead: send the captured image as base64, receive transparent PNG
- Sharp server-side processing stays exactly the same (called via the existing API route)
- Show before/after in a swipeable card using `react-native-reanimated`

### Feature 2: Multilingual Auto-Cataloger

Web uses `MediaRecorder` in the browser.

Mobile:
- Replace `MediaRecorder` with `expo-av` Audio recording
- Same Google Cloud Speech-to-Text and Translation API routes on the server are called unchanged
- Language selector becomes a native Picker component
- Transcription display becomes a scrollable text card

### Feature 3: Dynamic Pricing Assistant

Web calls `src/app/api/pricing/route.ts` via fetch.

Mobile:
- Same API route is called via fetch, no changes on the server side
- Pricing card becomes a native BottomSheet (using `@gorhom/bottom-sheet`)
- Price slider uses `@react-native-community/slider`

---

## The Backend Problem: Server Actions Do Not Work on Mobile

The current Genkit flows are called via Next.js Server Actions (`'use server'`). These only work inside a Next.js rendering context — a browser talking to a Next.js server. A React Native app cannot call Server Actions directly.

Two migration options:

### Option A: Convert to Next.js API Routes (Easier, Do This First)

Move each Server Action to a standard Next.js API route handler. The React Native app calls these via `fetch`. The Genkit flow code inside does not change at all.

```
src/app/api/generate-listing/route.ts     -- wraps artisan-ai-listing-generator
src/app/api/detect-craft/route.ts         -- wraps artisan-ai-type-detection
src/app/api/craft-story/route.ts          -- wraps artisan-ai-craft-story-generator
```

Auth: send the Firebase ID token in the `Authorization` header. Verify it server-side using Firebase Admin SDK before calling the Genkit flow.

### Option B: Firebase Callable Functions (Correct Production Architecture)

Wrap each Genkit flow in a Firebase Cloud Function. Firebase automatically verifies the user's auth token before the function runs.

```ts
export const generateListing = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  return await generateArtisanListing(data);
});
```

The React Native app calls this via `@react-native-firebase/functions`. No manual token handling needed.

For the hackathon: use Option A (faster). Option B is the production migration path.

---

## Image Storage Migration

Currently, product images are stored as base64 data URIs directly in Firestore documents. This must change for mobile:

- Mobile camera photos are 3-12 MB. Storing as base64 in Firestore is slow and expensive at that size.
- Firestore documents have a 1 MB size limit — a single phone photo already exceeds this.

Migration plan:
1. Enable Firebase Cloud Storage in the existing Firebase project (no new project)
2. Upload image to Cloud Storage: `gs://your-project.appspot.com/products/{productId}/{filename}`
3. Get the download URL and store that in the `images` field of the Firestore product document instead of base64
4. For Genkit flows that need the image (type detection, listing generator): fetch the download URL, convert to base64 server-side before passing to Gemini
5. Firestore security rules for the `images` field: no change (it now stores a URL string instead of base64)

---

## UI/UX for Low-Literacy Users on Mobile

The SIH requirement specifically calls out minimalist UI for low-literacy users:

- Large tap targets: minimum 48dp for all buttons
- Icon-first navigation: camera icon, mic icon, cart icon — labels optional
- Voice-first input as default: mic button is the primary CTA, typing is the fallback
- Progress bars for every AI operation so artisans know something is happening
- Two-screen flows: capture, then confirm. No multi-page forms
- `preferredLanguage` from the artisan's Firestore profile should drive the UI language, not just product content
- High contrast mode consideration for outdoor use in bright sunlight

---

## Suggested Mobile Tech Stack

| Need | Choice |
|---|---|
| Framework | React Native with Expo SDK 51+ |
| Navigation | Expo Router (file-based, same mental model as Next.js App Router) |
| Camera | expo-camera |
| Audio | expo-av |
| Auth | @react-native-firebase/auth |
| Database | @react-native-firebase/firestore |
| Storage | @react-native-firebase/storage |
| AI backend calls | fetch to existing Next.js API routes |
| UI components | React Native Paper or NativeWind (Tailwind syntax for React Native) |
| Animations | react-native-reanimated |
| Build and distribution | EAS Build + EAS Submit |

---

## Migration Order

1. Convert Server Actions to Next.js API routes one by one, test each via Postman
2. Set up Expo project in a `/mobile` subfolder of the same repo
3. Build auth screens using Firebase Auth mobile SDK (same Firebase project, existing users work immediately)
4. Build artisan upload flow using expo-camera, wiring to converted API routes
5. Build buyer marketplace using Firestore real-time listeners (same data, same rules)
6. Migrate image storage from base64 to Firebase Cloud Storage
7. Add expo-av voice recording for the auto-cataloger
8. Add remove.bg background removal for the image enhancer (replaces WebAssembly approach)
9. Test on real Android devices (primary target demographic uses Android, not iOS)
10. EAS Build for Play Store, then App Store
