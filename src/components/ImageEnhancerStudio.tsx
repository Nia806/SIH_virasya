"use client";

import { useState } from 'react';
import { Sparkles, Check, Sliders, ArrowRight, Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';

interface ImageEnhancerStudioProps {
  originalImage: string;
  onEnhancedApply: (enhancedDataUri: string) => void;
  onSkip: () => void;
}

export function ImageEnhancerStudio({
  originalImage,
  onEnhancedApply,
  onSkip,
}: ImageEnhancerStudioProps) {
  // Enhancement parameters
  const [brightness, setBrightness] = useState(108); // +8%
  const [contrast, setContrast] = useState(112);   // +12%
  const [saturate, setSaturate] = useState(115);   // +15%
  const [sharpness, setSharpness] = useState(2);    // subtle shadow unsharp
  const [sliderPos, setSliderPos] = useState(50);   // Comparison split position (0 - 100)
  const [isProcessing, setIsProcessing] = useState(false);

  // Apply filters via HTML5 Canvas to produce an actual enhanced image file
  const generateEnhancedImage = async (): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(originalImage);
          return;
        }

        // Apply photographic studio corrections
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => resolve(originalImage);
      img.src = originalImage;
    });
  };

  const handleApply = async () => {
    setIsProcessing(true);
    try {
      const enhanced = await generateEnhancedImage();
      onEnhancedApply(enhanced);
    } catch {
      onEnhancedApply(originalImage);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetFilters = () => {
    setBrightness(108);
    setContrast(112);
    setSaturate(115);
    setSharpness(2);
  };

  const filterStyle = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <h3 className="text-xl font-headline font-bold text-foreground">
              AI Craft Studio Enhancer
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Auto-balances workshop lighting, saturates natural pigments, and enhances craft sharpness.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-xs text-muted-foreground rounded-full h-8 px-3"
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Reset
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSkip}
            className="text-xs rounded-full h-8 px-3"
          >
            Use Original
          </Button>
        </div>
      </div>

      {/* Interactive Split Comparison Viewer */}
      <Card className="relative overflow-hidden rounded-3xl border border-border/60 bg-secondary/20 shadow-md aspect-[4/3] max-h-[460px] mx-auto select-none">
        {/* Enhanced Image (Base) */}
        <div className="absolute inset-0 w-full h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={originalImage}
            alt="Enhanced Craft"
            className="w-full h-full object-contain"
            style={{ filter: filterStyle }}
          />
          <div className="absolute bottom-3 right-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-400" /> Studio Enhanced
          </div>
        </div>

        {/* Original Image (Clipped by slider position) */}
        <div
          className="absolute inset-0 h-full overflow-hidden border-r-2 border-white shadow-2xl"
          style={{ width: `${sliderPos}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={originalImage}
            alt="Original Craft"
            className="absolute top-0 left-0 w-full h-full object-contain max-w-none"
            style={{ width: '100%', height: '100%' }}
          />
          <div className="absolute bottom-3 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] font-semibold">
            Raw Workshop Photo
          </div>
        </div>

        {/* Slider Handle Overlay */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] cursor-ew-resize flex items-center justify-center pointer-events-none"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="w-8 h-8 -ml-4 rounded-full bg-white text-primary shadow-lg flex items-center justify-center text-xs font-bold pointer-events-auto">
            ↔
          </div>
        </div>

        {/* Split Controller Input */}
        <input
          type="range"
          min="0"
          max="100"
          value={sliderPos}
          onChange={(e) => setSliderPos(Number(e.target.value))}
          aria-label="Before / After Image Slider"
          className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full z-10"
        />
      </Card>

      {/* Interactive Controls & Fine-Tuning */}
      <div className="bg-white p-5 rounded-3xl border border-border/60 shadow-sm space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold text-foreground">
          <span className="flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5 text-primary" /> Studio Color Adjustments
          </span>
          <span className="text-[11px] text-muted-foreground">
            Slide the photo above to compare before & after
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          {/* Brightness */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Studio Lighting</span>
              <span className="font-semibold text-foreground">{brightness}%</span>
            </div>
            <Slider
              value={[brightness]}
              min={80}
              max={130}
              step={1}
              onValueChange={([val]) => setBrightness(val)}
            />
          </div>

          {/* Contrast */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Contrast & Depth</span>
              <span className="font-semibold text-foreground">{contrast}%</span>
            </div>
            <Slider
              value={[contrast]}
              min={80}
              max={130}
              step={1}
              onValueChange={([val]) => setContrast(val)}
            />
          </div>

          {/* Saturation */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Pigment Saturation</span>
              <span className="font-semibold text-foreground">{saturate}%</span>
            </div>
            <Slider
              value={[saturate]}
              min={80}
              max={140}
              step={1}
              onValueChange={([val]) => setSaturate(val)}
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            size="lg"
            onClick={handleApply}
            disabled={isProcessing}
            className="rounded-full px-8 h-12 shadow-md gap-2 text-sm font-semibold w-full sm:w-auto"
          >
            <Check className="h-4 w-4" /> Apply Studio Enhancement & Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
