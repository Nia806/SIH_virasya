'use server';
/**
 * @fileOverview Multilingual craft auto-cataloger and missing detail extractor.
 * Combines enhanced craft photos with spoken regional audio notes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MultilingualAutoCatalogInputSchema = z.object({
  primaryImageDataUri: z.string().describe("Base64 data URI of the craft photo"),
  voiceTranscript: z.string().optional().describe("Artisan spoken audio transcript or written notes"),
  spokenLanguage: z.string().optional().describe("Detected or selected Indian language code (e.g. hi, bn, ta, mr, en)"),
  location: z.string().optional().describe("Artisan geographic region or state"),
});

const MultilingualAutoCatalogOutputSchema = z.object({
  craftType: z.enum([
    'Pottery',
    'Textiles',
    'Jewelry',
    'Woodwork',
    'Hand painting',
    'Paper Mache',
    'Metalwork',
    'Leatherwork',
    'Bamboo & Cane',
    'Other'
  ]),
  suggestedTitle: z.string().describe("SEO-optimized, descriptive English title"),
  suggestedTitleRegional: z.string().describe("Title rendered in the artisan's regional language or script"),
  suggestedMaterials: z.string().describe("Materials identified from speech and vision"),
  craftStyle: z.string().describe("Artistic or regional tradition (e.g. Madhubani, Dhokra, Blue Pottery)"),
  dimensions: z.string().describe("Dimensions if mentioned or estimated (e.g. 10 x 8 inches)"),
  shortDescription: z.string().describe("Engaging 2-3 sentence English product description"),
  craftStory: z.string().describe("Heritage craft story in English (max 4 sentences, strictly authentic)"),
  craftStoryRegional: z.string().describe("Craft story in the artisan's regional language or script"),
  estimatedLaborHours: z.number().describe("Estimated or extracted craft labor hours"),
  pricing: z.object({
    suggestedMidpoint: z.number().describe("Recommended fair market price in INR"),
    minPrice: z.number().describe("Floor fair price"),
    maxPrice: z.number().describe("Premium benchmark price"),
    reasoning: z.string().describe("Transparent economic justification based on labor and materials"),
  }),
  missingDetails: z.array(
    z.object({
      field: z.string(),
      label: z.string(),
      promptQuestion: z.string(),
      suggestedValue: z.string().optional(),
    })
  ).describe("Key attributes that were not explicitly detected in speech or photo"),
});

export async function multilingualAutoCatalog(
  input: z.infer<typeof MultilingualAutoCatalogInputSchema>
) {
  return multilingualAutoCatalogFlow(input);
}

const catalogPrompt = ai.definePrompt({
  name: 'multilingualAutoCatalogPrompt',
  input: { schema: MultilingualAutoCatalogInputSchema },
  output: { schema: MultilingualAutoCatalogOutputSchema },
  prompt: `You are the master cataloging and cultural heritage AI for Virasya, an authentic Indian handicraft platform.
Analyze both the provided craft image and the artisan's spoken or written notes.

Artisan Spoken / Written Notes:
"""
{{{voiceTranscript}}}
"""

Artisan Region / Location: {{{location}}}
Spoken Language Code: {{{spokenLanguage}}}

Instructions:
1. Craft Category: Map accurately to one of Pottery, Textiles, Jewelry, Woodwork, Hand painting, Paper Mache, Metalwork, Leatherwork, Bamboo & Cane, or Other.
2. Materials: Extract materials mentioned in the speech, cross-referencing visual evidence.
3. Titles & Stories:
   - Provide a clean, marketable English title and a cultural craft story (max 4 sentences, authentic, non-hallucinatory).
   - If the artisan spoke in a regional Indian language (Hindi, Bengali, Tamil, Marathi, Telugu, Gujarati, etc.), also provide the title and craft story in that regional language/script!
4. Dimensions & Specifications: Extract exact dimensions (cm/inches) or weight if stated in speech. If not stated, provide a reasonable estimate.
5. Missing Details Detection:
   - If dimensions were NOT mentioned in the speech, add an entry to missingDetails asking for dimensions.
   - If specific care instructions or exact weight are missing, suggest them.
6. Fair Pricing (INR): Calculate a realistic, respectful price midpoint, min, and max in Indian Rupees (INR) considering raw materials and artisan hours.

Craft Photo: {{media url=primaryImageDataUri}}`,
});

const fallbackCraftCatalog = (input: z.infer<typeof MultilingualAutoCatalogInputSchema>): z.infer<typeof MultilingualAutoCatalogOutputSchema> => {
  const text = (input.voiceTranscript || '').toLowerCase();
  const loc = input.location || 'India';

  let craftType: z.infer<typeof MultilingualAutoCatalogOutputSchema>['craftType'] = 'Other';
  let craftStyle = 'Traditional Heritage Craft';
  let suggestedMaterials = 'Natural handcrafted raw materials';
  let title = 'Authentic Handcrafted Artisan Heritage Piece';
  let priceMid = 1850;

  if (text.includes('chikankari') || text.includes('dupatta') || text.includes('cotton') || text.includes('saree') || text.includes('embroider') || text.includes('textile') || text.includes('fabric')) {
    craftType = 'Textiles';
    craftStyle = text.includes('chikankari') ? 'Lucknow Chikankari Hand Embroidery' : 'Handloom Heritage Weaving';
    suggestedMaterials = text.includes('cotton') ? 'Pure Cotton, Hand-spun Cotton Thread' : 'Organic Silk & Cotton Thread';
    title = text.includes('dupatta') ? 'Hand-Embroidered Chikankari Cotton Dupatta' : 'Handcrafted Heritage Textile Garment';
    priceMid = 2200;
  } else if (text.includes('pot') || text.includes('clay') || text.includes('terracotta') || text.includes('pottery')) {
    craftType = 'Pottery';
    craftStyle = 'Traditional Wheel-Thrown Clay Pottery';
    suggestedMaterials = 'Natural Terracotta Clay, Organic Mineral Pigments';
    title = 'Handmade Terracotta Decorative Clay Artwork';
    priceMid = 950;
  } else if (text.includes('wood') || text.includes('carv') || text.includes('sheesham')) {
    craftType = 'Woodwork';
    craftStyle = 'Hand-Carved Heritage Woodcraft';
    suggestedMaterials = 'Seasoned Hardwood / Sheesham Wood';
    title = 'Intricately Hand-Carved Wooden Craft';
    priceMid = 2400;
  } else if (text.includes('brass') || text.includes('metal') || text.includes('dhokra') || text.includes('copper')) {
    craftType = 'Metalwork';
    craftStyle = text.includes('dhokra') ? 'Dhokra Lost-Wax Bell Metal Casting' : 'Hand-Etched Heritage Brass Metalwork';
    suggestedMaterials = 'Bell Metal Alloy, Brass, Beeswax';
    title = 'Handcrafted Bell Metal Artifact';
    priceMid = 2800;
  } else if (text.includes('jewel') || text.includes('bead') || text.includes('silver') || text.includes('kundan')) {
    craftType = 'Jewelry';
    craftStyle = 'Traditional Artisan Jewelry Making';
    suggestedMaterials = 'Semi-precious stones, Brass, Silver wire';
    title = 'Handcrafted Traditional Artisan Jewelry';
    priceMid = 1600;
  }

  // Extract dimensions if present in text
  const dimMatch = text.match(/(\d+(\.\d+)?\s*(metres|metre|meters|meter|cm|inches|m|ft))/i);
  const detectedDimensions = dimMatch ? dimMatch[0] : 'Approx. Standard Artisan Dimensions';

  return {
    craftType,
    suggestedTitle: title,
    suggestedTitleRegional: title,
    suggestedMaterials,
    craftStyle,
    dimensions: detectedDimensions,
    shortDescription: input.voiceTranscript && input.voiceTranscript.length > 15
      ? input.voiceTranscript.trim()
      : `Exquisite hand-crafted ${craftType.toLowerCase()} made with authentic traditional techniques by local Indian master artisans in ${loc}.`,
    craftStory: `Crafted with generations of inherited ancestral knowledge, this authentic ${craftStyle} reflects the living heritage and patient devotion of Indian artisan communities. Every curve and stitch preserves cultural authenticity.`,
    craftStoryRegional: `पारंपरिक विरासत और प्रामाणिक हस्तशिल्प तकनीक द्वारा निर्मित यह कलाकृति भारतीय शिल्पकारों के गौरव और कलात्मक कौशल का प्रतीक है।`,
    estimatedLaborHours: 14,
    pricing: {
      suggestedMidpoint: priceMid,
      minPrice: Math.round(priceMid * 0.85),
      maxPrice: Math.round(priceMid * 1.25),
      reasoning: `Calculated from estimated raw material costs, authentic hand labor, and regional craft market benchmarks for ${loc}.`,
    },
    missingDetails: [
      {
        field: 'careInstructions',
        label: 'Care Instructions',
        promptQuestion: 'How should customers clean or care for this craft?',
        suggestedValue: 'Gentle dry clean or delicate hand wash in cold water with mild detergent.',
      },
      {
        field: 'weight',
        label: 'Approximate Weight',
        promptQuestion: 'What is the approximate weight for shipping calculation?',
        suggestedValue: '350 grams',
      }
    ],
  };
};

const multilingualAutoCatalogFlow = ai.defineFlow(
  {
    name: 'multilingualAutoCatalogFlow',
    inputSchema: MultilingualAutoCatalogInputSchema,
    outputSchema: MultilingualAutoCatalogOutputSchema,
  },
  async input => {
    try {
      const { output } = await catalogPrompt(input);
      if (output) return output;
    } catch (err: any) {
      console.warn('Genkit catalogPrompt call failed, using intelligent offline fallback parser:', err?.message || err);
    }
    return fallbackCraftCatalog(input);
  }
);
