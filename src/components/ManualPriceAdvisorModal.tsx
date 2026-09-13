"use client";

import React, { useState } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { artisanAiPriceAdvisor } from '@/ai/flows/artisan-ai-price-advisor';
import { Loader2, Sparkles, Clock, Hammer, Award } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ManualPriceAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  craftCategory: string;
  materialsUsed: string;
  onApplyPricing: (min: number, max: number, suggested: number, reasoning: string) => void;
}

export function ManualPriceAdvisorModal({
  isOpen,
  onClose,
  craftCategory,
  materialsUsed,
  onApplyPricing,
}: ManualPriceAdvisorModalProps) {
  const [category, setCategory] = useState(craftCategory || 'Pottery');
  const [materials, setMaterials] = useState(materialsUsed || 'Terracotta');
  const [hoursOfWork, setHoursOfWork] = useState<number>(8);
  const [complexity, setComplexity] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [isLoading, setIsLoading] = useState(false);
  const [advisorResult, setAdvisorResult] = useState<{
    recommendedMin: number;
    recommendedMax: number;
    reasoning: string;
  } | null>(null);

  const { toast } = useToast();

  const handleCalculate = async () => {
    setIsLoading(true);
    try {
      const res = await artisanAiPriceAdvisor({
        craftCategory: category,
        materialsUsed: materials,
        hoursOfWork: Number(hoursOfWork) || 1,
        complexity,
      });

      setAdvisorResult(res);
    } catch (err: any) {
      toast({
        title: "Calculation Failed",
        description: err?.message || "Could not calculate manual pricing guidance.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!advisorResult) return;
    const midpoint = Math.round((advisorResult.recommendedMin + advisorResult.recommendedMax) / 2);
    onApplyPricing(
      advisorResult.recommendedMin,
      advisorResult.recommendedMax,
      midpoint,
      advisorResult.reasoning
    );
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl p-6 bg-white shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-headline font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Manual Cost & Labor Price Advisor
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Calculate fair artisanal pricing based on labor hours, raw materials, and intricacy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Craft Category</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Raw Materials</Label>
              <Input
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-primary" /> Total Labor (Hours)
              </Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={hoursOfWork}
                onChange={(e) => setHoursOfWork(Number(e.target.value))}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Award className="h-3.5 w-3.5 text-primary" /> Craft Intricacy
              </Label>
              <Select value={complexity} onValueChange={(val: any) => setComplexity(val)}>
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low (Basic)</SelectItem>
                  <SelectItem value="Medium">Medium (Skilled)</SelectItem>
                  <SelectItem value="High">High (Mastery / Master Artisan)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleCalculate}
            disabled={isLoading}
            className="w-full h-11 rounded-xl font-bold text-xs gap-2"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />}
            Calculate Fair Wage Range
          </Button>

          {advisorResult && (
            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Calculated Fair Range
                </span>
                <span className="text-lg font-bold text-primary font-sans">
                  ₹{advisorResult.recommendedMin.toLocaleString('en-IN')} — ₹{advisorResult.recommendedMax.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                &ldquo;{advisorResult.reasoning}&rdquo;
              </p>
              <Button
                type="button"
                onClick={handleApply}
                className="w-full h-10 rounded-xl text-xs font-bold"
              >
                Apply This Range & Suggested Midpoint
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
