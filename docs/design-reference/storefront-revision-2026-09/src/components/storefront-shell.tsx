import { Heart, Home, Menu, Moon, Search, ShoppingBag, Sparkles, Sun, UtensilsCrossed, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useStorefront } from '@/hooks/use-storefront';

const nav = [
  { href: '/menu', label: 'Menu' },
  { href: '/plans', label: 'Plans' },
  { href: '/about', label: 'Our method' },
];

export function StorefrontShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = window.localStorage.getItem('tanmatra-theme');
      return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });
  const { cartCount, favorites, notice } = useStorefront();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      window.localStorage.setItem('tanmatra-theme', darkMode ? 'dark' : 'light');
    } catch {
      // Theme still works when storage is unavailable.
    }
  }, [darkMode]);

  return (
    <div className="grain min-h-[100dvh]">
      <div className="bg-primary px-4 py-2 text-center text-[11px] font-semibold tracking-[.14em] text-primary-foreground">
        NOW SERVING NOIDA · NEXT-DAY DELIVERY ON ORDERS BEFORE 8 PM
      </div>
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between gap-5 px-5 sm:px-8">
          <Link href="/" className="group flex shrink-0 items-center gap-3" data-testid="link-home">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:rotate-12">
              <span className="font-display text-2xl leading-none">त</span>
            </span>
            <span className="font-display text-[27px] font-semibold tracking-[-.04em]">Tanmatra</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
            {nav.map((item) => <Link key={item.href} href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(' ', '-')}`} className={`relative py-2 text-sm font-semibold transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:bg-accent after:transition-all ${location === item.href ? 'text-primary after:w-full' : 'text-muted-foreground after:w-0 hover:text-primary hover:after:w-full'}`}>{item.label}</Link>)}
          </nav>
          <div className="flex items-center gap-1">
            <Link href="/menu" aria-label="Search menu" data-testid="link-search" className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"><Search size={19} strokeWidth={1.8} /></Link>
            <Link href="/menu?favorites=true" aria-label={`Favorites, ${favorites.length} saved`} data-testid="link-favorites" className="relative hidden h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-primary sm:flex"><Heart size={19} strokeWidth={1.8} /><span className="sr-only">Favorites</span>{favorites.length > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">{favorites.length}</span>}</Link>
            <Link href="/cart" aria-label={`Cart, ${cartCount} items`} data-testid="link-cart" className="relative flex h-11 items-center gap-2 rounded-full px-3 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"><ShoppingBag size={19} strokeWidth={1.8} /><span className="hidden text-sm font-semibold sm:inline">Bag</span>{cartCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{cartCount}</span>}</Link>
            <button type="button" aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'} data-testid="button-theme-toggle" onClick={() => setDarkMode((current) => !current)} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-primary">{darkMode ? <Sun size={19} strokeWidth={1.8} /> : <Moon size={19} strokeWidth={1.8} />}</button>
            <button type="button" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} data-testid="button-mobile-nav" onClick={() => setMobileOpen(!mobileOpen)} className="ml-1 flex h-11 w-11 items-center justify-center rounded-full border border-border text-primary md:hidden">{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button>
          </div>
        </div>
        {mobileOpen && <nav className="border-t border-border bg-background px-5 py-4 md:hidden" aria-label="Mobile navigation">
          <div className="grid grid-cols-3 gap-2">
            {[...nav, { href: '/about', label: 'About' }].slice(0, 3).map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} data-testid={`link-mobile-${item.label.toLowerCase().replace(' ', '-')}`} className="rounded-xl bg-secondary px-3 py-3 text-center text-sm font-semibold text-primary">{item.label}</Link>)}
          </div>
          <Link href="/cart" onClick={() => setMobileOpen(false)} data-testid="link-mobile-cart" className="mt-2 flex items-center justify-center rounded-xl border border-border px-3 py-3 text-sm font-semibold text-primary">View your bag · {cartCount} items</Link>
        </nav>}
      </header>
      <main>{children}</main>
      <footer className="mt-20 border-t border-border bg-primary px-5 py-14 text-primary-foreground sm:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div><div className="font-display text-4xl">Food with a point of view.</div><p className="mt-3 max-w-sm text-sm leading-6 text-primary-foreground/70">Meals designed with the same care as your health goals. Fresh from our Noida kitchen.</p></div>
          <div><p className="mb-4 text-xs font-bold uppercase tracking-[.16em] text-accent">Explore</p><div className="flex flex-col items-start gap-3 text-sm text-primary-foreground/75"><Link href="/menu" data-testid="footer-link-menu" className="hover:text-primary-foreground">Today’s menu</Link><Link href="/plans" data-testid="footer-link-plans" className="hover:text-primary-foreground">Find your plan</Link><Link href="/about" data-testid="footer-link-about" className="hover:text-primary-foreground">Our method</Link></div></div>
          <div><p className="mb-4 text-xs font-bold uppercase tracking-[.16em] text-accent">The fine print</p><p className="text-sm leading-6 text-primary-foreground/65">FSSAI registered kitchen<br />Delivery across Noida<br />hello@tanmatra.in</p></div>
        </div>
        <div className="mx-auto mt-12 max-w-[1240px] border-t border-primary-foreground/15 pt-5 text-xs text-primary-foreground/50">© 2024 Tanmatra Foods · Eat in your element.</div>
      </footer>
      <MobileNav location={location} />
      {notice && <div role="status" data-testid="status-cart-notice" className="fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-lift)] animate-rise"><ShoppingBag size={16} />{notice}</div>}
    </div>
  );
}

function MobileNav({ location }: { location: string }) {
  const tabs = [{ href: '/', label: 'Home', icon: Home }, { href: '/menu', label: 'Menu', icon: UtensilsCrossed }, { href: '/plans', label: 'Plans', icon: Sparkles }, { href: '/cart', label: 'Bag', icon: ShoppingBag }];
  return <nav className="fixed inset-x-3 bottom-3 z-40 flex h-16 items-center justify-around rounded-2xl border border-border bg-card/95 px-2 shadow-[var(--shadow-lift)] backdrop-blur-xl md:hidden" aria-label="Quick navigation">{tabs.map((tab) => { const Icon = tab.icon; return <Link key={tab.href} href={tab.href} data-testid={`mobile-tab-${tab.label.toLowerCase()}`} className={`flex h-12 w-16 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${location === tab.href ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><Icon size={16} strokeWidth={1.8} />{tab.label}</Link>; })}</nav>;
}