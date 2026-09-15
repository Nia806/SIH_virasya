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
      <div className="bg-gradient-to-r from-amber-500/8 via-primary/5 to-transparent px-5 py-3.5 border-b border-border/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-headline font-bold text-foreground text-sm tracking-tight">
                  Dynamic Market Pricing
                </h3>
                {data?.marketConfidence && (
                  <span 
                    className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      data.marketConfidence === 'High' 
                        ? 'border-emerald-200 text-emerald-700 bg-emerald-50' 
                        : data.marketConfidence === 'Medium'
                        ? 'border-blue-200 text-blue-700 bg-blue-50'
                        : 'border-amber-200 text-amber-700 bg-amber-50'
                    }`}
                  >
                    {data.marketConfidence} Confidence
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Real-time price discovery from authentic Indian handicraft listings
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchDynamicPricing(true)}
            disabled={isLoading}
            className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground shrink-0"
            title="Refresh market data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-primary' : ''}`} />
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
            {/* Clean 2-Column KPI Summary */}
            <div className="grid grid-cols-2 gap-3">
              {/* Range Card */}
              <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/50">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Market Range
                </span>
                <p className="text-lg sm:text-xl font-headline font-bold text-foreground mt-1">
                  ₹{data.recommendedMin.toLocaleString('en-IN')} – ₹{data.recommendedMax.toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Middle 50% benchmark
                </span>
              </div>

              {/* Suggested Midpoint Card */}
              <div className="p-3.5 rounded-2xl bg-primary/8 border border-primary/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                      Suggested Mid
                    </span>
                    <button
                      type="button"
                      onClick={() => onPriceChange(data.suggestedListingPrice!)}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      Use
                    </button>
                  </div>
                  <p className="text-lg sm:text-xl font-headline font-bold text-primary mt-1">
                    ₹{data.suggestedListingPrice?.toLocaleString('en-IN')}
                  </p>
                </div>
                <span className="text-[10px] text-primary/70 block mt-0.5">
                  Median benchmark
                </span>
              </div>
            </div>

            {/* Artisan Price Adjustment Slider */}
            <div className="p-4 rounded-2xl bg-white border border-border/60 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Final Selling Price
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Reflect your personal labor, mastery, and materials
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xl font-headline font-extrabold text-primary font-sans">
                    ₹{currentPrice.toLocaleString('en-IN')}
                  </span>
                  {positionBadge && (
                    <span className={`block text-[9px] font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${positionBadge.color}`}>
                      {positionBadge.text}
                    </span>
                  )}
                </div>
              </div>

              {!isManualOverride ? (
                <div className="space-y-1.5 pt-1">
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
                    <span className="text-primary font-medium">Fair: ₹{data.suggestedListingPrice?.toLocaleString('en-IN')}</span>
                    <span>₹{maxBound.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                    <Input
                      type="number"
                      value={selectedPrice || ''}
                      onChange={(e) => onPriceChange(Number(e.target.value) || 0)}
                      placeholder="Enter custom selling price..."
                      className="pl-7 h-9 rounded-xl font-bold font-sans text-foreground text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsManualOverride(false)}
                    className="h-9 text-xs rounded-xl px-3"
                  >
                    Slider
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border/30 text-[10px]">
                <button
                  type="button"
                  onClick={() => setIsManualOverride(!isManualOverride)}
                  className="text-primary hover:underline font-semibold flex items-center gap-1"
                >
                  <Edit3 className="h-3 w-3" />
                  {isManualOverride ? "Use interactive slider" : "Type price directly"}
                </button>

                {onManualFallbackRequested && (
                  <button
                    type="button"
                    onClick={onManualFallbackRequested}
                    className="text-muted-foreground hover:text-foreground underline"
                  >
                    Cost-based formula
                  </button>
                )}
              </div>
            </div>

            {/* Reasoning Accordion */}
            {data.reasoning && (
              <div className="rounded-2xl bg-secondary/10 border border-border/50 overflow-hidden">
                <button
                  type="button" 
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-secondary/20 transition-colors"
                  onClick={() => setShowReasoningDetails(!showReasoningDetails)}
                >
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-primary" /> Why this price recommendation?
                  </span>
                  {showReasoningDetails ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>

                <div className="px-3.5 pb-3 pt-1 border-t border-border/30">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {data.reasoning.summary}
                  </p>

                  {showReasoningDetails && (
                    <div className="mt-3 pt-2.5 border-t border-border/30 space-y-2.5 animate-in fade-in-50 duration-150">
                      {/* Key Value Drivers */}
                      {data.reasoning.featureImportance && data.reasoning.featureImportance.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">
                            Key Value Drivers
                          </span>
                          <div className="space-y-1.5">
                            {data.reasoning.featureImportance.map((fi, idx) => (
                              <div key={idx} className="p-2 rounded-xl bg-white/80 border border-border/40 text-[10px] space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold text-foreground">{fi.feature}</span>
                                  <span className="font-mono text-primary font-bold">{fi.weightPercentage}%</span>
                                </div>
                                <div className="w-full bg-secondary/30 h-1 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-primary h-full rounded-full" 
                                    style={{ width: `${fi.weightPercentage}%` }} 
                                  />
                                </div>
                                <span className="text-[9px] text-muted-foreground block">{fi.insight}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-[9px] text-muted-foreground pt-1 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>Statistical corridor with IQR outlier filtering across verified benchmarks.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sources / Comparable Listings Accordion */}
            {data.sources && data.sources.length > 0 && (
              <div className="rounded-2xl bg-secondary/10 border border-border/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSources(!showSources)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-secondary/20 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    Comparable Listings ({data.sources.length})
                  </span>
                  {showSources ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>

                {showSources && (
                  <div className="p-2 space-y-1.5 max-h-56 overflow-y-auto border-t border-border/30">
                    {data.sources.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="p-2 rounded-xl bg-white border border-border/50 flex items-center justify-between text-xs gap-2 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                          {item.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img 
                              src={item.thumbnail} 
                              alt="" 
                              className="w-8 h-8 rounded-lg object-cover bg-secondary/20 shrink-0"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-primary/10 shrink-0 flex items-center justify-center text-[10px] font-bold text-primary">
                              ₹
                            </div>
                          )}
                          <div className="overflow-hidden min-w-0">
                            <p className="font-medium text-foreground truncate text-[11px]" title={item.title}>
                              {item.title}
                            </p>
                            <span className="text-[9px] text-muted-foreground block truncate">
                              {item.source}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 pl-1">
                          <span className="font-bold text-primary font-sans text-xs">
                            ₹{item.extractedPrice.toLocaleString('en-IN')}
                          </span>
                          {item.link && (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary p-0.5"
                              title="View listing"
                            >
                              <ExternalLink className="h-3 w-3" />
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
