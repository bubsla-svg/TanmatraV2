import { Outlet } from "react-router";

// Signals to root.tsx that this layout wants no chrome.
export const handle = { chrome: false } as const;

export default function CheckoutLayout() {
  return (
    <div className="min-h-dvh bg-[var(--color-nn-bg)] text-white">
      <Outlet />
    </div>
  );
}
