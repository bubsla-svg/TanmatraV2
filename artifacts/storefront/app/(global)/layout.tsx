import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { MiniCartBar } from "@/components/cart/MiniCartBar";

/**
 * GlobalLayout — the browsing/discovery/account shell (P0 §9).
 *
 * Which chrome a route gets is a property of where its file lives: every
 * page under app/(global)/ renders the full consumer chrome — Header,
 * MiniCartBar, Footer, four-tab MobileBottomNav. High-intent flows live in
 * app/(focus)/ (no chrome), partner acquisition in app/(b2b)/ (B2B header).
 * This replaces the three usePathname() gates that used to subtract chrome
 * from one shared root tree — see docs/architecture/layout-contracts.md for
 * why that mechanism was the P0 NO-GO trigger.
 *
 * The bottom padding on <main> clears the mobile bottom nav (64px) PLUS
 * MiniCartBar/DishBuyBar (~69px when the cart is non-empty), with room to
 * spare, plus the safe-area inset — it used to live on <body> guarded by a
 * runtime pathname script; now only this shell pays it, structurally.
 */
export default function GlobalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main
        id="main"
        className="pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-0"
      >
        {children}
      </main>
      {/* §4.1/§4.3: persistent mini-cart bar once the cart is non-empty. */}
      <MiniCartBar />
      <Footer />
      <MobileBottomNav />
    </>
  );
}
