# Genkit AI Integrations

The AI in Virasya is powered by **Google Genkit** using the **Gemini 2.5 Flash** model. These are real server-side flows triggered by the artisan's actions.

## 🤖 Core Flows (`src/ai/flows/`)

### 1. Vision Analysis (`artisan-ai-type-detection.ts`)
- **Trigger**: Artisan uploads a photo.
- **Action**: Gemini analyzes the image pixels.
- **Output**: Detects craft category, materials, and suggests a title/description.
- **Realism**: It uses the image content to prevent "hallucination" of irrelevant details.

### 2. Story Generator (`artisan-ai-craft-story-generator.ts`)
- **Philosophy**: "Authenticity First".
- **Logic**: The prompt strictly instructs the AI to use provided facts (region, material) and avoid inventing personal or family histories.

### 3. Marketing Generator (`artisan-ai-marketing-generator.ts`)
- **Action**: Takes the final product description and converts it into social-ready snippets.
- **Constraints**: Word counts are strictly enforced (Instagram < 60 words, WhatsApp < 25 words).

### 4. Translation Engine (`translate-content-flow.ts`)
- **Capability**: Hindi, Tamil, Bengali, Marathi, English.
- **Nuance**: It is instructed to keep cultural proper nouns intact (e.g., "Khurja" or "Madhubani") while translating the surrounding descriptive text.

## 🎨 Client-Side AI Preprocessing (`src/components/ImageEnhancerStudio.tsx`)

Before photos are passed to Genkit Vision flows, they go through the **AI Craft Studio Enhancer**:
- **AI Background Removal**: Powered by `@imgly/background-removal` (in-browser ONNX/WASM AI segmentation, 100% free with zero API cost).
- **Studio Formatting & 3D Drop-Shadow**: Centers craft on a 1:1 $2048 \times 2048$ studio canvas with customizable backdrops (Studio White, Warm Heritage, Cool Slate, Transparent PNG) and directional soft 3D drop-shadows.
- **Studio Lighting & Color Tuning**: Auto/manual fine-tuning for **Studio Lighting (Brightness)**, **Contrast & Depth**, **Pigment Saturation**, and **Pixel Micro-Sharpness** (3x3 unsharp convolution matrix).
- **HD Super-Sampling**: 1.5x bicubic resolution upscale for high-frequency detail enhancement.


## 🛠 Technical Implementation
- **Server Actions**: Next.js Server Actions call Genkit flows directly from the client.
- **Streaming**: Genkit supports streaming for long stories.
- **API Key**: Requires `GEMINI_API_KEY` in your environment variables for Genkit AI flows; image enhancement runs 100% in-browser for free.

