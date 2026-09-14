
"use client";

import Link from 'next/link';
import { 
  Plus, Package, Trash2, Share2, Loader2, 
  TrendingUp, Eye, Globe, PackageCheck,
  BookOpen, Sparkles, Camera, Pencil, Megaphone
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogDescription 
} from '@/components/ui/dialog';
import Image from 'next/image';
import { useState } from 'react';
import { generateMarketingContent } from '@/ai/flows/artisan-ai-marketing-generator';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, deleteDoc, doc } from 'firebase/firestore';

export default function ArtisanDashboard() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const [isMarketingLoading, setIsMarketingLoading] = useState(false);
  const [marketingResult, setMarketingResult] = useState<any>(null);
  const [marketingProduct, setMarketingProduct] = useState<any>(null);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'userProfiles', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc(profileRef);

  const productsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'products'), where('artisanId', '==', user.uid));
  }, [db, user]);

  const { data: listings, isLoading: isListingsLoading } = useCollection(productsQuery);

  const stats = [
    { 
      label: 'Total Sales', 
      value: '45,800', 
      isCurrency: true, 
      trend: '+12.5%', 
      icon: <TrendingUp className="h-4 w-4" /> 
    },
    { 
      label: 'Live Products', 
      value: listings?.filter(l => l.status === 'Published').length || '12', 
      trend: null, 
      icon: <PackageCheck className="h-4 w-4" /> 
    },
    { 
      label: 'Profile Views', 
      value: '1,240', 
      trend: '+5.2%', 
      icon: <Eye className="h-4 w-4" /> 
    },
    { 
      label: 'Marketplace Reach', 
      value: 'Global', 
      trend: null, 
      icon: <Globe className="h-4 w-4" /> 
    },
  ];

  const handleMarketingGen = async (product: any) => {
    setIsMarketingLoading(true);
    setMarketingProduct(product);
    try {
      const result = await generateMarketingContent({
        productName: product.productName,
        craftType: product.craftType,
        region: product.region,
        description: product.description,
      });
      setMarketingResult(result);
    } catch (error) {
      toast({ title: "Marketing Generator failed", variant: "destructive" });
    } finally {
      setIsMarketingLoading(false);
    }
  };

  const handleWhatsAppShare = () => {
    if (!marketingResult || !marketingProduct || typeof window === 'undefined') return;

    const productUrl = `${window.location.origin}/product/${marketingProduct.id}`;
    const message = [
      marketingResult.whatsapp,
      '',
      `View this product: ${productUrl}`,
      '',
      marketingResult.hashtags.join(' '),
    ].join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (productId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'products', productId));
      toast({ title: "Listing deleted" });
    } catch (error) {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const displayName = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Artisan';

  return (
    <div className="min-h-screen flex flex-col paper-texture">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 flex-grow">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-headline font-bold">Artisan Hub</h1>
            <p className="text-muted-foreground">
              Welcome back, <span className="text-primary font-bold">{displayName}</span>. Here's your shop performance.
            </p>
          </div>
          <Link href="/dashboard/upload">
            <Button className="rounded-full gap-2 px-6 h-12 shadow-lg font-bold">
              <Plus className="h-5 w-5" />
              Add New Craft
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((stat, i) => (
            <Card key={i} className="border-none shadow-sm rounded-[24px] overflow-hidden bg-white">
              <CardContent className="p-4 md:p-5">
                <div className="flex justify-between items-start mb-2">
                  <div className="bg-primary/5 p-1.5 rounded-lg text-primary">
                    {stat.icon}
                  </div>
                  {stat.trend && (
                    <Badge variant="secondary" className="bg-green-50 text-green-600 hover:bg-green-50 border-none px-1.5 py-0 text-[9px] font-bold">
                      {stat.trend}
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-lg md:text-xl font-bold text-foreground flex items-baseline leading-none font-sans">
                    {stat.isCurrency && (
                      <span className="text-base mr-0.5 text-primary font-sans">₹</span>
                    )}
                    {stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-headline font-bold text-primary">Your Listings</h2>
              <Badge variant="outline" className="border-primary/20 rounded-full">{listings?.length || 0} Products</Badge>
            </div>
            
            <div className="bg-white rounded-[32px] shadow-sm overflow-hidden min-h-[200px]">
              {isListingsLoading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : listings && listings.length > 0 ? (
                <div className="divide-y">
                  {listings.map(item => (
                    <div key={item.id} className="p-4 flex items-center justify-between hover:bg-secondary/5 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="relative h-14 w-14 rounded-xl overflow-hidden bg-secondary">
                          {item.images?.[0] && <Image src={item.images[0]} alt={item.productName} fill className="object-cover" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-base font-headline leading-tight">{item.productName}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge className="text-[9px] px-1.5 py-0 rounded-full h-4">{item.status}</Badge>
                            <span className="text-[11px] text-muted-foreground font-medium font-sans">
                              <span className="mr-0.5 text-primary font-sans">₹</span>{item.price} • {item.availableQuantity} in stock
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Link href={`/dashboard/upload?edit=${item.id}`}>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5" onClick={() => handleMarketingGen(item)}>
                              <Share2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl rounded-[40px] border-none shadow-2xl">
                            <DialogHeader>
                              <DialogTitle className="text-2xl font-headline text-primary">Social Media Generator</DialogTitle>
                              <DialogDescription>AI-crafted posts for {item.productName}.</DialogDescription>
                            </DialogHeader>
                            {isMarketingLoading ? (
                              <div className="flex flex-col items-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                                <p className="font-bold text-primary">Crafting content...</p>
                              </div>
                            ) : marketingResult && (
                              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                                <div className="bg-secondary/20 p-6 rounded-3xl border border-primary/10">
                                  <h4 className="font-bold mb-3 text-primary flex items-center gap-2 uppercase tracking-widest text-xs">Instagram</h4>
                                  <p className="text-sm italic mb-4 leading-relaxed">{marketingResult.instagram}</p>
                                  <div className="flex flex-wrap gap-2">
                                    {marketingResult.hashtags.map((tag: string) => (
                                      <Badge key={tag} variant="secondary" className="rounded-full bg-white/50">{tag}</Badge>
                                    ))}
                                  </div>
                                </div>
                                <div className="bg-secondary/20 p-6 rounded-3xl border border-primary/10">
                                  <h4 className="font-bold mb-2 text-primary uppercase tracking-widest text-xs">WhatsApp</h4>
                                  <p className="text-sm leading-relaxed">{marketingResult.whatsapp}</p>
                                  <Button className="mt-4 rounded-full gap-2" onClick={handleWhatsAppShare}>
                                    <Share2 className="h-4 w-4" />
                                    Share on WhatsApp
                                  </Button>
                                </div>
                                <div className="bg-primary/5 p-4 rounded-2xl">
                                  <p className="text-xs font-bold text-primary mb-1 uppercase tracking-widest">Promo Line</p>
                                  <p className="text-sm font-medium">"{marketingResult.promoLine}"</p>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="bg-secondary/30 p-8 rounded-full mb-6">
                    <Package className="h-12 w-12 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-xl font-headline font-bold mb-2">No Crafts Yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-xs">Your digital gallery is empty. Start by adding your first handcrafted masterpiece.</p>
                  <Link href="/dashboard/upload">
                    <Button className="rounded-full px-8">Create Your First Listing</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-headline font-bold text-primary">Seller Tools</h2>
            <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-white p-8">
              <h3 className="font-bold font-headline text-lg mb-4 text-foreground">AI Power-ups</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-bold text-foreground block mb-0.5">AI Product Listing Generator</span>
                    Instantly create professional product descriptions and SEO tags.
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-bold text-foreground block mb-0.5">Craft Storytelling</span>
                    Fact-based storytelling to ensure cultural authenticity.
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-bold text-foreground block mb-0.5">Smart Pricing</span>
                    Get competitive range guidance based on Indian handicraft market data.
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Globe className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-bold text-foreground block mb-0.5">Global Reach</span>
                    Instantly translate your listings to reach buyers in multiple regional languages.
                  </p>
                </div>
              </div>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full rounded-full mt-8 h-12 border-primary/20 hover:bg-primary/5 text-primary">View Seller Guide</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl rounded-[40px] border-none shadow-2xl p-10">
                  <DialogHeader>
                    <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                      <BookOpen className="h-6 w-6 text-primary" />
                    </div>
                    <DialogTitle className="text-3xl font-headline text-primary">Artisan Success Guide</DialogTitle>
                    <DialogDescription className="text-lg">Master the Virasya platform and reach global buyers.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 mt-6 max-h-[60vh] overflow-y-auto pr-2">
                    <div className="bg-secondary/20 p-6 rounded-3xl border border-primary/10">
                      <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                        <Sparkles className="h-5 w-5" /> 1. AI Product Listing Generator
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Save time and attract more buyers with professional, SEO-optimized titles and descriptions. Our AI analyzes your craft's features to create compelling copy that ranks high in searches.
                      </p>
                    </div>
                    <div className="bg-secondary/20 p-6 rounded-3xl border border-primary/10">
                      <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                        <BookOpen className="h-5 w-5" /> 2. Craft Storytelling
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Authenticity is your superpower. Our AI uses cultural heritage data and your specific techniques to weave a factual, engaging story that connects buyers to the soul of your craft.
                      </p>
                    </div>
                    <div className="bg-secondary/20 p-6 rounded-3xl border border-primary/10">
                      <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" /> 3. Smart Pricing
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Price your crafts with confidence. The AI Price Advisor considers labor hours, material costs, and market rarity to suggest a fair, competitive price range for the global market.
                      </p>
                    </div>
                    <div className="bg-secondary/20 p-6 rounded-3xl border border-primary/10">
                      <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                        <Megaphone className="h-5 w-5" /> 4. Marketing & Social Media
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Boost your shop's visibility effortlessly. Instantly generate punchy, professional posts for Instagram and WhatsApp to share your masterpieces with the world.
                      </p>
                    </div>
                    <div className="bg-secondary/20 p-6 rounded-3xl border border-primary/10">
                      <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                        <Globe className="h-5 w-5" /> 5. Reach Global Markets
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Break language barriers. Instantly translate your listings into multiple regional and international languages to connect with buyers regardless of where they are.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
