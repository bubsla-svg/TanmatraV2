"use client";

import { useRouter } from "next/navigation";

interface OrderConfirmedClientProps {
  orderId: string;
}

export default function OrderConfirmedClient({ orderId }: OrderConfirmedClientProps) {
  const router = useRouter();

  return (
    <div className="bg-background text-on-background font-body-base min-h-[max(884px,100dvh)] flex flex-col items-center py-12 px-mobile-margin md:py-24 overflow-x-hidden selection:bg-primary-container selection:text-ink-on-gold">
      <main className="w-full max-w-[440px] flex flex-col gap-10">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 w-full">
          <div className="w-1.5 h-1.5 rounded-full bg-primary-container/40"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-primary-container/40"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-primary-container/40"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-primary-container shadow-[0_0_12px_rgba(212,175,55,0.4)]"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-surface-variant"></div>
        </div>

        {/* Hero Status Section */}
        <section className="flex flex-col items-center text-center w-full gap-2 mt-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-sage-signal animate-[subtlePulse_2s_ease-in-out_infinite]"></div>
            <h1 className="font-headline-md text-[28px] text-sage-signal tracking-tight">Being fired in the kitchen</h1>
          </div>
          <div className="flex flex-col items-center mt-3 gap-1">
            <p className="font-clinical-data text-muted-steel tracking-wider uppercase">#{orderId}</p>
            <p className="font-clinical-data text-on-surface text-lg">Estimated arrival in 18 min</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full mt-8">
            <button className="flex-1 py-4 px-6 rounded-full bg-primary-container text-ink-on-gold font-label-small-caps uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all duration-300 ease-out flex items-center justify-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>near_me</span>
              Track live
            </button>
            <button 
              onClick={() => router.push("/")}
              className="flex-1 py-4 px-6 rounded-full border border-whisper-hairline bg-transparent text-off-white-ink font-label-small-caps uppercase tracking-widest hover:bg-surface-variant/30 active:scale-[0.98] transition-all duration-300 ease-out flex items-center justify-center gap-2"
            >
              Back to the menu
            </button>
          </div>
        </section>

        {/* Incentive/Notice Stack */}
        <section className="flex flex-col gap-2 w-full mt-2">
          <div className="bg-sage-signal/10 border border-sage-signal/20 rounded-2xl p-4 flex items-center gap-3 backdrop-blur-md">
            <span className="material-symbols-outlined text-sage-signal" style={{ fontSize: "20px" }}>check_circle</span>
            <p className="font-body-muted text-sage-signal">₹50 in credits were applied to this order</p>
          </div>
          <div className="bg-sage-signal/10 border border-sage-signal/20 rounded-2xl p-4 flex items-center gap-3 backdrop-blur-md">
            <span className="material-symbols-outlined text-sage-signal" style={{ fontSize: "20px" }}>autorenew</span>
            <p className="font-body-muted text-sage-signal">14-day trial creditback activated</p>
          </div>
          <div className="bg-graphite-surface border border-whisper-hairline rounded-2xl p-4 flex items-start gap-3 mt-1">
            <span className="material-symbols-outlined text-muted-steel shrink-0 mt-0.5" style={{ fontSize: "18px" }}>info</span>
            <p className="font-body-muted text-muted-steel text-xs leading-relaxed">Future orders will be automatically processed via your saved metabolic profile.</p>
          </div>
        </section>

        {/* Next Steps Section */}
        <section className="flex flex-col w-full mt-6">
          <div className="flex flex-col gap-1 mb-6 px-1">
            <p className="font-label-small-caps text-muted-steel tracking-widest uppercase text-[10px]">NEXT STEPS FOR YOUR JOURNEY</p>
            <h2 className="text-xl font-semibold text-on-surface tracking-tight">Maxing Out Your Results</h2>
          </div>

          <div className="flex flex-col gap-3">
            {/* Card 1 */}
            <div className="bg-graphite-surface border border-whisper-hairline rounded-3xl p-5 flex flex-col relative overflow-hidden group">
              <div className="absolute top-5 right-5 bg-surface-variant/50 px-2.5 py-1 rounded-full border border-whisper-hairline">
                <span className="font-label-small-caps text-on-surface text-[9px] uppercase tracking-wider">Included Free</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center mb-4 border border-whisper-hairline">
                <span className="material-symbols-outlined text-primary-container" style={{ fontSize: "20px" }}>stethoscope</span>
              </div>
              <h3 className="font-body-base font-semibold text-on-surface mb-1">Talk to a Dietitian</h3>
              <p className="font-body-muted text-muted-steel text-sm mb-5">15m metabolic sync with an RD</p>
              <button 
                onClick={() => router.push("/account/appointments")}
                className="self-start py-2.5 px-5 rounded-full border border-whisper-hairline bg-transparent text-off-white-ink font-label-small-caps uppercase tracking-widest text-[10px] hover:bg-surface-variant/40 active:scale-[0.98] transition-all cursor-pointer"
              >
                Book Session
              </button>
            </div>

            {/* Card 2 */}
            <div className="bg-graphite-surface border border-whisper-hairline rounded-3xl p-5 flex flex-col relative overflow-hidden group">
              <div className="absolute top-5 right-5 bg-surface-variant/50 px-2.5 py-1 rounded-full border border-whisper-hairline">
                <span className="font-label-small-caps text-on-surface text-[9px] uppercase tracking-wider">Community</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center mb-4 border border-whisper-hairline">
                <span className="material-symbols-outlined text-primary-container" style={{ fontSize: "20px" }}>groups</span>
              </div>
              <h3 className="font-body-base font-semibold text-on-surface mb-1">Join a Cohort Challenge</h3>
              <p className="font-body-muted text-muted-steel text-sm mb-5">Sync with 40 others starting today</p>
              <button 
                onClick={() => router.push("/challenges")}
                className="self-start py-2.5 px-5 rounded-full border border-whisper-hairline bg-transparent text-off-white-ink font-label-small-caps uppercase tracking-widest text-[10px] hover:bg-surface-variant/40 active:scale-[0.98] transition-all cursor-pointer"
              >
                View Challenges
              </button>
            </div>

            {/* Card 3: Optional Wearable Telemetry Sync */}
            <div className="bg-graphite-surface border border-whisper-hairline rounded-3xl p-5 flex flex-col relative overflow-hidden group">
              <div className="absolute top-5 right-5 bg-primary-container/10 px-2.5 py-1 rounded-full border border-primary-container/20">
                <span className="font-label-small-caps text-primary-container text-[9px] uppercase tracking-wider">Telemetry</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center mb-4 border border-whisper-hairline">
                <span className="material-symbols-outlined text-primary-container" style={{ fontSize: "20px" }}>watch</span>
              </div>
              <h3 className="font-body-base font-semibold text-on-surface mb-1">Connect Health Data</h3>
              <p className="font-body-muted text-muted-steel text-sm mb-5">Sync Apple Health or Health Connect to tune post-workout recovery meals</p>
              <button 
                onClick={() => router.push("/account/connections")}
                className="self-start py-2.5 px-5 rounded-full border border-whisper-hairline bg-transparent text-off-white-ink font-label-small-caps uppercase tracking-widest text-[10px] hover:bg-surface-variant/40 active:scale-[0.98] transition-all cursor-pointer"
              >
                Manage Sync
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
