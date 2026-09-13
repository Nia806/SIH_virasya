import { NextRequest, NextResponse } from 'next/server';
import { 
  PricingInput, 
  buildSearchQueries, 
  processMarketListings,
  RawShoppingItem 
} from '@/lib/pricing-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const { craftType, materials, region, productTitle, description } = body || {};

    if (!craftType && !productTitle) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameters: At least craftType or productTitle must be provided.' 
        },
        { status: 400 }
      );
    }

    const input: PricingInput = {
      craftType: String(craftType || '').trim(),
      materials: String(materials || '').trim(),
      region: String(region || '').trim(),
      productTitle: String(productTitle || '').trim(),
      description: String(description || '').trim(),
    };

    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'SerpAPI key is not configured on the server. Please set SERPAPI_KEY in your environment variables.',
          fallbackAvailable: true,
        },
        { status: 503 }
      );
    }

    const queries = buildSearchQueries(input);
    let chosenQuery = queries[0] || input.productTitle || input.craftType;
    let rawResults: RawShoppingItem[] = [];
    let lastApiError: string | null = null;

    // Progressive query execution: try primary query, then fallbacks if insufficient data
    for (const query of queries) {
      chosenQuery = query;
      const serpApiUrl = new URL('https://serpapi.com/search.json');
      serpApiUrl.searchParams.set('engine', 'google_shopping');
      serpApiUrl.searchParams.set('q', query);
      serpApiUrl.searchParams.set('gl', 'in');
      serpApiUrl.searchParams.set('hl', 'en');
      serpApiUrl.searchParams.set('api_key', apiKey);

      try {
        const response = await fetch(serpApiUrl.toString(), {
          method: 'GET',
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(35000),
          next: { revalidate: 300 } // Cache results for 5 minutes
        });

        if (!response.ok) {
          const errText = await response.text();
          lastApiError = `SerpAPI returned HTTP ${response.status}: ${errText.slice(0, 150)}`;
          continue;
        }

        const data = await response.json();
        if (data.error) {
          lastApiError = `SerpAPI error: ${data.error}`;
          continue;
        }

        const shoppingResults = Array.isArray(data.shopping_results) ? data.shopping_results : [];
        if (shoppingResults.length >= 5) {
          rawResults = shoppingResults;
          break; // Found sufficient raw listings
        } else if (shoppingResults.length > 0 && rawResults.length === 0) {
          rawResults = shoppingResults;
        }
      } catch (err: any) {
        lastApiError = err?.message || 'Network failure while connecting to SerpAPI';
      }
    }

    // If all queries failed with an API error and no results obtained
    if (rawResults.length === 0 && lastApiError) {
      return NextResponse.json(
        {
          success: false,
          error: lastApiError,
          query: chosenQuery,
          fallbackAvailable: true,
        },
        { status: 502 }
      );
    }

    // Process through relevance scoring and IQR filtering pipeline
    const result = processMarketListings(rawResults, input, chosenQuery);

    if (!result.success) {
      return NextResponse.json(result, { status: 200 }); // Return 200 with success: false for clean client handling
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error in dynamic pricing engine.',
        fallbackAvailable: true,
      },
      { status: 500 }
    );
  }
}
