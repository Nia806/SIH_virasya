'use server';
/**
 * @fileOverview An AI agent for detecting craft details and generating initial listing data.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ArtisanAITypeDetectionInputSchema = z.object({
  productImageDataUri: z.string(),
  location: z.string().optional(),
});

const ArtisanAITypeDetectionOutputSchema = z.object({
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
  suggestedTitle: z.string(),
  suggestedMaterials: z.string(),
  craftStyle: z.string(),
  description: z.string(),
  craftStory: z.string(),
  pricing: z.object({
    suggestedMidpoint: z.number(),
    reasoning: z.string(),
  }),
});

export async function artisanAITypeDetection(input: z.infer<typeof ArtisanAITypeDetectionInputSchema>) {
  return artisanAITypeDetectionFlow(input);
}

const detectionPrompt = ai.definePrompt({
  name: 'artisanAITypeDetectionPrompt',
  input: {schema: ArtisanAITypeDetectionInputSchema},
  output: {schema: ArtisanAITypeDetectionOutputSchema},
  prompt: `Analyze the provided image of a handcrafted product.
Location: {{{location}}}

Identify and generate:
1. Detect Craft Category: One of Pottery, Textiles, Jewelry, Woodwork, Hand painting, Paper Mache, Metalwork, Leatherwork, Bamboo & Cane, or Other.
2. Identify Materials: List visible materials used.
3. Suggest Product Title: An SEO-friendly, catchy title.
4. Analyze Craft Style: Specify the regional or artistic style.
5. Generate Short Description: 2-3 professional sentences.
6. Generate Craft Story: 3-4 sentences max. Provide general cultural context based ONLY on craft type and visible techniques. DO NOT FABRICATE personal history.
7. Suggest Price Range: Provide a realistic midpoint in INR. Provide a 2-sentence max reasoning explaining labor and material influence.

Product Image: {{media url=productImageDataUri}}`,
});

const artisanAITypeDetectionFlow = ai.defineFlow(
  {
    name: 'artisanAITypeDetectionFlow',
    inputSchema: ArtisanAITypeDetectionInputSchema,
    outputSchema: ArtisanAITypeDetectionOutputSchema,
  },
  async input => {
    try {
      const {output} = await detectionPrompt(input);
      if (output) return output;
    } catch (err: any) {
      console.warn('Genkit detectionPrompt failed, using fallback:', err?.message || err);
    }
    return {
      craftType: 'Textiles' as const,
      suggestedTitle: 'Handmade Artisan Heritage Craft',
      suggestedMaterials: 'Traditional Handcrafted Materials',
      craftStyle: 'Traditional Indian Craft',
      description: 'An authentic handcrafted piece created with traditional artisanal techniques.',
      craftStory: 'Generations of craft traditions have shaped this piece, honoring regional cultural heritage.',
      pricing: {
        suggestedMidpoint: 1800,
        reasoning: 'Fair compensation reflecting artisan time, materials, and skilled handicraft.'
      }
    };
  }
);
