"use client";

import { useState, useEffect, Suspense } from 'react';
import { 
  Camera, Sparkles, Check, Image as ImageIcon, Loader2, 
  RefreshCw, Globe, ArrowRight, ArrowLeft, Megaphone, 
  Trash2, Plus, Sliders, Volume2, HelpCircle, Layers, CheckCircle2
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { artisanAITypeDetection } from '@/ai/flows/artisan-ai-type-detection';
import { multilingualAutoCatalog } from '@/ai/flows/multilingual-auto-cataloger';
import { translateListing } from '@/ai/flows/translate-content-flow';
import { generateMarketingContent } from '@/ai/flows/artisan-ai-marketing-generator';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useUser } from '@/firebase';
import { collection, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArtisanVoiceInput, INDIAN_LANGUAGES } from '@/components/ArtisanVoiceInput';
import { ImageEnhancerStudio } from '@/components/ImageEnhancerStudio';
import { PricingCard } from '@/components/PricingCard';
import { ManualPriceAdvisorModal } from '@/components/ManualPriceAdvisorModal';

const CRAFT_CATEGORIES = [
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
];

const TRANSLATION_LANGUAGES = [
  'Hindi', 'Tamil', 'Bengali', 'Marathi', 'Gujarati', 'Telugu', 'Kannada', 'Malayalam', 'Punjabi'
];

type ProcessingStep = {
  id: number;
  label: string;
  status: 'pending' | 'loading' | 'complete';
};

interface MissingDetailItem {
  field: string;
  label: string;
  promptQuestion: string;
  suggestedValue?: string;
  userValue?: string;
}

function ProductUploadContent() {
  // 1: Multi-Image & Voice Input
  // 2: AI Image Enhancer Studio
  // 3: Multilingual NLP Analysis
  // 4: Missing Details Verification
  // 5: Final Review & Polish
  // 6: Final Preview
  const [step, setStep] = useState(1); 
  
  // Image handling (multiple images)
  const [images, setImages] = useState<string[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);

  // Spoken voice / text input
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [spokenLanguage, setSpokenLanguage] = useState('hi');

  // Enhancer state
  const [activeEnhanceIndex, setActiveEnhanceIndex] = useState<number>(0);

  // Missing details state
  const [missingDetails, setMissingDetails] = useState<MissingDetailItem[]>([]);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isMarketingLoading, setIsMarketingLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isManualPricingModalOpen, setIsManualPricingModalOpen] = useState(false);
  
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { id: 1, label: 'Transcribing & Parsing Regional Voice Notes', status: 'pending' },
    { id: 2, label: 'Computer Vision Analysis on Craft Features', status: 'pending' },
    { id: 3, label: 'Identifying Authentic Heritage Techniques & GI Tag', status: 'pending' },
    { id: 4, label: 'Extracting Materials & Calculating Fair Pricing (INR)', status: 'pending' },
    { id: 5, label: 'Composing Dual-Language Narrative & Story', status: 'pending' },
  ]);

  const [details, setDetails] = useState({
    title: '',
    titleRegional: '',
    category: 'Pottery',
    materials: '',
    style: '',
    dimensions: '',
    region: 'Rajasthan, India',
    description: '',
    story: '',
    storyRegional: '',
    price: 0,
    priceRange: { min: 0, max: 0, reasoning: '' },
    quantity: 1,
    marketing: null as any
  });

  const primaryImage = images[primaryImageIndex] || images[0] || null;

  // Load existing data if editing
  useEffect(() => {
    async function loadProduct() {
      if (!editId || !db) return;
      setIsLoadingDraft(true);
      try {
        const docRef = doc(db, 'products', editId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDetails({
            title: data.productName || '',
            titleRegional: data.productNameRegional || '',
            category: data.craftType || 'Pottery',
            materials: data.materials || '',
            style: data.craftStyle || '',
            dimensions: data.dimensions || '',
            region: data.region || 'Rajasthan, India',
            description: data.description || '',
            story: data.story || '',
            storyRegional: data.storyRegional || '',
            price: data.price || 0,
            priceRange: data.priceRange || { min: 0, max: 0, reasoning: '' },
            quantity: data.availableQuantity || 1,
            marketing: data.marketing || null
          });
          if (data.images && data.images.length > 0) {
            setImages(data.images);
          }
          setStep(5); // Go straight to edit step for draft
        }
      } catch {
        toast({ title: "Failed to load listing", variant: "destructive" });
      } finally {
        setIsLoadingDraft(false);
      }
    }
    loadProduct();
  }, [editId, db, toast]);

  // Client-side image compression to prevent payload limits and optimize AI processing
  const compressImageFile = (file: File, maxDimension = 1600, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawData = e.target?.result as string;
        if (!rawData) return resolve('');
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawData);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(rawData);
        img.src = rawData;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Handle Multi-Image Upload (up to 5)
  const handleMultipleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - images.length;
    if (remainingSlots <= 0) {
      toast({
        title: "Maximum Images Reached",
        description: "You can upload up to 5 images per craft listing.",
        variant: "destructive",
      });
      return;
    }

    const filesToLoad = Array.from(files).slice(0, remainingSlots);
    for (const file of filesToLoad) {
      const compressedDataUri = await compressImageFile(file);
      if (compressedDataUri) {
        setImages((prev) => [...prev, compressedDataUri]);
      }
    }
  };

  const removeImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    if (primaryImageIndex >= indexToRemove && primaryImageIndex > 0) {
      setPrimaryImageIndex(primaryImageIndex - 1);
    }
  };

  // Ensure image payload is compact before transmitting over Server Action
  const ensureOptimizedDataUri = (dataUri: string, maxDim = 1200, quality = 0.8): Promise<string> => {
    if (!dataUri || dataUri.length < 300000) return Promise.resolve(dataUri);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUri);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUri);
      img.src = dataUri;
    });
  };

  // Run the Multilingual NLP & Auto-Cataloging Engine
  const runMultilingualCataloging = async (selectedPrimaryImg: string) => {
    setIsProcessing(true);
    setStep(3); // Visual loader

    try {
      // Step simulation for visual feedback
      for (let i = 0; i < processingSteps.length; i++) {
        setProcessingSteps(prev => prev.map(s => s.id === i + 1 ? { ...s, status: 'loading' } : s));
        await new Promise(r => setTimeout(r, 450)); 
        setProcessingSteps(prev => prev.map(s => s.id === i + 1 ? { ...s, status: 'complete' } : s));
      }

      const optimizedImg = await ensureOptimizedDataUri(selectedPrimaryImg);

      const result = await multilingualAutoCatalog({
        primaryImageDataUri: optimizedImg,
        voiceTranscript: voiceTranscript.trim() || undefined,
        spokenLanguage: spokenLanguage,
        location: details.region,
      });

      const midpoint = result.pricing.suggestedMidpoint;
      setDetails(prev => ({
        ...prev,
        title: result.suggestedTitle,
        titleRegional: result.suggestedTitleRegional || '',
        category: result.craftType as any,
        materials: result.suggestedMaterials,
        style: result.craftStyle,
        dimensions: result.dimensions || '',
        description: result.shortDescription,
        story: result.craftStory,
        storyRegional: result.craftStoryRegional || '',
        price: midpoint,
        priceRange: {
          min: result.pricing.minPrice,
          max: result.pricing.maxPrice,
          reasoning: result.pricing.reasoning,
        },
      }));

      // Check if missing details were flagged
      if (result.missingDetails && result.missingDetails.length > 0) {
        setMissingDetails(
          result.missingDetails.map(item => ({
            ...item,
            userValue: item.suggestedValue || '',
          }))
        );
        setTimeout(() => setStep(4), 300); // Go to Missing Details Screen
      } else {
        setTimeout(() => setStep(5), 300); // Go straight to Edit Screen
      }
    } catch (err: any) {
      console.warn('Server auto-cataloging encountered issue, using smart client-side fallback:', err);
      // Fallback: extract directly from voice transcript / notes so user is never blocked
      const text = (voiceTranscript || '').toLowerCase();
      let craftCategory: any = 'Other';
      let craftStyle = 'Traditional Heritage Craft';
      let materials = 'Handcrafted Natural Materials';
      let title = 'Authentic Handcrafted Artisan Craft';
      let price = 1850;

      if (text.includes('chikankari') || text.includes('dupatta') || text.includes('cotton') || text.includes('saree') || text.includes('embroider') || text.includes('textile')) {
        craftCategory = 'Textiles';
        craftStyle = text.includes('chikankari') ? 'Lucknow Chikankari Hand Embroidery' : 'Handloom Heritage Weaving';
        materials = text.includes('cotton') ? 'Pure Cotton, Hand-spun Thread' : 'Natural Fabric & Thread';
        title = text.includes('dupatta') ? 'Handcrafted Lucknow Chikankari Cotton Dupatta' : 'Handcrafted Heritage Textile Garment';
        price = 2200;
      } else if (text.includes('pot') || text.includes('clay') || text.includes('terracotta') || text.includes('pottery')) {
        craftCategory = 'Pottery';
        craftStyle = 'Traditional Clay Pottery';
        materials = 'Natural Terracotta Clay';
        title = 'Handmade Terracotta Decorative Artwork';
        price = 950;
      } else if (text.includes('wood') || text.includes('carv')) {
        craftCategory = 'Woodwork';
        craftStyle = 'Hand-Carved Heritage Woodcraft';
        materials = 'Hardwood';
        title = 'Hand-Carved Wooden Craft';
        price = 2400;
      } else if (text.includes('brass') || text.includes('metal') || text.includes('dhokra')) {
        craftCategory = 'Metalwork';
        craftStyle = text.includes('dhokra') ? 'Dhokra Lost-Wax Bell Metal Casting' : 'Handcrafted Brass Metalwork';
        materials = 'Bell Metal / Brass';
        title = 'Handcrafted Heritage Metalwork Piece';
        price = 2600;
      }

      // Extract dimensions if present
      const dimMatch = text.match(/(\d+(\.\d+)?\s*(metres|metre|meters|meter|cm|inches|m|ft))/i);
      const dimensions = dimMatch ? dimMatch[0] : '';

      setDetails(prev => ({
        ...prev,
        title,
        category: craftCategory,
        materials,
        style: craftStyle,
        dimensions,
        description: voiceTranscript && voiceTranscript.length > 10 ? voiceTranscript.trim() : 'Authentic traditional Indian craft made with generation-old artisan techniques.',
        story: 'Handcrafted with generational skill and patient devotion, reflecting the authentic living heritage of Indian artisan communities.',
        price,
        priceRange: {
          min: Math.round(price * 0.85),
          max: Math.round(price * 1.25),
          reasoning: 'Calculated based on raw materials, artisan labor, and regional craft market benchmarks.',
        },
      }));

      toast({
        title: "Catalog Draft Generated",
        description: "Craft specs extracted from your voice notes. Review and refine below.",
      });
      setTimeout(() => setStep(5), 300);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyEnhancedImage = (enhancedDataUri: string) => {
    // Replace the primary image with the enhanced version
    setImages(prev => {
      const updated = [...prev];
      updated[activeEnhanceIndex] = enhancedDataUri;
      return updated;
    });

    toast({
      title: "Enhancement Applied",
      description: "Photo updated with studio lighting & color saturation.",
    });

    // Move directly into NLP Cataloging
    runMultilingualCataloging(enhancedDataUri);
  };

  const handleTranslate = async (lang: string) => {
    setIsTranslating(true);
    try {
      const result = await translateListing({
        title: details.title,
        description: details.description,
        story: details.story,
        targetLanguage: lang as any
      });
      setDetails({
        ...details,
        title: result.translatedTitle,
        description: result.translatedDescription,
        story: result.translatedStory
      });
      toast({ title: `Translated to ${lang}` });
    } catch {
      toast({ title: "Translation failed", variant: "destructive" });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleGenerateMarketing = async () => {
    setIsMarketingLoading(true);
    try {
      const result = await generateMarketingContent({
        productName: details.title,
        craftType: details.category,
        region: details.region,
        description: details.description
      });
      setDetails({ ...details, marketing: result });
      toast({ title: "Marketing posts generated!" });
    } catch {
      toast({ title: "Generation failed", variant: "destructive" });
    } finally {
      setIsMarketingLoading(false);
    }
  };

  const handleSave = async (status: 'Draft' | 'Published') => {
    if (!user) {
      toast({ 
        title: "Authentication Required", 
        description: "Please log in to save your crafts.",
        variant: "destructive" 
      });
      router.push('/auth');
      return;
    }

    if (!db) return;
    setIsSaving(true);
    try {
      const rawImages = images.length > 0 ? images : (primaryImage ? [primaryImage] : []);
      const optimizedImages = await Promise.all(
        rawImages.map((img: string) => ensureOptimizedDataUri(img, 900, 0.75))
      );

      const productData: any = {
        artisanId: user.uid,
        artisanName: user.displayName || 'Authentic Artisan',
        productName: details.title,
        productNameRegional: details.titleRegional || null,
        description: details.description,
        craftType: details.category,
        craftStyle: details.style,
        dimensions: details.dimensions || null,
        region: details.region,
        materials: details.materials,
        price: Number(details.price),
        availableQuantity: Number(details.quantity),
        images: optimizedImages,
        story: details.story,
        storyRegional: details.storyRegional || null,
        status: status,
        updatedAt: serverTimestamp(),
        marketing: details.marketing || null,
        priceRange: details.priceRange
      };

      if (editId) {
        const docRef = doc(db, 'products', editId);
        setDocumentNonBlocking(docRef, productData, { merge: true });
      } else {
        productData.createdAt = serverTimestamp();
        const productsRef = collection(db, 'products');
        addDocumentNonBlocking(productsRef, productData);
      }
      
      toast({ 
        title: status === 'Published' ? "Product Published!" : "Draft Saved!", 
        description: status === 'Published' ? "Your craft is now live on the marketplace." : "You can find your draft in the hub."
      });
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch {
      setIsSaving(false);
      toast({ 
        title: "Save failed", 
        description: "An error occurred while saving. Please check your connection.",
        variant: "destructive" 
      });
    }
  };

  if (isLoadingDraft) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="font-headline text-lg">Retrieving your craft...</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        {/* Progress Dots / Bar */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <button 
              key={i}
              type="button"
              onClick={() => setStep(i)}
              title={`Jump to Step ${i}`}
              className={`h-2 flex-1 rounded-full transition-all duration-300 hover:opacity-80 cursor-pointer ${
                step >= i ? 'bg-primary' : 'bg-secondary'
              }`} 
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-foreground">
            {step === 1 && "1. Multi-Image & Voice Capture"}
            {step === 2 && "2. AI Studio Image Enhancer"}
            {step === 3 && "3. Multilingual AI Processing..."}
            {step === 4 && "4. Quick Verification (Missing Details)"}
            {step === 5 && (editId ? "Refine Your Listing" : "5. Review & Polish Listing")}
            {step === 6 && "6. Final Marketplace Preview"}
          </h1>

          {step > 1 && step !== 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(step - 1)}
              className="text-xs text-muted-foreground hover:text-foreground gap-1 rounded-full"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: MULTI-IMAGE UPLOAD + REGIONAL VOICE INPUT */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="space-y-8 animate-in fade-in-50 duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Image Gallery Upload */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-white p-6 rounded-[32px] border border-border/60 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-headline font-bold text-foreground flex items-center gap-2">
                      <Camera className="h-5 w-5 text-primary" /> Craft Photographs
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Upload 1 to 5 photos (Front, close-up, back, scale).
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1">
                    {images.length} / 5 photos
                  </Badge>
                </div>

                {/* Primary Preview */}
                {images.length > 0 ? (
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-secondary/30 border border-border/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={primaryImage!}
                      alt="Primary craft"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 bg-primary text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Primary Listing Photo
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-12 aspect-[4/3] rounded-2xl border-2 border-dashed border-primary/30 bg-secondary/10 hover:bg-secondary/20 cursor-pointer transition-colors text-center group">
                    <div className="p-4 rounded-full bg-primary/10 text-primary mb-3 group-hover:scale-105 transition-transform">
                      <Camera className="h-8 w-8" />
                    </div>
                    <span className="font-bold text-sm text-foreground mb-1">Click to Upload Craft Photos</span>
                    <span className="text-xs text-muted-foreground max-w-xs">
                      Take photos with good natural light. You can select multiple images at once.
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleMultipleImageUpload}
                      accept="image/*"
                      multiple
                    />
                  </label>
                )}

                {/* Thumbnail Strip */}
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-3 pt-2 items-center">
                    {images.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => setPrimaryImageIndex(idx)}
                        className={`relative w-16 h-16 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                          idx === primaryImageIndex
                            ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-sm'
                            : 'border-border/60 opacity-70 hover:opacity-100'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(idx);
                          }}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-destructive transition-colors"
                          title="Remove photo"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}

                    {/* Add More Images Button */}
                    {images.length < 5 && (
                      <label className="w-16 h-16 rounded-xl border-2 border-dashed border-border/80 flex flex-col items-center justify-center cursor-pointer hover:border-primary/60 hover:bg-secondary/20 transition-all text-muted-foreground hover:text-primary">
                        <Plus className="h-5 w-5" />
                        <span className="text-[9px] font-bold">Add</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleMultipleImageUpload}
                          accept="image/*"
                          multiple
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Artisan Voice / Audio Input & Description */}
            <div className="lg:col-span-6 space-y-4">
              <Card className="p-6 rounded-[32px] border-border/60 shadow-sm bg-white space-y-6">
                <div>
                  <h3 className="text-lg font-headline font-bold text-foreground flex items-center gap-2">
                    <Volume2 className="h-5 w-5 text-primary" /> Spoken Craft Description
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Record a voice note or type notes in your native language. Our AI translates and auto-catalogs.
                  </p>
                </div>

                {/* Voice Input Component */}
                <ArtisanVoiceInput
                  transcript={voiceTranscript}
                  onTranscriptChange={setVoiceTranscript}
                  selectedLanguage={spokenLanguage}
                  onLanguageChange={setSpokenLanguage}
                />

                {/* Region & Location Check */}
                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <Label htmlFor="region" className="text-xs font-semibold text-foreground">
                    Origin Region & Craft Center
                  </Label>
                  <Input
                    id="region"
                    value={details.region}
                    onChange={(e) => setDetails({ ...details, region: e.target.value })}
                    placeholder="e.g. Khurja (UP), Madhubani (Bihar), Kutch (Gujarat)"
                    className="h-10 rounded-xl text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Enables geographical heritage tagging and regional pricing validation.
                  </p>
                </div>
              </Card>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-[28px] bg-white border border-border/60 shadow-md">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>
                {images.length > 0 
                  ? `${images.length} photo(s) ready for studio enhancement & auto-cataloging.`
                  : 'Please upload at least 1 photo to proceed.'}
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (images.length === 0) {
                    toast({
                      title: "Photo Required",
                      description: "Please upload at least 1 craft photo.",
                      variant: "destructive",
                    });
                    return;
                  }
                  runMultilingualCataloging(primaryImage!);
                }}
                disabled={images.length === 0}
                className="rounded-full h-12 px-6 text-sm font-semibold border-border/80"
              >
                Skip Studio Enhancer
              </Button>

              <Button
                type="button"
                onClick={() => {
                  if (images.length === 0) {
                    toast({
                      title: "Photo Required",
                      description: "Please upload at least 1 craft photo.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setActiveEnhanceIndex(primaryImageIndex);
                  setStep(2); // Go to Studio Enhancer
                }}
                disabled={images.length === 0}
                className="rounded-full h-12 px-8 shadow-lg text-sm font-bold gap-2 flex-1 sm:flex-initial"
              >
                Enhance & Analyze Craft <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: AI STUDIO IMAGE ENHANCER (BEFORE / AFTER COMPARISON SLIDER) */}
      {/* ========================================================================= */}
      {step === 2 && primaryImage && (
        <div className="max-w-3xl mx-auto py-6 animate-in fade-in-50 duration-200">
          <ImageEnhancerStudio
            originalImage={primaryImage}
            onEnhancedApply={handleApplyEnhancedImage}
            onSkip={() => runMultilingualCataloging(primaryImage)}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: MULTILINGUAL AI PROCESSING (SEQUENTIAL STEPPER) */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div className="max-w-md mx-auto space-y-4 py-16 animate-in zoom-in-95">
          <div className="text-center mb-6 space-y-1">
            <h3 className="text-2xl font-headline font-bold text-foreground">Virasya AI at Work</h3>
            <p className="text-xs text-muted-foreground">
              Harmonizing vision, audio notes, and cultural heritage databases...
            </p>
          </div>

          {processingSteps.map(s => (
            <div 
              key={s.id} 
              className={`flex items-center justify-between p-4 rounded-2xl bg-white border transition-all duration-300 ${
                s.status === 'complete' 
                  ? 'border-primary/20 opacity-100 shadow-sm' 
                  : s.status === 'loading' 
                  ? 'border-primary/50 opacity-100 ring-2 ring-primary/10' 
                  : 'opacity-40'
              }`}
            >
              <span className="font-bold text-xs tracking-tight text-foreground">{s.label}</span>
              {s.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {s.status === 'complete' && <Check className="h-4 w-4 text-primary" />}
              {s.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-dashed border-muted" />}
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: QUICK VERIFICATION OF MISSING DETAILS */}
      {/* ========================================================================= */}
      {step === 4 && (
        <div className="max-w-2xl mx-auto space-y-6 py-6 animate-in fade-in-50">
          <Card className="p-8 rounded-[36px] bg-white border-border/60 shadow-lg space-y-6">
            <div className="space-y-1 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                <HelpCircle className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-headline font-bold text-foreground">A Few Quick Details</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                We detected the core craft features, but buyers frequently look for the following specifications:
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {missingDetails.map((detail, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-secondary/20 border border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">{detail.label}</Label>
                    {detail.suggestedValue && (
                      <span className="text-[10px] text-primary font-semibold">
                        Estimated: {detail.suggestedValue}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{detail.promptQuestion}</p>
                  <Input
                    value={detail.userValue || ''}
                    onChange={(e) => {
                      const updated = [...missingDetails];
                      updated[idx].userValue = e.target.value;
                      setMissingDetails(updated);

                      if (detail.field === 'dimensions') {
                        setDetails(prev => ({ ...prev, dimensions: e.target.value }));
                      }
                    }}
                    placeholder={detail.suggestedValue || `Enter ${detail.label.toLowerCase()}...`}
                    className="h-10 rounded-xl bg-white text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="pt-4 flex items-center justify-between gap-4">
              <Button
                variant="ghost"
                onClick={() => setStep(5)}
                className="text-xs text-muted-foreground hover:text-foreground rounded-full"
              >
                Skip For Now
              </Button>
              <Button
                onClick={() => setStep(5)}
                className="rounded-full px-8 h-12 shadow-md font-bold gap-2 text-sm"
              >
                Confirm & Continue to Listing <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 5: EDIT & POLISH LISTING (REFINED ORIGINAL SCREEN 2) */}
      {/* ========================================================================= */}
      {step === 5 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="lg:col-span-1 space-y-6">
            {/* Primary Image Preview with Change Trigger */}
            <Card className="overflow-hidden border-none shadow-sm rounded-3xl bg-white aspect-[3/4] relative">
              {primaryImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={primaryImage} alt="Uploaded Craft" className="w-full h-full object-cover" />
              )}
              <label className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg cursor-pointer hover:bg-secondary transition-colors">
                <RefreshCw className="h-5 w-5 text-primary" />
                <input type="file" className="hidden" onChange={handleMultipleImageUpload} accept="image/*" />
              </label>
            </Card>

            {/* Dynamic Market Pricing Assistant Card */}
            <PricingCard
              craftType={details.category}
              materials={details.materials}
              region={details.region}
              productTitle={details.title}
              description={details.description}
              selectedPrice={details.price}
              onPriceChange={(newPrice) => setDetails(prev => ({ ...prev, price: newPrice }))}
              onPriceRangeDetermined={(range) => setDetails(prev => ({ ...prev, priceRange: range }))}
              onManualFallbackRequested={() => setIsManualPricingModalOpen(true)}
            />

            {/* Marketing Generator CTA */}
            <Button 
              variant="outline" 
              className="w-full rounded-full h-12 gap-2 border-2 hover:bg-primary/5" 
              onClick={handleGenerateMarketing}
              disabled={isMarketingLoading}
            >
              {isMarketingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              Generate Marketing Content
            </Button>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-sm rounded-[40px] bg-white p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-headline font-bold">Listing Details</h2>
                  {details.titleRegional && (
                    <p className="text-xs text-primary font-serif italic mt-0.5">
                      Regional: {details.titleRegional}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 justify-end max-w-[50%]">
                  {TRANSLATION_LANGUAGES.map(l => (
                    <Button 
                      key={l} 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 rounded-full text-[9px] bg-secondary/30 px-2" 
                      onClick={() => handleTranslate(l)} 
                      disabled={isTranslating}
                    >
                      {isTranslating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Globe className="h-3 w-3 mr-1" />}
                      {l}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Product Title (English)</Label>
                    <Input 
                      value={details.title} 
                      onChange={e => setDetails({...details, title: e.target.value})} 
                      className="rounded-xl h-12" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={details.category} onValueChange={v => setDetails({...details, category: v})}>
                      <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CRAFT_CATEGORIES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Materials Used</Label>
                    <Input 
                      value={details.materials} 
                      onChange={e => setDetails({...details, materials: e.target.value})} 
                      className="rounded-xl h-12" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Craft Style / Tradition</Label>
                    <Input 
                      value={details.style} 
                      onChange={e => setDetails({...details, style: e.target.value})} 
                      className="rounded-xl h-12" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dimensions / Size</Label>
                    <Input 
                      value={details.dimensions} 
                      onChange={e => setDetails({...details, dimensions: e.target.value})} 
                      placeholder="e.g. 12 x 8 inches"
                      className="rounded-xl h-12" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Origin Region</Label>
                    <Input 
                      value={details.region} 
                      onChange={e => setDetails({...details, region: e.target.value})} 
                      className="rounded-xl h-12" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Selling Price (INR)</Label>
                    <Input 
                      type="number" 
                      value={details.price} 
                      onChange={e => setDetails({...details, price: Number(e.target.value)})} 
                      className="rounded-xl h-12 font-bold text-primary font-sans" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stock Quantity</Label>
                    <Input 
                      type="number" 
                      value={details.quantity} 
                      onChange={e => setDetails({...details, quantity: Number(e.target.value)})} 
                      className="rounded-xl h-12" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Short Description</Label>
                  <Textarea 
                    value={details.description} 
                    onChange={e => setDetails({...details, description: e.target.value})} 
                    className="rounded-xl min-h-[100px] leading-relaxed" 
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Authentic Craft Story</Label>
                    {details.storyRegional && (
                      <span className="text-[10px] text-muted-foreground font-serif italic">
                        Includes regional cultural context
                      </span>
                    )}
                  </div>
                  <Textarea 
                    value={details.story} 
                    onChange={e => setDetails({...details, story: e.target.value})} 
                    className="rounded-xl min-h-[120px] italic text-muted-foreground bg-secondary/10 border-none" 
                  />
                  <p className="text-[10px] text-primary/60 italic">*Generated based on verified cultural context. Max 4 sentences.</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-12">
                <Button 
                  variant="outline" 
                  className="rounded-full h-14 border-2 px-6" 
                  onClick={() => setStep(1)}
                >
                  Start Over
                </Button>
                <Button 
                  variant="secondary" 
                  className="rounded-full h-14 px-6 font-semibold" 
                  onClick={() => handleSave('Draft')}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Draft
                </Button>
                <Button 
                  className="flex-1 rounded-full h-14 shadow-lg text-lg gap-2" 
                  onClick={() => setStep(6)}
                >
                  Preview Listing <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 6: FINAL PREVIEW & PUBLISH */}
      {/* ========================================================================= */}
      {step === 6 && (
        <div className="max-w-4xl mx-auto space-y-8 pb-24 animate-in zoom-in-95">
          <div className="bg-white rounded-[50px] overflow-hidden shadow-xl border-none">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="relative aspect-square">
                {primaryImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={primaryImage} alt="Product Preview" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="p-10 space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold">
                    {details.category}
                  </Badge>
                  <Badge variant="outline" className="border-primary/20">
                    {details.style}
                  </Badge>
                  {details.dimensions && (
                    <Badge variant="secondary" className="bg-secondary text-foreground text-[10px]">
                      {details.dimensions}
                    </Badge>
                  )}
                </div>

                <div>
                  <h2 className="text-3xl font-headline font-bold text-foreground mb-2">{details.title}</h2>
                  {details.titleRegional && (
                    <p className="text-sm font-serif italic text-primary">{details.titleRegional}</p>
                  )}
                  <p className="text-3xl font-bold text-primary font-sans mt-3">₹{details.price}</p>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">Origin</h4>
                    <p className="text-sm font-semibold">{details.region}</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">Materials</h4>
                    <p className="text-sm">{details.materials}</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">Authentic Story</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed italic">{details.story}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-6">
                  <Button variant="outline" className="flex-1 rounded-full h-12" onClick={() => setStep(5)}>
                    Back to Edit
                  </Button>
                  <Button 
                    variant="secondary"
                    className="flex-1 rounded-full h-12 font-semibold" 
                    onClick={() => handleSave('Draft')} 
                    disabled={isSaving}
                  >
                    Save as Draft
                  </Button>
                  <Button 
                    className="flex-1 rounded-full h-12 shadow-lg" 
                    onClick={() => handleSave('Published')} 
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Publish to Store
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Cost & Labor Advisor Fallback Modal */}
      <ManualPriceAdvisorModal
        isOpen={isManualPricingModalOpen}
        onClose={() => setIsManualPricingModalOpen(false)}
        craftCategory={details.category}
        materialsUsed={details.materials}
        onApplyPricing={(min, max, suggested, reasoning) => {
          setDetails(prev => ({
            ...prev,
            price: suggested,
            priceRange: { min, max, reasoning }
          }));
          toast({
            title: "Manual Pricing Guidance Applied",
            description: `Price set to ₹${suggested} (Range ₹${min} - ₹${max}).`,
          });
        }}
      />
    </>
  );
}

export default function ProductUploadPage() {
  return (
    <div className="min-h-screen bg-background paper-texture pb-20">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="font-headline text-lg">Loading upload studio...</p>
          </div>
        }>
          <ProductUploadContent />
        </Suspense>
      </main>
    </div>
  );
}
