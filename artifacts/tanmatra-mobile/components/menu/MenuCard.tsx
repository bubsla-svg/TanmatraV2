import React, {useState} from 'react';

export interface MenuCardProps {
  id: string;
  name: string;
  price: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  description: string;
  imageUrl: string;
  protocol: 'Wellness' | 'Performance' | 'Clinical';
  tags: string;
}

export const MenuCard: React.FC<MenuCardProps> = ({
  name,
  price,
  calories,
  protein,
  carbs,
  fat,
  description,
  imageUrl,
  protocol,
}) => {
  const [purchaseTier, setPurchaseTier] = useState<
    'single' | 'trial' | 'weekly'
  >('single');
  const [isAdded, setIsAdded] = useState(false);

  // Apply D2C first-order discount metrics natively
  const discountedTrialPrice = Math.round(price * 3 * 0.75); // 25% Off trial subscription
  const weeklyPlanPrice =
    protocol === 'Performance' ? 7490 : protocol === 'Clinical' ? 5990 : 5490; // Weekly subscription tiers

  const handleAddToCart = () => {
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
    }, 2000);
  };

  return (
    <div className="mx-4 my-4 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col">
      {/* Header Image and RD Advisory Board Trust Seal (CRO-06) */}
      <div className="relative h-48 w-full bg-slate-100">
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 flex items-center space-x-1 shadow-lg">
          <svg
            className="w-3.5 h-3.5 text-emerald-400"
            fill="currentColor"
            viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M2.166 4.9L10.9l7.834 4a2 2 0 011.166 1.8v5.6c0 4.14-3.36 7.5-7.5 7.5a7.48 7.48 0 01-7.5-7.5v-5.6c0-.72.466-1.36 1.166-1.8zM9 9a1 1 0 000 2h2a1 1 0 100-2H9z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-[9px] text-white font-black tracking-wider uppercase">
            RD Advisory Board Verified
          </p>
        </div>

        {/* Dynamic Protocol Badge */}
        <div className="absolute bottom-3 left-3 flex space-x-1.5">
          <span
            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider shadow-sm text-white ${
              protocol === 'Wellness'
                ? 'bg-emerald-500'
                : protocol === 'Performance'
                  ? 'bg-orange-500'
                  : 'bg-blue-500'
            }`}>
            {protocol} Protocol
          </span>
        </div>
      </div>

      <div className="p-4 flex-1">
        {/* Product Info */}
        <div className="flex justify-between items-start mb-1.5">
          <h3 className="text-sm font-extrabold text-slate-900 pr-4 leading-snug">
            {name}
          </h3>
          <span className="text-sm font-black text-slate-900 whitespace-nowrap">
            ₹{price}
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mb-3">
          {description}
        </p>

        {/* Color-Coded Macronutrient Pills (CRO-04 overriding numeric cognitive density) */}
        <div className="grid grid-cols-4 gap-1.5 py-2 px-2.5 bg-slate-50 rounded-xl mb-4 border border-slate-100/80 shadow-inner">
          <div className="text-center">
            <p className="text-[8px] text-slate-400 font-bold uppercase">
              Calories
            </p>
            <p className="text-xs font-black text-slate-800">{calories} kcal</p>
          </div>
          <div className="text-center border-l border-slate-200">
            <p className="text-[8px] text-emerald-600 font-bold uppercase">
              Protein
            </p>
            <p className="text-xs font-black text-emerald-700">{protein}g</p>
          </div>
          <div className="text-center border-l border-slate-200">
            <p className="text-[8px] text-orange-600 font-bold uppercase">
              Carbs
            </p>
            <p className="text-xs font-black text-orange-700">{carbs}g</p>
          </div>
          <div className="text-center border-l border-slate-200">
            <p className="text-[8px] text-blue-600 font-bold uppercase">Fat</p>
            <p className="text-xs font-black text-blue-700">{fat}g</p>
          </div>
        </div>

        {/* CRO-05: Multi-Tier Purchase Selection to maximize Average Order Value */}
        <div className="space-y-2.5 mb-4 border-t border-b border-slate-100 py-3.5">
          <p className="text-[10px] font-black tracking-wider text-slate-500 uppercase block">
            SELECT PROGRAM PREFERENCE
          </p>

          <div className="space-y-2">
            {/* Single Serving portion */}
            <button
              onClick={() => setPurchaseTier('single')}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-150 text-left ${
                purchaseTier === 'single'
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-100 bg-white hover:border-slate-200'
              }`}>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={purchaseTier === 'single'}
                  onChange={() => setPurchaseTier('single')}
                  className="accent-slate-900 h-4 w-4"
                />
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Single Portion Meal
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Includes baseline thermodynamic profile
                  </p>
                </div>
              </div>
              <span className="text-xs font-extrabold text-slate-800">
                ₹{price}
              </span>
            </button>

            {/* 3-Day Trial Option */}
            <button
              onClick={() => setPurchaseTier('trial')}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-150 text-left ${
                purchaseTier === 'trial'
                  ? 'border-emerald-500 bg-emerald-50/10'
                  : 'border-slate-100 bg-white hover:border-slate-200'
              }`}>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={purchaseTier === 'trial'}
                  onChange={() => setPurchaseTier('trial')}
                  className="accent-emerald-500 h-4 w-4"
                />
                <div>
                  <div className="flex items-center space-x-1.5">
                    <p className="text-xs font-bold text-slate-800">
                      Start 3-Day Protocol Trial
                    </p>
                    <span className="bg-emerald-500 text-white text-[8px] px-1 py-0.2 rounded font-black uppercase">
                      25% OFF
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Perfect clinical testing window
                  </p>
                </div>
              </div>
              <span className="text-xs font-extrabold text-slate-800">
                ₹{discountedTrialPrice}
              </span>
            </button>

            {/* Weekly Recurring Program Subscription */}
            <button
              onClick={() => setPurchaseTier('weekly')}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-150 text-left ${
                purchaseTier === 'weekly'
                  ? 'border-indigo-500 bg-indigo-50/10'
                  : 'border-slate-100 bg-white hover:border-slate-200'
              }`}>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={purchaseTier === 'weekly'}
                  onChange={() => setPurchaseTier('weekly')}
                  className="accent-indigo-500 h-4 w-4"
                />
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Subscribe & Save (Weekly Protocol)
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Same-day delivery, swap dishes anytime
                  </p>
                </div>
              </div>
              <span className="text-xs font-extrabold text-slate-800">
                ₹{weeklyPlanPrice}/wk
              </span>
            </button>
          </div>
        </div>

        {/* CTA Button Action */}
        <div className="space-y-2">
          <button
            onClick={handleAddToCart}
            className={`w-full py-3.5 rounded-xl text-xs font-black tracking-wider transition-all duration-150 flex items-center justify-center shadow-lg ${
              isAdded
                ? 'bg-emerald-500 text-white shadow-emerald-500/10'
                : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/10'
            }`}>
            {isAdded ? (
              <span className="flex items-center justify-center space-x-1.5 animate-bounce">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>SUCCESSFULLY ADDED TO CART!</span>
              </span>
            ) : (
              <span>
                {purchaseTier === 'single' &&
                  `ADD PORTION MEAL TO CART  ·  ₹${price}`}
                {purchaseTier === 'trial' &&
                  `ACTIVATE 3-DAY PROTOCOL TRIAL  ·  ₹${discountedTrialPrice}`}
                {purchaseTier === 'weekly' &&
                  `INITIATE SUBSCRIPTION AUTO-PAY  ·  ₹${weeklyPlanPrice}`}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
