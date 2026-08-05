import type { Metadata } from "next";
import { fetchMenu } from "@/lib/catalog";
import { isAlaCarteEnabled } from "@workspace/menu-catalog";
import { DishCard } from "@/components/DishCard";

export const metadata: Metadata = {
  title: "Menu | Tanmatra",
  description: "Order RD-designed, verified-macro dishes for delivery today.",
};

export default async function MenuPage() {
  const { dishes } = await fetchMenu();
  const orderable = dishes.filter(isAlaCarteEnabled);

  // Group dishes for the horizontal snap rails as per 5.2 Spec
  const highProtein = orderable.filter(d => d.macros.protein > 30).slice(0, 5);
  const lowGi = orderable.filter(d => d.glycaemicIndex === "low").slice(0, 5);
  const featured = orderable.slice(0, 5); // Fallback for demonstration

  return (
    <div className="min-h-dvh bg-surface-canvas pb-24">
      {/* 1. Compact delivery header is handled by GlobalLayout/Header component */}

      <div className="sticky top-0 z-20 bg-surface-canvas/95 backdrop-blur-md pt-4 pb-2 px-gutter border-b border-line">
        {/* 2. Search field */}
        <div className="relative mb-4">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Search meals, ingredients, goals" 
            className="w-full bg-surface border border-line rounded-full py-3 pl-12 pr-4 text-body-md text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {/* 4. Sticky horizontal category rail & 3. Frosted filter control */}
        <div className="flex items-center gap-3">
          <button className="flex-none p-2 rounded-full border border-line bg-surface-raised flex items-center justify-center hover:bg-surface-container active:scale-95 transition-all">
            <span className="material-symbols-outlined text-ink-primary text-[20px]">tune</span>
          </button>
          
          <div className="flex gap-2 overflow-x-auto no-scrollbar mask-edge-right pr-4">
            {['All', 'Bowls', 'Wraps', 'Breakfast', 'High Protein', 'Low GI', 'Snacks', 'Drinks'].map((category, i) => (
              <button 
                key={category} 
                className={`flex-none px-5 py-2 rounded-full font-label-caps text-[11px] tracking-widest uppercase transition-colors ${
                  i === 0 
                    ? "bg-ink-primary text-surface-canvas" 
                    : "border border-line bg-surface text-ink-secondary hover:text-ink-primary"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-10 pt-6">
        {/* 5. Multiple horizontal snap rails instead of one vertical mega-grid */}
        
        <MenuSnapRail title="Featured today" dishes={featured} />
        <MenuSnapRail title="High protein" dishes={highProtein} />
        <MenuSnapRail title="Low-GI meals" dishes={lowGi} />
        <MenuSnapRail title="Comfort bowls" dishes={featured.slice().reverse()} />
      </div>
    </div>
  );
}

// 6. Dish cards implementation inside the horizontal snap rail
function MenuSnapRail({ title, dishes }: { title: string, dishes: typeof fetchMenu extends () => Promise<{dishes: infer D}> ? D : any }) {
  if (!dishes.length) return null;
  
  return (
    <section className="px-gutter">
      <div className="flex justify-between items-end mb-4">
        <h2 className="font-headline-md text-headline-md text-ink-primary">{title}</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto snap-x no-scrollbar pb-4 -mx-gutter px-gutter">
        {dishes.map((dish: any) => (
          <div key={dish.id} className="flex-none w-[280px] snap-start">
            <DishCard dish={dish} compact />
          </div>
        ))}
      </div>
    </section>
  );
}
