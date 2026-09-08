# Feature 1: AI Image Enhancer and Studio

## What This Actually Is

A dedicated image processing pipeline using real computer vision models and image manipulation libraries. NOT a Gemini prompt. Gemini is not involved in this feature at all.

The artisan clicks "Enhance Image" on a popup, the image goes through three processing stages (background removal, lighting correction, professional formatting), and the cleaned result is what gets stored and fed into the rest of the upload flow.

---

## Where It Lives in the Existing System

The existing upload flow currently:
```
Artisan uploads photo --> stored as base64 --> fed into artisan-ai-type-detection (Gemini)
```

This feature adds an optional preprocessing popup before that:
```
Artisan uploads photo --> [Enhance Image popup] --> cleaned photo --> rest of existing flow unchanged
```

The enhance step is triggered by a button, not automatic. Artisan can skip it and use the original. Nothing else in the system changes.

---

## Technical Approach

### Stage 1: Background Removal

Use `@imgly/background-removal` — a JavaScript library that runs entirely in the browser via WebAssembly. No API key, no server call, no cost.

```bash
npm install @imgly/background-removal
```

It loads a pre-trained segmentation model (ONNX format) in the browser, processes the image, and returns a PNG with transparent background. Works well on textiles, pottery, jewelry.

If browser performance is a concern (older phones), fall back to the `remove.bg` REST API (50 free calls/month):
```
POST https://api.remove.bg/v1.0/removebg
Authorization: X-Api-Key YOUR_KEY
Body: image_file_b64=<base64>
```

### Stage 2: Lighting and Color Correction

Use `sharp` on the server side. No ML model needed here — apply standard photographic corrections:

- Auto-levels: normalize the histogram so darks are dark and lights are bright
- Sharpen: mild unsharp mask for crisp product edges
- Saturation boost: +15% to make craft colors pop

```bash
npm install sharp
```

```ts
sharp(inputBuffer)
  .normalise()           // auto-levels
  .sharpen({ sigma: 1 }) // mild sharpening
  .modulate({ saturation: 1.15 }) // color boost
```

No Gemini call. No prompt. Just deterministic image processing.

### Stage 3: Professional Formatting

Using `sharp`:
- Place the background-removed product on a 1000x1000 white canvas
- Pad with 5% margin so the product does not touch edges
- Export as JPEG at 85% quality

Output is a clean, e-commerce-ready square image identical in format to what platforms like Amazon and Etsy require.

---

## New Files to Create

```
src/lib/image-enhancer.ts       -- server-side sharp pipeline (stages 2 and 3)
src/components/ImageEnhancer.tsx -- the popup UI component
```

No new Genkit flow. No AI prompt. Pure image processing.

---

## UI: The Enhance Image Popup

Trigger: A button labeled "Enhance Photo" shown after the artisan selects an image in the upload wizard.

Popup behavior:
1. Show the original image
2. "Enhance" button triggers background removal (client-side via @imgly/background-removal)
3. Show progress indicator while processing
4. Send result to server for sharp processing (stages 2 and 3)
5. Show side-by-side before/after in the popup
6. "Use Enhanced" or "Keep Original" buttons
7. On confirm, enhanced data URI replaces original in component state

No Firestore changes. No schema changes. The enhanced image is just a better base64 string going into the same flow.

---

## Dependencies

```bash
npm install @imgly/background-removal sharp
```

`.env` additions only needed if using remove.bg API fallback:
```
REMOVE_BG_API_KEY=your_key
```

---

## Integration Checklist

- [ ] Install `@imgly/background-removal` and `sharp`
- [ ] Build `src/lib/image-enhancer.ts` with the sharp pipeline
- [ ] Build `src/components/ImageEnhancer.tsx` popup with before/after preview
- [ ] Wire the "Enhance Photo" button into the existing upload wizard
- [ ] Test on actual craft photos: sarees, pottery, jewelry, wood carvings
- [ ] Verify enhanced image base64 feeds correctly into `artisan-ai-type-detection` unchanged

---

## What Is NOT Touched

- All existing Genkit flows: completely untouched
- Firestore schema: no changes
- Gemini: not involved in this feature at all
- Buyer pages: unaffected
