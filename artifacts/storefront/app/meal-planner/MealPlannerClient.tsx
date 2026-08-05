"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MealPlannerClient() {
  const router = useRouter();

  return (
    <div className="bg-[#0A0A0A] text-[#F5F5F4] min-h-[max(884px,100dvh)] font-body-lg overflow-x-hidden">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 backdrop-blur-md bg-glass border-b border-hairline shadow-black/40 flex items-center justify-between px-gutter h-16 max-w-[1280px] mx-auto">
        <div className="flex items-center">
          <span 
            className="material-symbols-outlined text-primary cursor-pointer active:scale-[0.98] transition-transform duration-200"
            onClick={() => router.back()}
          >
            menu
          </span>
        </div>
        <h1 className="font-headline-md text-headline-md font-bold tracking-tight text-primary">METABOLIC OS</h1>
        <div className="flex items-center">
          <span className="material-symbols-outlined text-primary cursor-pointer active:scale-[0.98] transition-transform duration-200">
            shopping_bag
          </span>
        </div>
      </header>

      {/* Canvas */}
      <main className="pt-24 pb-48 max-w-lg mx-auto px-4">
        {/* Page Header */}
        <header className="mb-10">
          <span className="font-label-caps text-label-caps text-ink-secondary mb-2 block uppercase">PLANNING PHASE</span>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-semibold mb-2">Meal Planner</h1>
          <p className="text-ink-secondary font-body-sm leading-relaxed">Optimizing your metabolic window for the week of Oct 21.</p>
        </header>

        {/* Horizontal Week Strip */}
        <div className="sticky top-16 z-40 bg-canvas py-4 -mx-4 px-4 border-b border-hairline/10 mb-8 overflow-x-auto no-scrollbar flex gap-3">
          {/* Active Day */}
          <div className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-20 rounded-2xl bg-primary-container text-on-primary-container shadow-lg shadow-primary-container/20">
            <span className="font-clinical-data text-[18px] font-bold">21</span>
            <span className="font-clinical-data text-[10px] mt-1 tracking-widest">GYM</span>
          </div>

          {/* Inactive Days */}
          <div className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-20 rounded-2xl border border-hairline text-ink-secondary">
            <span className="font-clinical-data text-[18px]">22</span>
            <span className="font-clinical-data text-[10px] mt-1 tracking-widest opacity-40">REST</span>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-20 rounded-2xl border border-hairline text-ink-secondary">
            <span className="font-clinical-data text-[18px]">23</span>
            <span className="font-clinical-data text-[10px] mt-1 tracking-widest opacity-40">GYM</span>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-20 rounded-2xl border border-hairline text-ink-secondary">
            <span className="font-clinical-data text-[18px]">24</span>
            <span className="font-clinical-data text-[10px] mt-1 tracking-widest opacity-40">REST</span>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-20 rounded-2xl border border-hairline text-ink-secondary">
            <span className="font-clinical-data text-[18px]">25</span>
            <span className="font-clinical-data text-[10px] mt-1 tracking-widest opacity-40">HIIT</span>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-20 rounded-2xl border border-hairline text-ink-secondary">
            <span className="font-clinical-data text-[18px]">26</span>
            <span className="font-clinical-data text-[10px] mt-1 tracking-widest opacity-40">GYM</span>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-20 rounded-2xl border border-hairline text-ink-secondary">
            <span className="font-clinical-data text-[18px]">27</span>
            <span className="font-clinical-data text-[10px] mt-1 tracking-widest opacity-40">REST</span>
          </div>
        </div>

        {/* Vertical Day List */}
        <div className="space-y-6">
          {/* Oct 21 Card */}
          <div className="bg-surface border border-hairline rounded-[2rem] p-6 shadow-xl">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="font-headline-md text-ink-primary">Monday</h2>
                <p className="font-clinical-data text-xs text-ink-secondary uppercase tracking-widest">October 21, 2024</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-clinical-data text-[#7D9E7E] bg-[#7D9E7E]/10 border border-[#7D9E7E]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7D9E7E] animate-pulse"></span>
                  Apple Health Sync
                </span>
                <span className="material-symbols-outlined text-ink-secondary text-sm">calendar_today</span>
              </div>
            </div>

            {/* Signal-Driven Rationale Callout */}
            <div className="mb-6 p-3 bg-canvas border border-hairline rounded-2xl flex items-center justify-between gap-2 text-xs text-ink-secondary">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D4AF37] text-base">insights</span>
                <span><strong>Signal Rationale:</strong> GYM workout logged today. Ranked higher protein lunch &amp; dinner. Meals are never auto-mutated.</span>
              </div>
              <Link href="/account/connections" className="text-primary text-[10px] uppercase font-bold tracking-wider hover:underline shrink-0">
                Details
              </Link>
            </div>

            {/* Meal Slots */}
            <div className="space-y-8">
              {/* Breakfast */}
              <div className="flex gap-4 group">
                <img alt="Keto Cleanse Bowl" className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 shadow-md" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAavwOuqGZhe0wH0dDy1apxw_Qv7uNe1EpsFXwHTWC-lOIEGdQQIhMfNN39IK_HvkX3qpcadHkv6RWg-DCoqfnENfynoZXrc5CNBUfrDIkyn91jK0ns8BsvOJxI6ufPBubPmQg4kr8_ZhSPWRiOrKY1MmbDIpPG3Hh0dVhACC4qB-J4uiPRPFK7HFguckqc8vE2AI4wbYqhtfqvD6yg8U7kbJ6RQqouhslokhbuRVJTlKORdB8xqgRltLInfsWCToMctRnnTaPseDc" />
                <div className="flex-grow flex flex-col justify-center">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-body-lg font-medium text-ink-primary">Keto-Cleanse Bowl</h3>
                      <p className="font-clinical-data text-ink-secondary text-sm mt-1">450kcal <span className="mx-2 opacity-40">·</span> 32P</p>
                    </div>
                    <span className="font-clinical-data text-primary text-sm">₹1,450</span>
                  </div>
                  <button className="mt-2 self-start px-4 py-1.5 border border-hairline rounded-full text-primary font-label-caps text-[10px] uppercase tracking-widest active:scale-95 transition-all">Swap</button>
                </div>
              </div>

              {/* Lunch */}
              <div className="flex gap-4 group">
                <img alt="Grilled Salmon" className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 shadow-md" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAecv4MtFLrPd5UUalLgjtHnwuOdWPIPKLCcYgwCCojc_Ug3yBf_0iyGgj-2DL2rZ2HUKXWlzGlB67W9s6pjc5ww-N1NxKLpxzj3g53PsNcYJk8eYe8QXGfV3LW_dbWBJudc60si-Y2VpwwmzWRbp1Ppk6FqG2H8aruJxOX8TrbwO2Jo5_j96SPUXlk5jhVDDcIL94sr_RWNjP4BN20XzQNieqK3C0-Dlil_6CDoEPJQW7LX86A9ycmyZBuXiyH7BTR79USbShYT8M" />
                <div className="flex-grow flex flex-col justify-center">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-body-lg font-medium text-ink-primary">Grilled Salmon</h3>
                      <p className="font-clinical-data text-ink-secondary text-sm mt-1">510kcal <span className="mx-2 opacity-40">·</span> 42P</p>
                    </div>
                    <span className="font-clinical-data text-primary text-sm">₹1,850</span>
                  </div>
                  <button className="mt-2 self-start px-4 py-1.5 border border-hairline rounded-full text-primary font-label-caps text-[10px] uppercase tracking-widest active:scale-95 transition-all">Swap</button>
                </div>
              </div>

              {/* Dinner */}
              <div className="flex gap-4 group">
                <img alt="Beef Ragu" className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 shadow-md" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAq2YMCvN_p723tkd_aLEUDjCemvSaBvWUrg27SqZ7m11GekHbUaovaGh5XWT11CK3Ir1jW6kySRFfpAwXH07Ays_lp_jm631TcheMgN1zY5eEI6z2yxpcqMOynSO9o65YeyQ-QUUubyTNVLF3cwV_CSn3Vq71HHo5DF0Z7uh2wo9OyK4rmDy1ra-gzAPZuxUvi60SLIws1chMLFK-RpS70264Ifa2sSGpY-jXd_Pc3-zRP5QyQ28EXHOwxccQglGsbHoYnHfbBjSA" />
                <div className="flex-grow flex flex-col justify-center">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-body-lg font-medium text-ink-primary">Beef Ragù</h3>
                      <p className="font-clinical-data text-ink-secondary text-sm mt-1">640kcal <span className="mx-2 opacity-40">·</span> 48P</p>
                    </div>
                    <span className="font-clinical-data text-primary text-sm">₹1,600</span>
                  </div>
                  <button className="mt-2 self-start px-4 py-1.5 border border-hairline rounded-full text-primary font-label-caps text-[10px] uppercase tracking-widest active:scale-95 transition-all">Swap</button>
                </div>
              </div>
            </div>

            {/* Regenerate */}
            <button className="w-full mt-10 py-4 border border-hairline border-dashed rounded-2xl text-ink-secondary font-label-caps uppercase tracking-[0.2em] hover:bg-white/5 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Regenerate Day
            </button>
          </div>

          {/* Secondary/Placeholder Days */}
          <div className="bg-surface/40 border border-hairline border-dashed rounded-[2rem] p-6 opacity-60">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-headline-md text-ink-primary">Tuesday</h2>
                <p className="font-clinical-data text-xs text-ink-secondary uppercase tracking-widest">October 22, 2024</p>
              </div>
              <span className="material-symbols-outlined text-ink-secondary">lock</span>
            </div>
          </div>
        </div>
      </main>

      {/* Fixed Plan Bar */}
      <div className="fixed bottom-16 left-0 w-full z-40 px-4 pb-8 pt-4 bg-glass backdrop-blur-xl border-t border-hairline">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-clinical-data text-ink-primary text-lg font-bold">₹4,900 Total</span>
            <button className="text-ink-secondary text-xs font-label-caps uppercase tracking-wider text-left mt-1 hover:text-error transition-colors">Discard</button>
          </div>
          <button className="bg-primary-container text-on-primary-container px-8 py-4 rounded-full font-label-caps uppercase tracking-[0.1em] font-bold shadow-[0_10px_30px_rgba(212,175,55,0.3)] active:scale-95 transition-all">
            Accept &amp; schedule
          </button>
        </div>
      </div>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 w-full z-50 backdrop-blur-md bg-glass pb-safe border-t border-hairline shadow-black/40 flex justify-around items-center h-16 px-4">
        <Link className="flex flex-col items-center justify-center text-ink-secondary hover:text-primary/80 transition-all duration-200" href="#">
          <span className="material-symbols-outlined">analytics</span>
          <span className="font-label-caps text-[10px] mt-1">Dashboard</span>
        </Link>
        <Link className="flex flex-col items-center justify-center text-ink-secondary hover:text-primary/80 transition-all duration-200" href="#">
          <span className="material-symbols-outlined">restaurant_menu</span>
          <span className="font-label-caps text-[10px] mt-1">Menu</span>
        </Link>
        {/* Active Tab */}
        <Link className="flex flex-col items-center justify-center text-primary bg-primary-container/10 rounded-xl px-3 py-1 transition-all duration-200" href="/meal-planner">
          <span className="material-symbols-outlined">assignment_turned_in</span>
          <span className="font-label-caps text-[10px] mt-1">Plans</span>
        </Link>
        <Link className="flex flex-col items-center justify-center text-ink-secondary hover:text-primary/80 transition-all duration-200" href="/account">
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-caps text-[10px] mt-1">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
