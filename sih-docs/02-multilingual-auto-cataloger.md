# Feature 2: Multilingual Auto-Cataloger

## What This Actually Is

A voice-to-listing pipeline using real Speech-to-Text and Translation APIs. NOT a Gemini prompt for transcription or translation. Gemini is only involved at the very end where the existing listing generator already runs — that part is untouched.

The artisan records a voice note in their regional language. A dedicated STT engine transcribes it. A dedicated Translation API converts it to English. That English text feeds into the existing `artisan-ai-listing-generator` flow exactly as typed input would. The artisan never has to type anything.

---

## Where It Lives in the Existing System

Existing listing flow:
```
Artisan types keywords + description manually
  --> artisan-ai-listing-generator (Gemini, existing, unchanged)
  --> product listing
```

New flow:
```
Artisan records voice note in regional language
  --> [Google Speech-to-Text API]  transcription
  --> [Google Cloud Translation API]  English text
  --> artisan-ai-listing-generator (Gemini, existing, unchanged)
  --> product listing
```

The listing generator receives the same shaped input as always. Only the source of that input changes. No modification to any existing Genkit flow.

---

## Technical Approach

### Step 1: Voice Recording (Browser)

Use the browser-native `MediaRecorder` API. No library needed. Works in Chrome and Firefox on Android and desktop.

```ts
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
recorder.start();
// ... on stop:
const audioBlob = new Blob(chunks, { type: 'audio/webm' });
```

The recorded blob is sent to a Next.js API route as a base64 string or FormData.

Supported regional languages for recording (set via the `BCP-47` language code on the STT API):
- Hindi: `hi-IN`
- Tamil: `ta-IN`
- Bengali: `bn-IN`
- Marathi: `mr-IN`
- Gujarati: `gu-IN`
- Telugu: `te-IN`
- Kannada: `kn-IN`
- Malayalam: `ml-IN`
- Punjabi: `pa-IN`

### Step 2: Transcription via Google Cloud Speech-to-Text

Use the **Google Cloud Speech-to-Text API v2**. This is a dedicated, purpose-built STT model — accurate on Indian regional languages and accents, far more reliable than a Gemini audio prompt.

```
POST https://speech.googleapis.com/v2/projects/{project}/locations/global/recognizers/_:recognize
Authorization: Bearer YOUR_GOOGLE_API_KEY

Body:
{
  "recognizer": "projects/.../recognizers/_",
  "config": {
    "languageCodes": ["hi-IN"],
    "model": "long",
    "features": { "enableAutomaticPunctuation": true }
  },
  "content": "<base64 audio>"
}
```

Returns the transcribed text in the original regional language.

Cost: Google provides $300 free credits on a new account. Speech-to-Text is roughly $0.004 per 15 seconds. For a hackathon prototype, the free tier is more than enough.

Alternative if Google credits are unavailable: **OpenAI Whisper** (open source model, can run locally or via API). Whisper supports all 9 Indian languages listed above.

```bash
# Local Whisper via Python (free, no API key)
pip install openai-whisper
whisper audio.webm --language hi --task transcribe
```

For the web prototype, call Whisper through a simple Python Flask sidecar or use the OpenAI Whisper API.

### Step 3: Translation via Google Cloud Translation API

Use the **Google Cloud Translation API v3** (Neural Machine Translation). This is NOT Gemini Translate. It is a dedicated NMT model optimized for speed and accuracy on Indian languages.

```
POST https://translation.googleapis.com/v3/projects/{project}:translateText
Authorization: Bearer YOUR_GOOGLE_API_KEY

Body:
{
  "contents": ["<transcribed regional text>"],
  "targetLanguageCode": "en",
  "sourceLanguageCode": "hi"  // or auto-detect
}
```

Returns clean English text. This English text is what gets passed to the listing generator.

Alternative: **LibreTranslate** (open source, free, self-hostable). Lower quality on Indian languages but no cost.

### Step 4: Feed into Existing Listing Generator

The translated English text maps to the existing `artisan-ai-listing-generator` input fields:

| What artisan says in voice | Maps to existing field |
|---|---|
| Product name / what it is | `productNameKeywords` |
| How it is made, materials used | `materials` |
| Story about the craft, family tradition | `storyFacts` |
| Anything else about the product | `existingDescription` |

A simple parsing step (or short Gemini extraction call, this is the ONE place Gemini can optionally help) maps the translated paragraph into these fields. The artisan then sees pre-filled text fields they can confirm or edit before generation.

---

## New Files to Create

```
src/app/api/transcribe/route.ts    -- Next.js API route: receives audio, calls STT API
src/app/api/translate/route.ts     -- Next.js API route: calls Translation API
src/components/VoiceRecorder.tsx   -- microphone UI component
```

No new Genkit flow needed. These are plain API route handlers.

---

## UI Changes

The existing upload wizard already has text input fields. This feature adds:

1. A language selector dropdown (Hindi, Tamil, Bengali, etc.) above the description area.
2. A microphone button next to the product description field.
3. On tap: start recording, show red recording indicator with timer.
4. On stop: show loading state while STT + translation runs.
5. Show transcription (regional language) and translation (English) side by side.
6. Pre-fill the form fields with the extracted content.
7. Artisan can edit pre-filled fields before proceeding.

Existing typed input fields stay as fallback. Nothing is removed.

---

## API Keys Needed

```
GOOGLE_CLOUD_API_KEY=your_key      # for Speech-to-Text and Translation
```

Or separately:
```
GOOGLE_STT_API_KEY=your_key
GOOGLE_TRANSLATE_API_KEY=your_key
```

---

## Integration Checklist

- [ ] Enable Google Cloud Speech-to-Text API and Translation API in Google Cloud Console
- [ ] Add API keys to `.env` and Vercel environment variables
- [ ] Build `src/app/api/transcribe/route.ts`
- [ ] Build `src/app/api/translate/route.ts`
- [ ] Build `VoiceRecorder.tsx` component with MediaRecorder
- [ ] Add language selector to upload wizard
- [ ] Wire recording output through transcription and translation routes
- [ ] Pre-fill listing form fields with translated content
- [ ] Test across Hindi, Tamil, Bengali before demo
- [ ] Confirm listing generator output quality is same as with typed input

---

## What Is NOT Touched

- `artisan-ai-listing-generator.ts`: unchanged, just receives better pre-filled inputs
- `translate-content-flow.ts`: separate concern, handles buyer-side outbound translation
- All other Genkit flows: untouched
- Firestore schema: no changes
- Buyer pages: unaffected
