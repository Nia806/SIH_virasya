
'use server';
/**
 * @fileOverview A Genkit flow for generating social media promotional content.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MarketingInputSchema = z.object({
  productName: z.string(),
  craftType: z.string(),
  region: z.string(),
  description: z.string(),
});

const MarketingOutputSchema = z.object({
  instagram: z.string().describe('Max 60 words.'),
  whatsapp: z.string().describe('Around 100 words.'),
  hashtags: z.array(z.string()).describe('8-10 tags.'),
  promoLine: z.string().describe('A catchy short line.'),
});

export async function generateMarketingContent(input: z.infer<typeof MarketingInputSchema>) {
  return marketingGeneratorFlow(input);
}

const marketingPrompt = ai.definePrompt({
  name: 'marketingPrompt',
  input: {schema: MarketingInputSchema},
  output: {schema: MarketingOutputSchema},
  prompt: `Generate promotional social media content for this artisan product. 

Product: {{{productName}}}
Craft: {{{craftType}}}
Region: {{{region}}}
Description: {{{description}}}

Requirements:
- Instagram caption: Max 60 words.
- WhatsApp message: Around 100 words, written as a warm and complete product introduction that encourages people to view or buy the product.
- Hashtags: 8-10 relevant tags.
- Promo Line: A short, punchy one-liner.

Tone: Warm, authentic, premium.`,
});

const marketingGeneratorFlow = ai.defineFlow(
  {
    name: 'marketingGeneratorFlow',
    inputSchema: MarketingInputSchema,
    outputSchema: MarketingOutputSchema,
  },
  async input => {
    const {output} = await marketingPrompt(input);
    return output!;
  }
);
