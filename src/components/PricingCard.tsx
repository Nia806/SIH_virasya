"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sparkles, TrendingUp, Info, ExternalLink, SlidersHorizontal, 
  Edit3, CheckCircle2, ChevronDown, ChevronUp, AlertCircle, 
  RefreshCw, Layers, ShieldCheck, HelpCircle
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { PricingEngineResponse, ComparableListing } from '@/lib/pricing-engine';

export interface PricingCardProps {
  craftType: string;
  materials: string;
  region?: string;
  productTitle: string;
  description?: string;
  selectedPrice: number;
  onPriceChange: (price: number) => void;
  onPriceRangeDetermined?: (range: { min: number; max: number; reasoning: string }) => void;
  onManualFallbackRequested?: () => void;
  className?: string;
}

export function PricingCard({
  craftType,
  materials,
  region,
  productTitle,
  description,
  selectedPrice,
  onPriceChange,
  onPriceRangeDetermined,
  onManualFallbackRequested,
  className = '',
}: PricingCardProps) {
  const [data, setData] = useState<PricingEngineResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [showReasoningDetails, setShowReasoningDetails] = useState(false);
  const [isManualOverride, setIsManualOverride] = useState(false);

  // Track previous query signature to avoid unnecessary repeated calls
  const prevFetchSignatureRef = useRef<string>('');

  const fetchDynamicPricing = useCallback(async (force = false) => {
    if (!craftType && !productTitle) return;

    const signature = `${craftType}|${materials}|${productTitle}|${region || ''}`;
    if (!force && signature === prevFetchSignatureRef.current && data) {
      return; // Already loaded for this signature
    }
    prevFetchSignatureRef.current = signature;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          craftType,
          materials,
          region,
          productTitle,
          description,
        }),
      });

      const json: PricingEngineResponse = await res.json();

      if (!res.ok || !json.success) {
        setErrorMsg(json.error || 'Unable to retrieve comparable market data.');
        setData(json);
      } else {
        setData(json);
        // If selectedPrice is 0 or unassigned, auto-suggest the median
        if ((selectedPrice === 0 || !selectedPrice) && json.suggestedListingPrice) {
          onPriceChange(json.suggestedListingPrice);
        }
        if (onPriceRangeDetermined && json.recommendedMin && json.recommendedMax) {
          onPriceRangeDetermined({
            min: json.recommendedMin,
            max: json.recommendedMax,
            reasoning: json.reasoning?.summary || 'Market-data derived recommendation via Google Shopping.',
          });
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error fetching dynamic pricing.');
    } finally {
      setIsLoading(false);
    }
  }, [craftType, materials, region, productTitle, description, selectedPrice, onPriceChange, onPriceRangeDetermined, data]);

  useEffect(() => {
    fetchDynamicPricing();
  }, [fetchDynamicPricing]);

  // Derive slider bounds based on market range
  const minBound = data?.recommendedMin ? Math.max(10, Math.round(data.recommendedMin * 0.6)) : 50;
  const maxBound = data?.recommendedMax ? Math.round(data.recommendedMax * 1.4) : 5000;
  const stepSize = minBound >= 1000 ? 50 : 10;

  const currentPrice = selectedPrice || (data?.suggestedListingPrice ?? 0);

  // Determine market position badge
  const getMarketPosition = () => {
    if (!data?.recommendedMin || !data?.recommendedMax || currentPrice <= 0) return null;
    if (currentPrice < data.recommendedMin) {
      return { text: 'Below Market Band', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    if (currentPrice > data.recommendedMax) {
      return { text: 'Premium Craft Pricing', color: 'text-purple-700 bg-purple-50 border-purple-200' };
    }
    return { text: 'Within Market Band', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  };

  const positionBadge = getMarketPosition();

  return (
    <Card className={`overflow-hidden border border-primary/20 bg-white shadow-sm rounded-3xl ${className}`}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 border-b border-primary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-foreground text-base flex items-center gap-2">
                Dynamic Market Pricing
                {data?.marketConfidence && (
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] uppercase font-bold py-0.5 px-2 rounded-full ${
                      data.marketConfidence === 'High' 
                        ? 'border-emerald-500/40 text-emerald-700 bg-emerald-50/50' 
                        : data.marketConfidence === 'Medium'
                        ? 'border-blue-500/40 text-blue-700 bg-blue-50/50'
                        : 'border-amber-500/40 text-amber-700 bg-amber-50/50'
                    }`}
                  >
                    {data.marketConfidence} Confidence
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-muted-foreground">
                Statistical price discovery powered by real Indian e-commerce listings.
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchDynamicPricing(true)}
            disabled={isLoading}
            className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground"
            title="Refresh market data"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-primary' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4 py-4 animate-pulse">
            <div className="h-4 bg-secondary/60 rounded w-1/3" />
            <div className="h-10 bg-secondary/40 rounded-xl w-2/3" />
            <div className="h-16 bg-secondary/20 rounded-2xl" />
          </div>
        )}

        {/* Error or Insufficient Data State */}
        {!isLoading && errorMsg && (
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-3">
            <div className="flex items-start gap-2.5 text-amber-800">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-amber-600" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  {data?.statistics && data.statistics.relevantResultCount < 5 
                    ? 'Insufficient Comparable Market Data' 
                    : 'Market Pricing Unavailable'}
                </h4>
                <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                  {errorMsg}
                </p>
                {data?.statistics && (
                  <p className="text-[11px] text-amber-800/70 mt-1">
                    Found {data.statistics.relevantResultCount} comparable items (minimum 5 required for defensible statistical range).
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {onManualFallbackRequested && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onManualFallbackRequested}
                  className="rounded-full text-xs font-semibold bg-white border-amber-300 text-amber-900 hover:bg-amber-100/50"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" /> Calculate Manually (Labor & Materials)
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsManualOverride(true)}
                className="rounded-full text-xs text-amber-900 hover:bg-amber-100/40"
              >
                Set My Own Price Directly
              </Button>
            </div>
          </div>
        )}

        {/* Successful Market Data State */}
        {!isLoading && data?.success && data.recommendedMin !== undefined && data.recommendedMax !== undefined && (
          <>
            {/* Primary Recommendation Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Range Card */}
              <div className="p-4 rounded-2xl bg-secondary/20 border border-border/60">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Recommended Market Range
                </span>
                <p className="text-2xl font-headline font-bold text-foreground mt-1 flex items-baseline">
                  <span className="text-base font-sans mr-0.5">₹</span>
                  {data.recommendedMin.toLocaleString('en-IN')}
                  <span className="text-muted-foreground mx-1.5 text-base font-normal">—</span>
                  <span className="text-base font-sans mr-0.5">₹</span>
                  {data.recommendedMax.toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-muted-foreground block mt-1">
                  25th to 75th percentile (middle 50% of market)
                </span>
              </div>

              {/* Suggested Midpoint Card */}
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                    Suggested Listing Price
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onPriceChange(data.suggestedListingPrice!)}
                    className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/20 rounded-full"
                  >
                    Apply Midpoint
                  </Button>
                </div>
                <p className="text-2xl font-headline font-bold text-primary mt-1 flex items-baseline">
                  <span className="text-base font-sans mr-0.5">₹</span>
                  {data.suggestedListingPrice?.toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-primary/70 block mt-1">
                  Market median based on {data.statistics?.finalResultCount || 0} comparable items
                </span>
              </div>
            </div>

            {/* Artisan Price Adjustment Slider */}
            <div className="p-5 rounded-2xl bg-white border border-border/70 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Your Final Listing Price
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Adjust to reflect your personal mastery, rare materials, or special detailing.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-headline font-extrabold text-primary font-sans">
                    ₹{currentPrice.toLocaleString('en-IN')}
                  </span>
                  {positionBadge && (
                    <span className={`block text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${positionBadge.color}`}>
                      {positionBadge.text}
                    </span>
                  )}
                </div>
              </div>

              {!isManualOverride ? (
                <div className="space-y-2 pt-2">
                  <Slider
                    value={[currentPrice]}
                    min={minBound}
                    max={maxBound}
                    step={stepSize}
                    onValueChange={(val) => onPriceChange(val[0])}
                    className="py-1 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>₹{minBound.toLocaleString('en-IN')}</span>
                    <span className="text-primary font-semibold">Suggested: ₹{data.suggestedListingPrice?.toLocaleString('en-IN')}</span>
                    <span>₹{maxBound.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <Input
                      type="number"
                      value={selectedPrice || ''}
                      onChange={(e) => onPriceChange(Number(e.target.value) || 0)}
                      placeholder="Enter custom selling price..."
                      className="pl-7 h-10 rounded-xl font-bold font-sans text-foreground"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsManualOverride(false)}
                    className="h-10 text-xs rounded-xl"
                  >
                    Back to Slider
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                <button
                  type="button"
                  onClick={() => setIsManualOverride(!isManualOverride)}
                  className="text-primary hover:underline font-semibold flex items-center gap-1"
                >
                  <Edit3 className="h-3 w-3" />
                  {isManualOverride ? "Use slider adjustment" : "Set my own price manually"}
                </button>

                {onManualFallbackRequested && (
                  <button
                    type="button"
                    onClick={onManualFallbackRequested}
                    className="text-muted-foreground hover:text-foreground underline"
                  >
                    Calculate with manual cost formula
                  </button>
                )}
              </div>
            </div>

            {/* Interpretable Reasoning Accordion */}
            {data.reasoning && (
              <div className="p-4 rounded-2xl bg-secondary/15 border border-border/60 space-y-2">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setShowReasoningDetails(!showReasoningDetails)}
                >
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">Why this pricing recommendation?</span>
                  </div>
                  <button type="button" className="text-muted-foreground">
                    {showReasoningDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {data.reasoning.summary}
                </p>

                {showReasoningDetails && (
                  <div className="pt-3 border-t border-border/40 space-y-4">
                    {/* Feature Importance Section */}
                    {data.reasoning.featureImportance && data.reasoning.featureImportance.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary" /> Feature Importance & Pricing Drivers
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">Relative Contribution</span>
                        </div>

                        <div className="space-y-2">
                          {data.reasoning.featureImportance.map((fi, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-white border border-border/50 space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-foreground">{fi.feature}</span>
                                  <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-primary/20 text-primary">
                                    {fi.direction}
                                  </Badge>
                                </div>
                                <span className="font-mono font-bold text-primary">{fi.weightPercentage}%</span>
                              </div>
                              
                              {/* Progress bar representing feature importance */}
                              <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500" 
                                  style={{ width: `${fi.weightPercentage}%` }}
                                />
                              </div>

                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {fi.insight}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Statistical Factors Matrix */}
                    <div className="pt-2 border-t border-border/30">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-2">
                        Market Evidence Metrics
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {data.reasoning.factors.map((factor, idx) => (
                          <div key={idx} className="p-2 rounded-xl bg-white/80 border border-border/40 text-xs">
                            <span className="text-muted-foreground text-[10px] block uppercase font-semibold">
                              {factor.factor}
                            </span>
                            <span className="font-bold text-foreground text-xs">
                              {factor.value}
                            </span>
                            {factor.contribution && (
                              <span className="text-[10px] text-primary block mt-0.5">
                                {factor.contribution}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="text-[10px] text-muted-foreground pt-1 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>
                        Robust statistical model: 1.5×IQR outlier exclusion ({data.statistics?.outlierCount || 0} excluded) across {data.statistics?.pricedResultCount || 0} live market observations.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sources / Comparable Listings Accordion */}
            {data.sources && data.sources.length > 0 && (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSources(!showSources)}
                  className="w-full justify-between h-9 text-xs text-muted-foreground hover:text-foreground rounded-xl bg-secondary/10 px-3"
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    Inspect {data.sources.length} Verified Comparable Listings
                  </span>
                  {showSources ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>

                {showSources && (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {data.sources.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="p-2.5 rounded-xl bg-white border border-border/60 flex items-center justify-between text-xs gap-3"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          {item.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img 
                              src={item.thumbnail} 
                              alt="" 
                              className="w-9 h-9 rounded-lg object-cover bg-secondary/30 shrink-0" 
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-secondary/40 shrink-0 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                              ₹
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <p className="font-medium text-foreground truncate max-w-xs" title={item.title}>
                              {item.title}
                            </p>
                            <span className="text-[10px] text-muted-foreground">
                              {item.source} • Score: {item.relevanceScore}/11
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-primary font-sans">
                            ₹{item.extractedPrice.toLocaleString('en-IN')}
                          </span>
                          {item.link && (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary p-1"
                              title="View listing"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
