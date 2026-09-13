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

const multilingualAutoCatalogFlow = ai.defineFlow(
  {
    name: 'multilingualAutoCatalogFlow',
    inputSchema: MultilingualAutoCatalogInputSchema,
    outputSchema: MultilingualAutoCatalogOutputSchema,
  },
  async input => {
    const { output } = await catalogPrompt(input);
    return output!;
  }
);
