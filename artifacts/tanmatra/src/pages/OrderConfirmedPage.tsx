import React from "react";
import { GlobalLayout } from "../components/Layouts";
import { ClinicalBadge } from "../components/Badges";
import { PrimaryCTA, SecondaryCTA } from "../components/CTA";

interface OrderConfirmedPageProps {
  orderId?: string;
  onNavigate: (route: string) => void;
}

export const OrderConfirmedPage: React.FC<OrderConfirmedPageProps> = ({
  orderId = "ord_8823719",
  onNavigate,
}) => {
  return (
    <GlobalLayout activeTab="account" currentRoute={`/order/confirmed/${orderId}`} onNavigate={onNavigate}>
      <div className="max-w-3xl mx-auto py-8 text-center space-y-6">
        {/* Success Icon */}
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto text-3xl shadow-xl shadow-emerald-500/10">
          ✓
        </div>

        <div>
          <ClinicalBadge label="Subscription Activated" variant="emerald" />
          <h1 className="text-3xl font-extrabold text-slate-100 mt-3 mb-2 tracking-tight">
            Order Confirmed & Plan Scheduled!
          </h1>
          <p className="text-xs text-slate-400">Order ID: <span className="font-mono text-slate-200">{orderId}</span></p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left space-y-4">
          <h3 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-3">Delivery & Schedule Summary</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="block text-slate-500">First Scheduled Dispatch</span>
              <span className="font-bold text-slate-200">Tomorrow • 12:00 PM - 1:00 PM</span>
            </div>
            <div>
              <span className="block text-slate-500">Subscription Status</span>
              <span className="font-bold text-emerald-400">Active (30-Day Glycemic Reset)</span>
            </div>
            <div>
              <span className="block text-slate-500">Delivery Address</span>
              <span className="font-bold text-slate-200">Koramangala 4th Block, Bengaluru</span>
            </div>
            <div>
              <span className="block text-slate-500">Change Cutoff Window</span>
              <span className="font-bold text-amber-400">10:00 PM daily for next day</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <PrimaryCTA onClick={() => onNavigate("/meal-planner")}>
            Manage Deliveries & Swaps
          </PrimaryCTA>
          <SecondaryCTA onClick={() => onNavigate("/account/subscriptions")}>
            View Active Subscriptions
          </SecondaryCTA>
        </div>
      </div>
    </GlobalLayout>
  );
};
