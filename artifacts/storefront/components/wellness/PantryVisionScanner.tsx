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
      <div className="bg-surface rounded-2xl p-6 sm:p-8 border border-line space-y-4">
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <div className="w-10 h-10 rounded-2xl bg-gold/10 text-gold-text flex items-center justify-center font-bold">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold leading-tight text-primary">Pantry & Refrigerator Vision Scanner</h3>
            <p className="text-xs text-ink-muted font-medium">
              Snap a photo of your fridge or pantry to detect existing ingredients and unlock Tanmatra add-on recommendations.
            </p>
          </div>
        </div>

        <label className="border-2 border-dashed border-line-strong hover:border-gold rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-surface-subtle">
          <Camera className="w-10 h-10 text-gold-text mb-2" />
          <span className="text-xs font-bold text-ink">
            {imageFile ? imageFile.name : "Capture or upload fridge photo"}
          </span>
          <span className="text-2xs text-ink-faint font-medium mt-1">Identifies vegetables, proteins, dairy & recommends complementary meal kits</span>
          <input type="file" accept="image/*" onChange={handleScan} className="hidden" />
        </label>

        {scanning && (
          <div className="p-4 rounded-2xl bg-gold/10 border border-gold/20 text-gold-text text-xs font-bold flex items-center justify-center gap-3 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-gold-text" />
            <span>Gemini Multimodal AI Scanning Refrigerator Ingredients...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-xs font-bold">
            {error}
          </div>
        )}
      </div>

      {/* Vision AI Scan Results */}
      {result && (
        <div className="space-y-6">
          {/* Detected Ingredients */}
          <div className="bg-surface rounded-2xl p-6 border border-line space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sage-text" /> Vision AI Detected Ingredients
            </h4>
            <div className="flex flex-wrap gap-2">
              {result.detectedIngredients.map((item, idx) => (
                <div key={idx} className="px-3 py-1.5 rounded-xl bg-surface-raised text-ink text-xs font-bold flex items-center gap-2 border border-line">
                  <span>{item.name}</span>
                  <span className="text-2xs font-bold text-gold-text">{Math.round(item.confidenceScore * 100)}% Match</span>
                </div>
              ))}
            </div>
          </div>

          {/* Suggested Tanmatra Add-Ons */}
          <div className="space-y-3">
            <h4 className="font-display text-lg font-semibold leading-tight text-primary flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-gold-text" /> Complementary Tanmatra Add-On Products
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.suggestedTanmatraAddOns.map((addon) => (
                <div key={addon.id} className="bg-surface rounded-2xl p-5 border border-line space-y-3">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm font-display font-semibold text-primary">{addon.name}</strong>
                    <span className="text-xs font-data font-bold text-ink">₹{Math.round(addon.pricePaise / 100)}</span>
                  </div>
                  <p className="text-xs text-ink-muted font-medium leading-relaxed">{addon.rationale}</p>
                  <button
                    type="button"
                    onClick={() => handleAddToCart(addon)}
                    disabled={addedIds.has(addon.id)}
                    className="w-full py-2 rounded-xl bg-gold hover:brightness-110 disabled:opacity-70 disabled:hover:brightness-110 text-[var(--gold-ink)] text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
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
          <div className="rounded-2xl border border-gold/20 bg-gold/5 text-ink p-6 space-y-4">
            <h4 className="font-display text-base font-semibold leading-tight text-primary flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-gold-text" /> Instant 15-Minute Recipe Ideas
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.suggestedRecipes.map((recipe, idx) => (
                <div key={idx} className="bg-surface-raised p-4 rounded-2xl border border-line space-y-1.5">
                  <strong className="text-xs font-semibold text-primary block">{recipe.title} ({recipe.prepTimeMins} mins)</strong>
                  <p className="text-xs text-ink-faint leading-relaxed">{recipe.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
