import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * App-wide network-status watcher. Surfaces a persistent "You're offline" toast
 * when the connection drops and a brief "Back online" confirmation when it
 * returns — so a mid-session WiFi drop degrades gracefully (money-path
 * resilience) instead of surfacing as opaque fetch failures or a blank screen.
 * Renders nothing.
 */
const OFFLINE_TOAST_ID = "tanmatra-offline";

export default function NetworkStatusToast() {
  const wasOffline = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const goOffline = () => {
      wasOffline.current = true;
      toast.error("You're offline", {
        id: OFFLINE_TOAST_ID,
        description: "Check your connection — your progress is saved.",
        duration: Infinity,
      });
    };
    const goOnline = () => {
      toast.dismiss(OFFLINE_TOAST_ID);
      if (wasOffline.current) {
        wasOffline.current = false;
        toast.success("Back online", { duration: 2500 });
      }
    };

    if (!navigator.onLine) goOffline();
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return null;
}
