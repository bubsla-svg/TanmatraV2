import { Link } from "react-router";

export default function HomeFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="padx pt-10 pb-24 bg-black/40 border-t border-white/5 text-white/50 text-xs">
      <div className="flex flex-col gap-6">
        <div>
          <h4 className="text-sm font-bold text-white/80">Tanmatra</h4>
          <p className="fine mt-2 text-white/50 leading-relaxed">
            Dietitian-designed meals, delivered fresh. Calories, protein and allergens listed on every dish.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <span className="font-bold text-white/70">Programs</span>
            <Link to="/subscribe?plan=weight-loss-jumpstart" className="hover:text-[var(--tnm-action)] transition-colors">Weight Loss</Link>
            <Link to="/subscribe?plan=lean-muscle-builder" className="hover:text-[var(--tnm-action)] transition-colors">Lean Muscle</Link>
            <Link to="/subscribe?plan=pcos-balance" className="hover:text-[var(--tnm-action)] transition-colors">PCOS Balance</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-bold text-white/70">Company</span>
            <Link to="/about" className="hover:text-[var(--tnm-action)] transition-colors">Our RDs</Link>
            <Link to="/faq" className="hover:text-[var(--tnm-action)] transition-colors">FAQs</Link>
            <Link to="/privacy" className="hover:text-[var(--tnm-action)] transition-colors">Privacy Policy</Link>
          </div>
        </div>

        <hr className="border-white/5 my-2" />

        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-white/70">Entity Information</span>
            <p className="fine text-white/45">Tanmatra Nutrition Private Limited</p>
            <p className="fine text-white/45">Registered Office: Noida, National Capital Region (NCR), India</p>
          </div>

          <div className="flex flex-col gap-0.5 mt-1">
            <span className="font-semibold text-white/70">FSSAI Registration</span>
            <p className="fine text-white/45">License Number: 22725926001018 (Noida Sector 63 Kitchen)</p>
          </div>

          <div className="flex flex-col gap-0.5 mt-1">
            <span className="font-semibold text-white/70">Delivery Areas</span>
            <p className="fine text-white/45">Serving select sectors across Noida.</p>
          </div>
        </div>

        <div className="text-[10px] text-white/35 mt-4 flex items-center justify-between">
          <span>&copy; {currentYear} Tanmatra. All rights reserved.</span>
          <span>v1.2 Prod</span>
        </div>
      </div>
    </footer>
  );
}
