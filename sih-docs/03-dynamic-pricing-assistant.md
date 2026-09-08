# Feature 3: Dynamic Pricing Assistant

## What This Actually Is

A machine learning scoring model that takes the product image and description and outputs a competitive price recommendation. NOT a Gemini prompt asking "what should I charge?". Gemini is not involved in this feature.

The model uses a combination of visual feature extraction (from the product image) and structured craft data to produce a price range based on real market signals.

---

## Where It Lives in the Existing System

The existing `artisan-ai-price-advisor.ts` asks the artisan to manually fill a form (craft category, materials, hours, complexity). This feature replaces that manual step with automatic price prediction from the image and description already available at that point in the wizard.

Old:
```
Artisan fills manual pricing form --> artisan-ai-price-advisor (Gemini, prompt-based)
```

New:
```
Product image + description (already in wizard state)
  --> [ML Pricing Model / Market Data API]
  --> price range + reasoning
```

`artisan-ai-price-advisor.ts` is kept as a "manual override" option but is no longer the primary path. The new pricing engine runs automatically.

---

## Technical Approach

### Option A: API-Based Market Pricing (Recommended for Prototype)

Use real market data rather than a trained model for the hackathon prototype. The advantage is no training data needed and results reflect actual market conditions.

**Data source: Google Shopping / SerpAPI**

SerpAPI provides a Google Shopping search API. Query it with the product's craft type and region to get real current prices for similar items.

```
GET https://serpapi.com/search
  ?engine=google_shopping
  &q=handmade+Kutch+embroidery+shawl
  &gl=in
  &hl=en
  &api_key=YOUR_KEY
```

Returns a list of real products with actual prices from Indian and global e-commerce platforms. Parse this list, filter by relevance (craft type match), compute the median and interquartile range, and return that as the recommended price band.

Cost: SerpAPI has a free tier of 100 searches/month. Sufficient for prototype and demo.

**Implementation: a Next.js API route, not a Genkit flow**

```
src/app/api/pricing/route.ts
```

Input (from wizard state, already available):
```ts
{
  craftType: string,       // from artisan-ai-type-detection output
  materials: string,       // from type-detection output
  region: string,          // from artisan's profile or type-detection
  productTitle: string,    // from listing generator output
  description: string      // from listing generator output
}
```

Pipeline inside the API route:
1. Build a search query from craftType + region + key materials
2. Call SerpAPI Google Shopping endpoint
3. Parse returned price list: filter relevant results, remove outliers
4. Compute: median price, 25th percentile (min), 75th percentile (max)
5. Return: `{ recommendedMin, recommendedMax, suggestedListingPrice, sources[] }`

### Option B: Lightweight ML Regression Model (More Impressive for Demo)

Train a simple regression model on a small dataset of Indian handicraft prices. Can be done with Python scikit-learn and then served via a lightweight API.

**Dataset**: Publicly available datasets on Kaggle for Indian handicrafts pricing, supplemented with manual price lookups from platforms like Craftsvilla, GloCraft, and Amazon Handmade India.

**Model**: Random Forest Regressor. Features:
- Craft type (one-hot encoded): Pottery, Textiles, Jewelry, Woodwork, etc.
- Materials (encoded): cotton, silk, terracotta, silver, etc.
- Region (encoded): Rajasthan, Gujarat, West Bengal, etc.
- Complexity (derived from description word count and image processing output)
- Size category (small, medium, large — from image aspect ratio)

**Serving**: Export the trained model as a `.pkl` file. Serve it via a simple Python FastAPI endpoint deployed on Render (free tier) or as a Vercel serverless Python function.

```python
@app.post("/predict-price")
def predict_price(data: PricingInput):
    features = encode_features(data)
    prediction = model.predict([features])[0]
    return {
        "suggestedPrice": round(prediction, -1),
        "range": [round(prediction * 0.8, -1), round(prediction * 1.2, -1)]
    }
```

The Next.js app calls this endpoint from `src/app/api/pricing/route.ts` and passes the result to the UI.

**For the hackathon: start with Option A (SerpAPI) to ship fast. Use Option B as the "how we would productionize this" talking point during the presentation.**

### Visual Feature Extraction (Enhancement for Option B)

If using the ML model, optionally extract visual features from the product image to improve pricing accuracy:

Use **Google Cloud Vision API** (not Gemini) to extract:
- `labelAnnotations`: detects object types (embroidered fabric, ceramic bowl, etc.)
- `imagePropertiesAnnotation`: dominant colors (can indicate dye quality and material grade)
- `localizedObjectAnnotations`: detects specific objects and their positions

These Vision API outputs are additional features fed into the regression model or used to refine the SerpAPI search query.

---

## New Files to Create

```
src/app/api/pricing/route.ts      -- Next.js API route calling SerpAPI or ML model endpoint
src/components/PricingCard.tsx    -- UI component: price range display, slider, reasoning
```

Optionally (for Option B):
```
ml/pricing_model.py               -- training script (Python, kept in repo for reference)
ml/model.pkl                      -- exported trained model
```

No Genkit flow. No Gemini call. Separate pricing API route.

---

## UI

The existing upload wizard already has a pricing step. This feature replaces the manual form with:

1. Auto-trigger pricing call when the wizard reaches the pricing step (using craft type and description already in state).
2. Show a loading card while the API call runs.
3. Display the result as a pricing card:
   - Recommended range (min to max with a highlighted midpoint)
   - Source: "Based on X similar products currently listed online" (from SerpAPI results)
   - A price slider for artisan adjustment within the range
   - "Set my own price" link for full manual override
4. The artisan's final chosen price is what gets written to Firestore.

---

## API Keys Needed

For Option A:
```
SERPAPI_KEY=your_key
```

For Option B with Vision API:
```
GOOGLE_VISION_API_KEY=your_key
```

---

## Integration Checklist

- [ ] Sign up for SerpAPI free tier
- [ ] Build `src/app/api/pricing/route.ts` with SerpAPI integration
- [ ] Parse and clean the SerpAPI price list (filter irrelevant results)
- [ ] Build `PricingCard.tsx` with range display and slider
- [ ] Auto-trigger pricing call at the pricing step of the upload wizard
- [ ] Keep `artisan-ai-price-advisor.ts` as a linked manual fallback
- [ ] Test across craft types: pottery, embroidery, jewelry, woodwork
- [ ] Verify price ranges look realistic before demo

---

## What Is NOT Touched

- `artisan-ai-price-advisor.ts`: kept as manual fallback, not modified
- All other Genkit flows: completely untouched
- Gemini: not involved in this feature
- Firestore schema: the `price` field already exists on product documents
- Buyer pages: unaffected
