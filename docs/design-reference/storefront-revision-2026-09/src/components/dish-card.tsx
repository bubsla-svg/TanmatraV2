import { Heart, Leaf, Plus, Star } from 'lucide-react';
import { Link } from 'wouter';
import type { CSSProperties } from 'react';
import type { Dish } from '@/lib/catalog';
import { formatPrice } from '@/lib/catalog';
import { useStorefront } from '@/hooks/use-storefront';

export function DishArt({ dish, className = '' }: { dish: Dish; className?: string }) {
  return <div role="img" aria-label={`${dish.name} illustration`} data-testid={`img-dish-${dish.id}`} className={`dish-art relative overflow-hidden ${className}`} style={{ '--dish-color': dish.color, '--dish-wash': dish.wash } as CSSProperties}><span className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-sage px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-sage-ink"><Leaf size={11} /> Fresh today</span><span className="absolute bottom-4 left-4 z-10 font-data text-[9px] font-bold uppercase tracking-[.16em] text-primary/55">TNM / {dish.kitchen}</span></div>;
}

export function DishCard({ dish, index = 0 }: { dish: Dish; index?: number }) {
  const { favorites, toggleFavorite, addToCart } = useStorefront();
  const saved = favorites.includes(dish.slug);
  return <article data-testid={`card-dish-${dish.id}`} className={`animate-rise stagger-${Math.min(index + 1, 4)} group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]`}>
    <div className="relative">
      <Link href={`/dish/${dish.slug}`} data-testid={`link-dish-${dish.id}`}><DishArt dish={dish} className="aspect-[1.12] w-full transition-transform duration-500 group-hover:scale-[1.03]" /></Link>
      <button type="button" aria-label={saved ? `Remove ${dish.name} from favorites` : `Save ${dish.name} to favorites`} aria-pressed={saved} data-testid={`button-favorite-${dish.id}`} onClick={() => toggleFavorite(dish.slug)} className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-all ${saved ? 'border-accent bg-accent text-accent-foreground' : 'border-primary/10 bg-card/75 text-primary hover:bg-card'}`}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button>
      {dish.badge && <span className="absolute bottom-4 left-4 rounded-full bg-sage px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-sage-ink backdrop-blur-sm">{dish.badge}</span>}
    </div>
    <div className="flex flex-1 flex-col p-5">
      <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{dish.category}</span><span className="flex items-center gap-1 text-[11px] text-accent"><Star size={12} fill="currentColor" /> 4.8</span></div>
      <Link href={`/dish/${dish.slug}`} data-testid={`link-dish-name-${dish.id}`} className="font-display text-[22px] font-semibold leading-[1.1] text-primary hover:text-accent">{dish.name}</Link>
      <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{dish.description}</p>
      <div className="mt-5 flex items-end justify-between gap-3"><div><span data-testid={`text-price-${dish.id}`} className="font-data text-sm font-bold text-primary">{formatPrice(dish.price)}</span><span className="ml-1 text-xs text-muted-foreground">/ serving</span></div><button type="button" data-testid={`button-add-${dish.id}`} onClick={() => addToCart(dish)} className="flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground transition-transform hover:bg-accent hover:text-accent-foreground active:scale-95"><Plus size={15} /> Add</button></div>
    </div>
  </article>;
}