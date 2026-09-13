# Virasya App — Local Setup Instructions

This document provides step-by-step instructions to get the **Virasya** application running on your local machine.

---

## 📋 Prerequisites

Before starting, ensure you have the following installed on your machine:

1. **Node.js**: Version 20.x or higher ([download Node.js](https://nodejs.org/))
2. **npm** (comes bundled with Node.js) or **bun** / **yarn**
3. **Google Gemini API Key**: Obtain a free API key from [Google AI Studio](https://aistudio.google.com/)

---

## 🔑 Environment Setup

Virasya leverages Google Genkit for AI flows (Vision craft detection, multilingual cataloging, listing generation, price recommendations, and Q&A).

> [!IMPORTANT]
> **Only ONE environment variable is required** to run the app locally: `GEMINI_API_KEY`.
> Firebase authentication and database sync come pre-configured with fallback development credentials in `src/firebase/config.ts`.

### Create `.env` File

Create a file named `.env` in the root directory of the project:

```env
# Required: Google AI Studio API Key for Genkit AI Flows
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 🚀 Installation & Running

### Step 1: Clone Repository & Install Dependencies

Open your terminal and run:

```bash
# Clone the repository
git clone https://github.com/archangel2006/SIH_virasya.git

# Navigate to project directory
cd SIH_virasya

# Install dependencies
npm install
```

### Step 2: Run the Next.js Web App

Start the Next.js development server:

```bash
npm run dev
```

Open your browser and navigate to:
👉 **`http://localhost:3000`** (or `http://localhost:9002`)

---

## 🤖 Genkit Developer UI (Testing AI Flows)

You can run the **Genkit Developer UI** independently to test, trace, and inspect all 9 AI flows in isolation (without needing to click through the web UI).

Start the Genkit Dev server:

```bash
npm run genkit:dev
```

Or run with automatic watch/reload:

```bash
npm run genkit:watch
```

Open your browser and navigate to:
👉 **`http://localhost:4000`**

### Registered AI Flows in Genkit UI:
- 🎨 `artisanAITypeDetectionFlow` — Vision AI craft detection & initial pricing
- 📜 `artisanAiCraftStoryGeneratorFlow` — Fact-grounded heritage narrative generation
- 🏷️ `generateArtisanListingFlow` — Full product listing generation (title, SEO tags, story)
- 🛍️ `buyerAIProductRecommendationsFlow` — Personalization recommendation engine
- 💰 `artisanAiPriceAdvisorFlow` — Market-based fair price range calculator
- 📣 `marketingGeneratorFlow` — Social media posts (Instagram, WhatsApp, hashtags)
- 🌐 `translationFlow` — Multilingual translation across 10 Indian languages
- ❓ `productQAFlow` — Interactive product Q&A assistant
- 🎙️ `multilingualAutoCatalogFlow` — Voice transcript + image auto-cataloging

---

## 🛠️ Verification & Maintenance Commands

To run TypeScript type checks:

```bash
npm run typecheck
```

To run ESLint:

```bash
npm run lint
```

---

## 🎯 Summary of Scripts (`package.json`)

| Command | Action |
| --- | --- |
| `npm run dev` | Starts Next.js development server |
| `npm run genkit:dev` | Starts Genkit Developer UI (`http://localhost:4000`) |
| `npm run genkit:watch` | Starts Genkit UI with hot reloading |
| `npm run build` | Builds production Next.js application |
| `npm run typecheck` | Validates TypeScript types across project |
| `npm run lint` | Runs ESLint checks |
