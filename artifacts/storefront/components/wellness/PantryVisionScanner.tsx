"use client";
import React, { useState } from 'react';
import { Camera, Sparkles, ShoppingCart, CheckCircle2, Utensils, RefreshCw, ChefHat } from 'lucide-react';
import { scanPantryVision, type PantryScanResult, type SuggestedAddOnProduct } from '@/lib/wellnessApi';
import { addLine } from '@/lib/cartStore';
import { useCart } from '@/components/cart/CartProvider';

export const PantryVisionScanner: React.FC = () => {
  const { cart, setCart } = useCart();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<PantryScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setScanning(true);
    setError(null);

    try {
      const text = await file.text().catch(() => "");
      const res = await scanPantryVision(text);
      if (res.scanResult) {
        setResult(res.scanResult);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to analyze fridge image. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  // These suggestions are catalogue dishes (see pantryVisionScanner.ts on the
  // server), not a subscription add-on — same shape CustomBuildHub's cart
  // button already uses, so this mirrors that pattern rather than inventing one.
  const handleAddToCart = (addon: SuggestedAddOnProduct) => {
    setCart(
      addLine(cart, {
        dishId: addon.id,
        kind: "dish",
        slug: addon.slug,
        name: addon.name,
        pricePaise: addon.pricePaise,
      }),
    );
    setAddedIds((prev) => new Set(prev).add(addon.id));
  };

  return (
    <div className="space-y-6">
      {/* Upload/Camera Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white font-heading">Pantry & Refrigerator Vision Scanner</h3>
            <p className="text-xs text-slate-500 font-medium">
              Snap a photo of your fridge or pantry to detect existing ingredients and unlock Tanmatra add-on recommendations.
            </p>
          </div>
        </div>

        <label className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-amber-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-950/50">
          <Camera className="w-10 h-10 text-amber-500 mb-2" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {imageFile ? imageFile.name : "Capture or upload fridge photo"}
          </span>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Identifies vegetables, proteins, dairy & recommends complementary meal kits</span>
          <input type="file" accept="image/*" onChange={handleScan} className="hidden" />
        </label>

        {scanning && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-center gap-3 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
            <span>Gemini Multimodal AI Scanning Refrigerator Ingredients...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
            {error}
          </div>
        )}
      </div>

      {/* Vision AI Scan Results */}
      {result && (
        <div className="space-y-6">
          {/* Detected Ingredients */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Vision AI Detected Ingredients
            </h4>
            <div className="flex flex-wrap gap-2">
              {result.detectedIngredients.map((item, idx) => (
                <div key={idx} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                  <span>{item.name}</span>
                  <span className="text-[10px] text-amber-500 font-extrabold">{Math.round(item.confidenceScore * 100)}% Match</span>
                </div>
              ))}
            </div>
          </div>

          {/* Suggested Tanmatra Add-Ons */}
          <div className="space-y-3">
            <h4 className="text-lg font-black text-slate-900 dark:text-white font-heading flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" /> Complementary Tanmatra Add-On Products
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.suggestedTanmatraAddOns.map((addon) => (
                <div key={addon.id} className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm font-black text-slate-900 dark:text-white font-heading">{addon.name}</strong>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">₹{Math.round(addon.pricePaise / 100)}</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">{addon.rationale}</p>
                  <button
                    type="button"
                    onClick={() => handleAddToCart(addon)}
                    disabled={addedIds.has(addon.id)}
                    className="w-full py-2 rounded-xl bg-sky-900 hover:bg-sky-950 disabled:opacity-70 disabled:hover:bg-sky-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    {addedIds.has(addon.id) ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Added to cart</span>
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Add to cart</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Instant Recipe Ideas */}
          <div className="bg-gradient-to-r from-sky-900 to-slate-950 text-white rounded-3xl p-6 shadow-xl space-y-4">
            <h4 className="text-base font-black font-heading flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-amber-400" /> Instant 15-Minute Recipe Ideas
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.suggestedRecipes.map((recipe, idx) => (
                <div key={idx} className="bg-white/10 p-4 rounded-2xl border border-white/15 backdrop-blur-md space-y-1.5">
                  <strong className="text-xs font-bold text-amber-300 block">{recipe.title} ({recipe.prepTimeMins} mins)</strong>
                  <p className="text-xs text-slate-300 leading-relaxed">{recipe.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
