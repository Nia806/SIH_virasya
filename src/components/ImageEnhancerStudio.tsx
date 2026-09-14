"use client";

import { useState, useMemo } from 'react';
import { Sparkles, Check, Sliders, RefreshCw, Wand2, Image as ImageIcon, Layers, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { removeBackground } from '@imgly/background-removal';

interface ImageEnhancerStudioProps {
  originalImage: string;
  onEnhancedApply: (enhancedDataUri: string) => void;
  onSkip: () => void;
}

export type StudioBackdrop = 'white' | 'warm-heritage' | 'cool-slate' | 'transparent' | 'original';

export function ImageEnhancerStudio({
  originalImage,
  onEnhancedApply,
  onSkip,
}: ImageEnhancerStudioProps) {
  // Enhancement parameters
  const [brightness, setBrightness] = useState(108); // +8%
  const [contrast, setContrast] = useState(112);   // +12%
  const [saturate, setSaturate] = useState(115);   // +15%
  const [sharpness, setSharpness] = useState(35);   // Pixel-level unsharp convolution mask (0-100)
  const [sliderPos, setSliderPos] = useState(50);   // Comparison split position (0 - 100)
  
  // AI Background Removal & Backdrop State
  const [backdrop, setBackdrop] = useState<StudioBackdrop>('white');
  const [cutoutDataUri, setCutoutDataUri] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Trigger in-browser ONNX/WASM AI Background Removal
  const handleRemoveBackground = async () => {
    if (isRemovingBg) return;
    setIsRemovingBg(true);
    try {
      // Run @imgly/background-removal entirely in the browser
      const blob = await removeBackground(originalImage, {
        progress: (key, current, total) => {
          console.log(`AI Segmentation ${key}: ${Math.round((current / total) * 100)}%`);
        }
      });
      const reader = new FileReader();
      reader.onloadend = () => {
        setCutoutDataUri(reader.result as string);
        if (backdrop === 'original') {
          setBackdrop('white');
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("AI Background Removal failed, falling back to studio format:", err);
    } finally {
      setIsRemovingBg(false);
    }
  };

  const handleSelectBackdrop = (selected: StudioBackdrop) => {
    setBackdrop(selected);
    if (selected !== 'original' && !cutoutDataUri && !isRemovingBg) {
      handleRemoveBackground();
    }
  };

  // Pixel-level 3x3 convolution matrix for high-definition edge & texture sharpening on export
  const applyPixelSharpening = (ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) => {
    if (amount <= 0) return;
    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const copy = new Uint8ClampedArray(data);
      const a = (amount / 100) * 0.45;
      const centerWeight = 1 + 4 * a;

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          for (let c = 0; c < 3; c++) {
            const top = copy[((y - 1) * width + x) * 4 + c];
            const bottom = copy[((y + 1) * width + x) * 4 + c];
            const left = copy[(y * width + (x - 1)) * 4 + c];
            const right = copy[(y * width + (x + 1)) * 4 + c];
            const center = copy[idx + c];

            const val = center * centerWeight - (top + bottom + left + right) * a;
            data[idx + c] = Math.min(255, Math.max(0, val));
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
    } catch (e) {
      console.warn("Canvas pixel manipulation skipped:", e);
    }
  };

  // Generate final e-commerce studio image on 1:1 Canvas with optional 3D drop-shadow
  const generateEnhancedImage = async (): Promise<string> => {
    return new Promise((resolve) => {
      const imageToRender = (backdrop !== 'original' && cutoutDataUri) ? cutoutDataUri : originalImage;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const rawW = img.naturalWidth || img.width;
        const rawH = img.naturalHeight || img.height;
        
        // E-Commerce 1:1 Studio Output Canvas (2048 x 2048 max HD)
        const canvasSize = Math.max(2048, Math.max(rawW, rawH));
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(originalImage);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 1. Draw Selected Studio Backdrop
        if (backdrop === 'white') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvasSize, canvasSize);
        } else if (backdrop === 'warm-heritage') {
          const grad = ctx.createRadialGradient(canvasSize/2, canvasSize/2, 100, canvasSize/2, canvasSize/2, canvasSize);
          grad.addColorStop(0, '#fffbf5');
          grad.addColorStop(1, '#f5ebe0');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvasSize, canvasSize);
        } else if (backdrop === 'cool-slate') {
          const grad = ctx.createRadialGradient(canvasSize/2, canvasSize/2, 100, canvasSize/2, canvasSize/2, canvasSize);
          grad.addColorStop(0, '#f8fafc');
          grad.addColorStop(1, '#e2e8f0');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvasSize, canvasSize);
        } else if (backdrop === 'transparent') {
          ctx.clearRect(0, 0, canvasSize, canvasSize);
        }

        // Calculate 1:1 Centered Aspect Ratio with 12% padding margin
        const targetMax = canvasSize * 0.78;
        const scaleRatio = Math.min(targetMax / rawW, targetMax / rawH);
        const drawW = rawW * scaleRatio;
        const drawH = rawH * scaleRatio;
        const drawX = (canvasSize - drawW) / 2;
        const drawY = (canvasSize - drawH) / 2;

        // 2. Draw Soft Directional 3D Drop-Shadow if cutout is used
        if (cutoutDataUri && backdrop !== 'transparent' && backdrop !== 'original') {
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
          ctx.shadowBlur = 40;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 25;
          ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();
        } else {
          ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
          if (backdrop === 'original') {
            ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
          } else {
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
          }
        }

        // 3. Apply Pixel-Level Micro-Texture Sharpening
        ctx.filter = 'none';
        applyPixelSharpening(ctx, canvasSize, canvasSize, sharpness);

        resolve(canvas.toDataURL(backdrop === 'transparent' ? 'image/png' : 'image/jpeg', 0.95));
      };
      img.onerror = () => resolve(originalImage);
      img.src = imageToRender;
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
    setSharpness(35);
    setBackdrop('white');
  };

  // Real-time CSS Filter string + SVG Convolve Matrix for 100% Live Preview
  const sharpenVal = (sharpness / 100) * 0.5;
  const liveFilterStyle = useMemo(() => {
    return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) ${sharpness > 0 ? 'url(#live-sharpen-filter)' : ''}`;
  }, [brightness, contrast, saturate, sharpness]);

  // Live Backdrop Style for Instant Real-Time Preview Container
  const liveBackdropStyle = useMemo(() => {
    if (backdrop === 'white') {
      return { backgroundColor: '#ffffff' };
    }
    if (backdrop === 'warm-heritage') {
      return { background: 'radial-gradient(circle at center, #fffbf5 0%, #f5ebe0 100%)' };
    }
    if (backdrop === 'cool-slate') {
      return { background: 'radial-gradient(circle at center, #f8fafc 0%, #e2e8f0 100%)' };
    }
    if (backdrop === 'transparent') {
      return { 
        backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px), radial-gradient(#cbd5e1 1px, #ffffff 1px)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 10px 10px'
      };
    }
    return {};
  }, [backdrop]);

  return (
    <div className="space-y-6">
      {/* Hidden SVG Filter for Real-Time Pixel Sharpening Preview */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        <filter id="live-sharpen-filter">
          <feConvolveMatrix
            order="3,3"
            preserveAlpha={true}
            kernelMatrix={`0 -${sharpenVal} 0 -${sharpenVal} ${1 + 4 * sharpenVal} -${sharpenVal} 0 -${sharpenVal} 0`}
          />
        </filter>
      </svg>


      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <h3 className="text-xl font-headline font-bold text-foreground">
              AI Craft Studio Enhancer & Background Remover
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            In-browser AI background segmentation, studio formatting, auto-lighting balance & real-time HD pixel sharpening.
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

      {/* AI One-Click Action Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-primary/10 to-orange-500/10 p-4 rounded-2xl border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary text-white shadow-md">
            <Wand2 className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">AI Background Clutter Removal</h4>
            <p className="text-xs text-muted-foreground">
              Isolates handicraft from workshop clutter using in-browser AI vision model.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleRemoveBackground}
          disabled={isRemovingBg}
          className="rounded-full px-6 gap-2 text-xs font-semibold shadow-md shrink-0 w-full sm:w-auto"
        >
          {isRemovingBg ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" /> Segmenting AI Object...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 text-amber-300" /> {cutoutDataUri ? 'Re-Run AI Segmentation' : 'Auto-Remove Workshop Clutter'}
            </>
          )}
        </Button>
      </div>

      {/* Interactive Split Comparison Viewer with Real-Time Studio Canvas & Sharpening */}
      <Card 
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-secondary/20 shadow-md aspect-[4/3] max-h-[460px] mx-auto select-none transition-all duration-300"
        style={backdrop !== 'original' ? liveBackdropStyle : undefined}
      >
        {/* Enhanced Image (Base) - Live Real-Time Studio Preview */}
        <div className="absolute inset-0 w-full h-full flex items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={(backdrop !== 'original' && cutoutDataUri) ? cutoutDataUri : originalImage}
            alt="Enhanced Craft"
            className="w-full h-full object-contain transition-all duration-200"
            style={{ 
              filter: `${liveFilterStyle}${(cutoutDataUri && backdrop !== 'transparent' && backdrop !== 'original') ? ' drop-shadow(0px 20px 30px rgba(0, 0, 0, 0.25))' : ''}`
            }}

          />
          <div className="absolute bottom-3 right-4 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 shadow-lg z-20">
            <Sparkles className="h-3 w-3 text-amber-400" /> {cutoutDataUri ? 'AI Studio Cutout & HD Sharpened' : 'Real-Time HD Studio Enhanced'}
          </div>
        </div>

        {/* Original Image (Clipped by slider position) */}
        <div
          className="absolute inset-0 h-full overflow-hidden border-r-2 border-white shadow-2xl z-10"
          style={{ width: `${sliderPos}%` }}
        >
          <div className="w-full h-full bg-slate-900/40 flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={originalImage}
              alt="Original Craft"
              className="absolute top-0 left-0 w-full h-full object-contain max-w-none"
              style={{ width: '100%', height: '100%' }}
            />
            <div className="absolute bottom-3 left-4 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] font-semibold shadow-lg">
              Raw Workshop Photo
            </div>
          </div>
        </div>

        {/* Slider Handle Overlay */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] cursor-ew-resize flex items-center justify-center pointer-events-none z-30"
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
          className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full z-40"
        />
      </Card>

      {/* Interactive Controls & Fine-Tuning */}
      <div className="bg-white p-5 rounded-3xl border border-border/60 shadow-sm space-y-5">
        {/* Studio Backdrop Selectors */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-primary" /> E-Commerce Studio Backdrop (Real-Time Live)
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'white', label: 'Studio White', bg: 'bg-white border-gray-300' },
              { id: 'warm-heritage', label: 'Warm Heritage', bg: 'bg-amber-50 border-amber-200' },
              { id: 'cool-slate', label: 'Cool Slate', bg: 'bg-slate-100 border-slate-300' },
              { id: 'transparent', label: 'Transparent PNG', bg: 'bg-checkered border-gray-300' },
              { id: 'original', label: 'Original Workshop', bg: 'bg-gray-100 border-gray-300' },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleSelectBackdrop(b.id as StudioBackdrop)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  backdrop === b.id
                    ? 'bg-primary text-white border-primary shadow-md'
                    : 'bg-secondary/40 text-foreground hover:bg-secondary border-border/60'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full border ${b.bg}`} />
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Color & Sharpness Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1 border-t border-border/40">
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

          {/* Sharpness (Pixel Level) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Pixel Micro-Sharpness</span>
              <span className="font-semibold text-primary">{sharpness}%</span>
            </div>
            <Slider
              value={[sharpness]}
              min={0}
              max={100}
              step={1}
              onValueChange={([val]) => setSharpness(val)}
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            size="lg"
            onClick={handleApply}
            disabled={isProcessing || isRemovingBg}
            className="rounded-full px-8 h-12 shadow-md gap-2 text-sm font-semibold w-full sm:w-auto"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" /> Rendering HD Studio Image...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" /> Apply AI Studio Enhancement & Continue
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
