import React from "react";
import { GlobalLayout } from "../components/Layouts";
import { SafeImage } from "../components/SafeImage";
import { PriceDisplay } from "../components/PriceDisplay";
import { ClinicalBadge } from "../components/Badges";
import { PrimaryCTA } from "../components/CTA";

interface MarketplacePageProps {
  onNavigate: (route: string) => void;
}

const MARKETPLACE_ITEMS = [
  {
    id: "mkt_1",
    title: "Clinical Digestive Enzyme Complex",
    category: "Supplements",
    pricePaise: 149900, // Rs 1,499
    imageUrl: "https://picsum.photos/seed/enzymes/600/600",
    badge: "RD Approved",
  },
  {
    id: "mkt_2",
    title: "Cold-Pressed Organic Golden Turmeric Oil",
    category: "Therapeutic Pantry",
    pricePaise: 89900, // Rs 899
    imageUrl: "https://picsum.photos/seed/oil/600/600",
    badge: "100% Organic",
  },
  {
    id: "mkt_3",
    title: "Sprouted Tricolor Quinoa (1kg)",
    category: "Therapeutic Pantry",
    pricePaise: 49900, // Rs 499
    imageUrl: "https://picsum.photos/seed/quinoa-raw/600/600",
    badge: "Low GI",
  }
];

export const MarketplacePage: React.FC<MarketplacePageProps> = ({ onNavigate }) => {
  return (
    <GlobalLayout activeTab="menu" currentRoute="/marketplace" onNavigate={onNavigate}>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Therapeutic Marketplace</h1>
        <p className="text-xs text-slate-400 mt-1">Clinical supplements, cold-pressed oils, and functional pantry staples</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MARKETPLACE_ITEMS.map((item) => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors">
            <div>
              <SafeImage src={item.imageUrl} alt={item.title} aspectRatio="1/1" className="mb-4" />
              <ClinicalBadge label={item.badge} variant="gold" />
              <h3 className="text-base font-bold text-slate-100 mt-2 mb-1">{item.title}</h3>
              <p className="text-xs text-slate-400 mb-3">{item.category}</p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
              <PriceDisplay pricePaise={item.pricePaise} size="md" />
              <PrimaryCTA className="!px-4 !py-2 text-xs">
                + Add
              </PrimaryCTA>
            </div>
          </div>
        ))}
      </div>
    </GlobalLayout>
  );
};
