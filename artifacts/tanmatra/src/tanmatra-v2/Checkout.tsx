import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { API_BASE } from "@/lib/apiBase";
import { toast } from "sonner";
import { formatPrice } from "@/lib/api/adapter";
import { useCart, useCartStore, FREE_DELIVERY_THRESHOLD, DELIVERY_FEE } from "@/lib/cartContext";
import { GST_RATE_FOOD, GST_RATE_DELIVERY } from "@/lib/cartMath";
import { addonsApi } from "@/lib/marketplaceApi";
import { useOrders, generateOrderId, submitOrderIdempotencyKey } from "@/lib/ordersContext";
import { loyaltyApi } from "@/lib/loyaltyApi";
import { corporateApi, type CompanySubsidy } from "@/lib/corporateApi";
import { onDishImageError } from "@/lib/imgFallback";
import {
  fulfillmentApi,
  type DeliverySlotOption,
  type PickupLocationOption,
} from "@/lib/fulfillmentApi";
import { Sparkles, Leaf, Store, Truck, NotebookPen, ArrowRight, ChevronDown, Flame, Lock, MessageSquare } from "lucide-react";
import { track } from "@/lib/analytics";
import AddOnRail from "@/components/checkout/AddOnRail";
import CheckoutStepper, { type CheckoutStep } from "@/components/checkout/CheckoutStepper";
import { LocationPickerFlow } from "@/components/location/LocationPickerFlow";
import { useWizardState } from "@/lib/useWizardState";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  MapPin,
  CreditCard,
  Bike,
  Plus,
  Home,
  Building2,
  ShieldCheck,
  ClipboardList,
  Phone,
  AlertTriangle,
  CalendarClock,
  Tag,
  Building2 as Building2Icon,
  Gift,
  Ticket,
  Timer,
  Zap,
} from "lucide-react";

import { addressesApi, type UserAddress } from "@/lib/userAddressesApi";
import { auth, friendlyFirebaseError } from "../lib/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { usePreferences } from "@/lib/preferencesContext";
import { evaluateDishForPreferences } from "@/lib/preferencesMatch";
import { getDishById } from "@/lib/menuData";
import {
  dishMatchesDietOrder,
  parseSafetyBlock,
  useClinicalMode,
  type ServerSafetyConflict,
} from "@/lib/clinicalDiet";
import ConflictsPanel from "@/components/clinical/ConflictsPanel";
import { DELIVERY_ETA_TEXT } from "@/lib/deliveryPromise";
import { cadenceDiscountPct } from "@workspace/subscription-rules";
import { savePendingTransaction, removePendingTransaction, subscribeUpiRecovery } from "@/lib/paymentRecovery";

// Shapes of the phone-OTP auth responses used by the guest-checkout flow.
// Mirrors the interfaces in Login.tsx (kept local rather than shared to
// avoid coupling the two pages' ad-hoc fetch typing).
interface SendOtpResponse {
  ok: boolean;
  devCode?: string;
  error?: string;
}

interface VerifyOtpResponse {
  ok: boolean;
  user: { id: string; firstName: string | null } | null;
  error?: string;
}

// Wizard draft (playbook R1) — refresh/back-navigation no longer wipes the
// checkout form. ONLY benign, re-enterable form fields are persisted here;
// NEVER payment identifiers, OTP codes, or card/UPI data (none of those ever
// enter this object — Razorpay owns them end to end).
type CheckoutDraft = {
  /** Stable per-draft id attached to checkout_step_* events (Part 8). */
  checkoutId?: string;
  fulfillmentType?: "delivery" | "pickup";
  deliveryMode?: "now" | "schedule";
  selectedSlotId?: number | null;
  selectedPickupId?: number | null;
  deliveryInstructions?: string;
  guestPhone?: string;
  ecoPackagingOptIn?: boolean;
  // No tip field: checkout deliberately offers no tip selector (there is no
  // server-side capture path — see the inline note near the Payment card).
};

/** Field-by-field validation of a stored draft — a corrupt or stale payload
 * degrades to "field absent", never to a crash or a bad value in state. */
function parseCheckoutDraft(stored: Record<string, unknown>): CheckoutDraft {
  const d: CheckoutDraft = {};
  if (typeof stored.checkoutId === "string") d.checkoutId = stored.checkoutId;
  if (stored.fulfillmentType === "delivery" || stored.fulfillmentType === "pickup") {
    d.fulfillmentType = stored.fulfillmentType;
  }
  if (stored.deliveryMode === "now" || stored.deliveryMode === "schedule") {
    d.deliveryMode = stored.deliveryMode;
  }
  if (typeof stored.selectedSlotId === "number" || stored.selectedSlotId === null) {
    d.selectedSlotId = stored.selectedSlotId;
  }
  if (typeof stored.selectedPickupId === "number" || stored.selectedPickupId === null) {
    d.selectedPickupId = stored.selectedPickupId;
  }
  if (typeof stored.deliveryInstructions === "string") {
    d.deliveryInstructions = stored.deliveryInstructions;
  }
  if (typeof stored.guestPhone === "string") d.guestPhone = stored.guestPhone;
  if (typeof stored.ecoPackagingOptIn === "boolean") {
    d.ecoPackagingOptIn = stored.ecoPackagingOptIn;
  }
  return d;
}

function mintCheckoutId(): string {
  try {
    return (
      crypto.randomUUID?.() ??
      `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    );
  } catch {
    return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export default function V2Checkout() {
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // R1 wizard contract — used here for DRAFT PERSISTENCE only (the State
  // Amnesia fix: slot/instructions/guest-phone/eco-opt-in survive refresh
  // under `tanmatra:checkout-draft:v1`). The section-gated mobile 3-step flow
  // is intentionally deferred: PR #247 landed a single-scroll mobile checkout
  // with a ±2px pixel-geometry baseline, and re-litigating that money-path UX
  // inside this large PR is the wrong risk. `mirrorStepInUrl: false` keeps the
  // draft without putting a no-op `?step=` on the checkout URL. A stepped
  // mobile checkout can be a focused follow-up built on #247's stepper.
  const isMobile = useIsMobile();
  const [freshCheckoutId] = useState(() => mintCheckoutId());
  const wizard = useWizardState<CheckoutDraft>({
    flow: "checkout",
    totalSteps: 3,
    mirrorStepInUrl: false,
    initialDraft: { checkoutId: freshCheckoutId },
    parse: (stored) => {
      const d = parseCheckoutDraft(stored);
      // A draft always carries its id; heal one written before ids existed.
      if (!d.checkoutId) d.checkoutId = freshCheckoutId;
      return d;
    },
  });
  const wizardStep = wizard.step;
  const checkoutId = wizard.draft.checkoutId ?? freshCheckoutId;
  const clearCheckoutDraft = wizard.clearDraft;

  const { items, bundleSlugs, subtotal, clear } = useCart();
  // Guard: bounce to the menu only when the cart is GENUINELY empty (deep link
  // with nothing to buy, back-button after clear). On a refresh/deep-link the
  // first hydration render can see an empty store even though the persisted
  // cart is about to arrive (persist.hasHydrated() is true before the rehydrated
  // items reach this component), which used to kick buyers with a full cart out
  // of checkout. So: debounce, then re-check the LIVE store before redirecting;
  // any real items appearing cancels the timer.
  useEffect(() => {
    if (items.length > 0) return;
    const t = setTimeout(() => {
      if (useCartStore.getState().items.length === 0) {
        navigate("/menu", { replace: true });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [items.length, navigate]);
  useEffect(() => {
    if (items.length > 0) {
      track("checkout_start", {
        cartItemCount: items.length,
        subtotal,
      });
    }
  }, [items.length, subtotal]);

  const { addOrder } = useOrders();
  const { preferences } = usePreferences();
  const { enabled: clinicalMode, dietOrderId } = useClinicalMode();
  // Server-side allergen rejection from /orders/finalize. Surfaced as a
  // pinned red panel above the form (NOT a toast) so the user can see it
  // after dismissing the confirm dialog and the message stays visible
  // until they edit the cart and retry. Cleared on every new submit.
  const [serverAllergenError, setServerAllergenError] = useState<string | null>(null);
  // Structured per-item conflicts from the 422 safety_block payload, so
  // the ConflictsPanel can render the same Remove/Replace row format
  // regardless of whether the gate was tripped client-side or server-side.
  const [serverConflicts, setServerConflicts] = useState<
    ServerSafetyConflict[] | null
  >(null);

  // Mirror of the Cart-side confirm-block. The Cart already disables its
  // "Proceed to Checkout" CTA, but a user can deep-link to /checkout (e.g.
  // back-button after editing prefs) so we re-evaluate here as the last
  // client-side gate before hitting Razorpay. The server's finalize call
  // is still the authoritative boundary — see task #3.
  const cartConflicts = (() => {
    let allergens = 0;
    let diet = 0;
    const reasons: string[] = [];
    for (const it of items) {
      const dish = getDishById(it.dishId);
      if (!dish) continue;
      if (preferences) {
        const m = evaluateDishForPreferences(dish, preferences);
        if (m.matchedAllergens.length > 0) {
          allergens += 1;
          reasons.push(`${dish.name} — contains ${m.matchedAllergens.join(", ")}`);
        }
      }
      if (clinicalMode) {
        const c = dishMatchesDietOrder(dish, dietOrderId);
        if (c) {
          diet += 1;
          reasons.push(`${dish.name} — ${c.reason}`);
        }
      }
    }
    return { allergens, diet, reasons };
  })();
  const checkoutBlocked =
    cartConflicts.allergens > 0 || cartConflicts.diet > 0;
  const checkoutBlockedReason = checkoutBlocked
    ? cartConflicts.allergens > 0
      ? `${cartConflicts.allergens} allergen conflict${cartConflicts.allergens === 1 ? "" : "s"} in cart — review and remove flagged items.`
      : `${cartConflicts.diet} item${cartConflicts.diet === 1 ? "" : "s"} conflict with the active diet order.`
    : null;
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>("");

  // Distinguishes "logged in but has no saved addresses yet" from
  // "not signed in at all" — the inline new-address form would otherwise
  // tease an unauth user into filling fields that fail on submit.
  const [addressAuthRequired, setAddressAuthRequired] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<Map<number, number>>(
    new Map(),
  );
  // Derive cartTags once so the AddOnRail query and our addonTotal query share the same cache key.
  const cartTags = useMemo(
    () =>
      Array.from(
        new Set(
          items.flatMap((it) => [
            it.kitchen,
            it.isVeg ? "vegan" : "nonveg",
            ...(it.macros.protein >= 25 ? ["fitness", "performance"] : []),
            "lunch",
          ]),
        ),
      ),
    [items],
  );
  const addonsQuery = useQuery({
    queryKey: ["addons", cartTags.slice().sort().join(",")],
    queryFn: () => addonsApi.list(cartTags),
    staleTime: 60_000,
    enabled: selectedAddons.size > 0,
  });
  const addonTotal = useMemo(() => {
    const addons = addonsQuery.data?.addons ?? [];
    return Array.from(selectedAddons.entries()).reduce((sum, [id, qty]) => {
      const a = addons.find((x) => x.id === id);
      return sum + (a ? a.pricePaise * qty : 0);
    }, 0);
  }, [selectedAddons, addonsQuery.data]);
  const [showNewAddressFlow, setShowNewAddressFlow] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // Payment-failed banner near the Pay area. Set only on the payment
  // failure path that cancels the unpaid server order and keeps the user
  // on checkout (NOT the verify_unconfirmed recovery path, which navigates
  // to /track). Cleared on dismiss and on the next payment attempt.
  const [payFailure, setPayFailure] = useState<{ message: string } | null>(
    null,
  );
  // Holds the Idempotency-Key AND the orderId for the in-flight
  // finalize attempt. Both must be reused across retries so the
  // request body hashes identically and the server replays its
  // cached response instead of returning 409 idempotency_key_mismatch.
  // Minted on first click; cleared on terminal success or on
  // user-correctable failures (slot full, missing pickup, premium
  // gate, auth) where the next click is a different intent.
  const submitAttemptRef = useRef<{ key: string; orderId: string } | null>(
    null,
  );
  const [creditBalance, setCreditBalance] = useState(0);
  const [firstOrderOffer, setFirstOrderOffer] = useState<{
    eligible: boolean;
    percentBps: number;
    capPaise: number;
  } | null>(null);
  const [applyCredits, setApplyCredits] = useState(true);
  const [preorderTomorrow, setPreorderTomorrow] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  // Auto-polling recovery listener when returning from GPay/PhonePe/Paytm
  useEffect(() => {
    return subscribeUpiRecovery({
      onPollingStart: () => {
        setIsProcessing(true);
      },
      onRecovered: (event) => {
        setIsProcessing(false);
        setConfirmOpen(false);
        clear();
        // Terminal success via UPI-app recovery — clear the R1 wizard draft
        // exactly like the direct success path does.
        clearCheckoutDraft();
        submitAttemptRef.current = null;
        toast.success(`Payment confirmed upon return from UPI app! Order ${event.tx.orderId} placed.`);
        navigate(`/track?orderId=${encodeURIComponent(event.tx.orderId)}`);
      },
      onPollingEnd: () => {
        setIsProcessing(false);
      },
    });
  }, [clear, navigate, clearCheckoutDraft]);

  // High-fidelity guest-checkout & slotting states
  const [deliveryMode, setDeliveryMode] = useState<"now" | "schedule">("now");
  const [showGuestAuthDialog, setShowGuestAuthDialog] = useState(false);


  const [guestPhone, setGuestPhone] = useState("");
  const [guestCountryCode, setGuestCountryCode] = useState("+91");
  const [guestOtpCode, setGuestOtpCode] = useState("");
  const [guestAuthStep, setGuestAuthStep] = useState<"phone" | "code" | "welcome">("phone");
  const [guestDevCode, setGuestDevCode] = useState<string | null>(null);
  const [guestIsSending, setGuestIsSending] = useState(false);
  const [guestIsVerifying, setGuestIsVerifying] = useState(false);
  const [guestOtpError, setGuestOtpError] = useState<string | null>(null);
  const [otpShakeOn, setOtpShakeOn] = useState(false);
  // Segmented 6-box OTP input: refs for focus management plus the index of
  // the currently-focused box (drives a deterministic visible focus ring —
  // the theme resets the native outline on .tnm2 inputs).
  const otpBoxRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [otpFocusIdx, setOtpFocusIdx] = useState<number | null>(null);
  const [guestResendIn, setGuestResendIn] = useState(0);
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const recaptchaVerifierRef = useRef<any>(null);
  const [subsidy, setSubsidy] = useState<CompanySubsidy | null>(null);
  const [applySubsidy, setApplySubsidy] = useState(true);
  const [voucherCode, setVoucherCode] = useState("");
  const [redeemingVoucher, setRedeemingVoucher] = useState(false);
  // Inline voucher error so users who miss the toast still see why
  // their redeem failed. Cleared on each new redeem attempt and on
  // every keystroke. Per UX audit finding C4.
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");
  const [slots, setSlots] = useState<DeliverySlotOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotsError, setSlotsError] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  // Inline error message rendered directly under the slot grid. Populated
  // when the server rejects checkout with "delivery slot full" or
  // "delivery slot required" (replacing what used to be a toast-only
  // signal — toasts are easy to miss and disappear before the user
  // re-engages with the picker). Cleared on any slot interaction.
  const [slotErrorMsg, setSlotErrorMsg] = useState<string | null>(null);
  const [pickupLocations, setPickupLocations] = useState<PickupLocationOption[]>([]);
  const [selectedPickupId, setSelectedPickupId] = useState<number | null>(null);
  const [ecoPackagingOptIn, setEcoPackagingOptIn] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [savedInstructions, setSavedInstructions] = useState<Record<string, string>>({});

  // ---- R1 rehydrate-once-on-mount -----------------------------------------
  // Restore the benign form fields a refresh or back-navigation used to wipe
  // (they were in-memory only). `wizard.draft` on first render IS the stored
  // snapshot. The skip-once ref protects a restored in-progress rider note
  // from being clobbered by the saved-per-address hydration effect below the
  // moment addresses finish loading.
  const skipNextInstructionsHydration = useRef(false);
  useEffect(() => {
    const d = wizard.draft;
    if (d.fulfillmentType) setFulfillmentType(d.fulfillmentType);
    if (d.deliveryMode) setDeliveryMode(d.deliveryMode);
    if (d.selectedSlotId !== undefined) setSelectedSlotId(d.selectedSlotId);
    if (d.selectedPickupId !== undefined) setSelectedPickupId(d.selectedPickupId);
    if (typeof d.deliveryInstructions === "string" && d.deliveryInstructions.length > 0) {
      setDeliveryInstructions(d.deliveryInstructions);
      skipNextInstructionsHydration.current = true;
    }
    if (typeof d.guestPhone === "string" && d.guestPhone.length > 0) {
      setGuestPhone(d.guestPhone);
    }
    if (typeof d.ecoPackagingOptIn === "boolean") setEcoPackagingOptIn(d.ecoPackagingOptIn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror the live form fields into the persisted draft; the hook
  // serializes to sessionStorage on every change. Only the benign fields
  // listed in CheckoutDraft ever pass through here.
  useEffect(() => {
    wizard.patchDraft({
      fulfillmentType,
      deliveryMode,
      selectedSlotId,
      selectedPickupId,
      deliveryInstructions,
      guestPhone,
      ecoPackagingOptIn,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fulfillmentType,
    deliveryMode,
    selectedSlotId,
    selectedPickupId,
    deliveryInstructions,
    guestPhone,
    ecoPackagingOptIn,
  ]);

  // Default scheduled time: tomorrow 12:30 in the user's locale.
  const tomorrowSlot = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 30, 0, 0);
    return d;
  })();
  const PREORDER_BPS = 500;
  const preorderDiscount = preorderTomorrow
    ? Math.floor((subtotal * PREORDER_BPS) / 10_000)
    : 0;



  // 2. Automatic preorder discount sync based on selected slot
  const selectedSlot = slots.find((s) => s.id === selectedSlotId);
  const isPreorderSlot = useMemo(() => {
    if (!selectedSlot) return false;
    const slotDate = new Date(selectedSlot.startsAt);
    const today = new Date();
    return (
      slotDate.getDate() !== today.getDate() ||
      slotDate.getMonth() !== today.getMonth()
    );
  }, [selectedSlot, slots]);

  useEffect(() => {
    if (deliveryMode === "schedule" && isPreorderSlot) {
      setPreorderTomorrow(true);
    } else {
      setPreorderTomorrow(false);
    }
  }, [deliveryMode, isPreorderSlot]);

  // 3. Guest Auth timer countdown
  useEffect(() => {
    if (guestResendIn <= 0) return;
    const t = setInterval(() => setGuestResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [guestResendIn]);

  // Intercept place order click for guest users
  const handlePlaceOrderClick = async () => {
    let currentAddr = activeAddr;
    if (!currentAddr) {
      toast.error("Please enter or select a valid delivery address");
      setShowNewAddressFlow(true);
      return;
    }
    // Defense in depth for the OTHER Pay entry points that aren't disabled
    // by payBlockedReason directly — currently the payFailure banner's
    // "Try again" button, which re-invokes this same handler.
    if (payBlockedReason) {
      toast.error(payBlockedReason);
      return;
    }
    if (addressAuthRequired) {
      if (currentAddr.phone.trim()) {
        setGuestPhone(currentAddr.phone.trim().replace(/^\+91/, ""));
      }
      setShowGuestAuthDialog(true);
    } else {
      setConfirmOpen(true);
    }
  };

  const handleSendGuestOtp = async () => {
    const digits = guestPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }
    setGuestIsSending(true);

    if (!auth) {
      toast.error("Verification is temporarily unavailable", {
        description:
          "Verification service is not configured. Please try again shortly.",
      });
      setGuestIsSending(false);
      return;
    }

    try {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {}
        recaptchaVerifierRef.current = null;
      }
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
      const phoneNumberE164 = `${guestCountryCode}${digits}`;
      const confirmation = await signInWithPhoneNumber(auth, phoneNumberE164, recaptchaVerifierRef.current);
      setConfirmationResult(confirmation);
      // Fresh code incoming — clear any stale OTP input/error/shake from a
      // previous attempt so the code step starts clean (also covers Resend).
      setGuestOtpCode("");
      setGuestOtpError(null);
      setOtpShakeOn(false);
      setGuestAuthStep("code");
      setGuestResendIn(30);
      toast.success(`Verification code sent to ${guestCountryCode} ${guestPhone}`);
    } catch (err) {
      console.error("Guest SMS OTP failed:", err);
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {}
        recaptchaVerifierRef.current = null;
      }
      toast.error("Couldn't send verification code", {
        description: friendlyFirebaseError(err),
      });
    } finally {
      setGuestIsSending(false);
    }
  };

  const failOtpInline = (message: string) => {
    setGuestOtpError(message);
    setOtpShakeOn(true);
  };

  // ── Segmented 6-box OTP input helpers ────────────────────────────────
  // guestOtpCode stays the single joined string (the verify logic, the
  // "Verify & Continue" disabled state, shake-on-error and the resend flow
  // are untouched); the six boxes are just a view over it. Entry is kept
  // contiguous: digit i always lives in box i.
  const focusOtpBox = (index: number) => {
    const el = otpBoxRefs.current[index];
    if (el) {
      el.focus();
      el.select();
    }
  };

  const applyOtpCode = (next: string) => {
    setGuestOtpCode(next.replace(/\D/g, "").slice(0, 6));
    setGuestOtpError(null);
  };

  const handleOtpBoxChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 0) {
      // Box cleared (backspace/cut on a selected digit) — drop this
      // position; any later digits shift left to stay contiguous.
      applyOtpCode(guestOtpCode.slice(0, index) + guestOtpCode.slice(index + 1));
      return;
    }
    if (digits.length >= 6) {
      // True full-code burst — WebOTP / keyboard OTP autofill (boxes
      // deliberately have no maxLength so autofill isn't truncated).
      // Distribute across all six boxes from the start.
      applyOtpCode(digits);
      focusOtpBox(Math.min(digits.length, 5));
      return;
    }
    if (digits.length >= 4) {
      // A shorter autofill burst landing on this box — insert starting at
      // the receiving box rather than replacing from zero, so digits
      // already entered in earlier boxes survive.
      const at = Math.min(index, guestOtpCode.length);
      applyOtpCode(
        guestOtpCode.slice(0, at) + digits + guestOtpCode.slice(at + digits.length),
      );
      focusOtpBox(Math.min(at + digits.length, 5));
      return;
    }
    // Single keystroke next to an existing digit (2 chars): the caret may
    // sit BEFORE the existing digit (click, ArrowLeft, or Home collapses
    // the select-all to the start), so the browser can deliver
    // "<new><old>" instead of "<old><new>". Diff against the box's
    // previous value to find the actually-new character instead of always
    // assuming it's last — otherwise a correction silently rewrites the
    // same old digit while focus still advances.
    const old = guestOtpCode[index];
    let ch = digits[digits.length - 1];
    if (old != null && digits.length > 1 && ch === old && digits[0] !== old) {
      ch = digits[0];
    }
    const at = Math.min(index, guestOtpCode.length);
    applyOtpCode(guestOtpCode.slice(0, at) + ch + guestOtpCode.slice(at + 1));
    focusOtpBox(Math.min(at + 1, 5));
  };

  const handleOtpBoxKeyDown = (
    index: number,
    e: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && e.currentTarget.value === "") {
      // Empty box: move back and delete the previous digit.
      e.preventDefault();
      if (index > 0) {
        applyOtpCode(
          guestOtpCode.slice(0, index - 1) + guestOtpCode.slice(index),
        );
        focusOtpBox(index - 1);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusOtpBox(index - 1);
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      focusOtpBox(index + 1);
    }
  };

  const handleOtpPaste = (
    index: number,
    e: ClipboardEvent<HTMLInputElement>,
  ) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    if (digits.length === 0) return;
    e.preventDefault();
    if (digits.length >= 6) {
      // A full-code paste distributes across all six boxes from the start
      // regardless of which box received it — same net behaviour the old
      // single input had.
      applyOtpCode(digits);
      focusOtpBox(Math.min(digits.length, 5));
      return;
    }
    // A partial paste (completing a code the user started typing) inserts
    // at the receiving box instead of replacing from zero, so digits
    // already entered in earlier boxes survive.
    const at = Math.min(index, guestOtpCode.length);
    applyOtpCode(
      guestOtpCode.slice(0, at) + digits + guestOtpCode.slice(at + digits.length),
    );
    focusOtpBox(Math.min(at + digits.length, 5));
  };

  const handleVerifyGuestOtp = async () => {
    if (guestOtpCode.replace(/\D/g, "").length < 6) {
      failOtpInline("Enter the full 6-digit code");
      return;
    }
    if (!confirmationResult) {
      toast.error("No verification in progress");
      return;
    }
    setGuestIsVerifying(true);
    try {
      const userCredential = await confirmationResult.confirm(guestOtpCode);
      const idToken = await userCredential.user.getIdToken();
      
      const res = await fetch(`${API_BASE}/auth/phone/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          idToken,
          attribution: {
            dpdpConsent: true,
            tosVersion: "2026-05",
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as VerifyOtpResponse;
      if (!res.ok || !data.ok || !data.user) {
        failOtpInline(data.error ?? "Incorrect verification code — try again");
        return;
      }

      if (data.user.firstName === null) {
        setGuestAuthStep("welcome");
      } else {
        await handleGuestAuthSuccess();
      }
    } catch (err) {
      console.error(err);
      failOtpInline("That code didn't match — check it and try again");
    } finally {
      setGuestIsVerifying(false);
    }
  };

  const handleGuestAuthSuccess = async () => {
    try {
      if (guestFirstName.trim()) {
        await fetch(`${API_BASE}/auth/profile/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            firstName: guestFirstName.trim(),
            email: guestEmail.trim() || undefined,
          }),
        });
      }

      const guestAddr = savedAddresses.find((a) => a.id === "guest-addr");
      if (!guestAddr) {
        throw new Error("No guest address found to sync");
      }

      const r = await addressesApi.create({
        label: guestAddr.label || "Home",
        line1: guestAddr.line1,
        line2: guestAddr.line2 || undefined,
        city: guestAddr.city,
        pincode: guestAddr.pincode,
        phone: guestPhone || guestAddr.phone,
      });

      setSavedAddresses([r.address]);
      setSelectedAddress(r.address.id);
      setAddressAuthRequired(false);
      setShowGuestAuthDialog(false);
      setConfirmOpen(true);
      toast.success("Phone number verified and address saved!");
    } catch (err) {
      console.error("Error syncing guest account details:", err);
      toast.error("Could not save account details — please try again");
    }
  };

  const fetchSlots = async () => {
    setLoadingSlots(true);
    setSlotsError(false);
    try {
      const r = await fulfillmentApi.listSlots();
      setSlots(r.slots);
    } catch {
      setSlots([]);
      setSlotsError(true);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    let alive = true;
    void fulfillmentApi
      .listSlots()
      .then((r) => {
        if (alive) {
          setSlots(r.slots);
          setLoadingSlots(false);
        }
      })
      .catch(() => {
        if (alive) {
          setSlots([]);
          setSlotsError(true);
          setLoadingSlots(false);
        }
      });
    void fulfillmentApi
      .listPickupLocations()
      .then((r) => {
        if (alive) setPickupLocations(r.locations);
      })
      .catch(() => {
        if (alive) setPickupLocations([]);
      });
    void fulfillmentApi
      .listInstructions()
      .then((r) => {
        if (!alive) return;
        const map: Record<string, string> = {};
        for (const it of r.instructions) map[it.addressLabel] = it.instructions;
        setSavedInstructions(map);
      })
      .catch(() => {
        /* not signed in or none yet */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Load the user's saved addresses on mount; auto-select the default
  // (or first) so checkout always has a pre-selected option. If the user
  // has none yet, open the inline new-address form.
  useEffect(() => {
    let alive = true;
    void addressesApi
      .list()
      .then((r) => {
        if (!alive) return;
        setSavedAddresses(r.addresses);
        // No auto-modal when the list is empty: a blocking interstitial on
        // checkout entry (before the user even sees their order) is a
        // conversion killer. The Delivery Address card carries the
        // "Add New Address" CTA, and the submit path opens the flow
        // just-in-time if they try to pay without one.
        if (r.addresses.length > 0) {
          const def = r.addresses.find((a) => a.isDefault) ?? r.addresses[0];
          setSelectedAddress(def.id);
        }
      })
      .catch((err: Error) => {
        if (!alive) return;
        setSavedAddresses([]);
        // 401 from list() means the session expired or the user landed on
        // checkout without signing in. Surface a sign-in CTA instead of
        // baiting them into the new-address form (architect P1). Same
        // no-interstitial rule as above — the guest sees the page first.
        if (String(err.message).startsWith("401")) {
          setAddressAuthRequired(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  // Hydrate the instructions field from the persisted value for the
  // currently-selected saved address.
  const activeAddrLabel = savedAddresses.find((a) => a.id === selectedAddress)?.label;
  useEffect(() => {
    if (!activeAddrLabel) return;
    if (skipNextInstructionsHydration.current) {
      // An R1-draft-restored in-progress note wins the FIRST hydration after
      // addresses load; switching addresses afterwards behaves as before.
      skipNextInstructionsHydration.current = false;
      return;
    }
    setDeliveryInstructions(savedInstructions[activeAddrLabel] ?? "");
  }, [activeAddrLabel, savedInstructions]);

  useEffect(() => {
    let alive = true;
    loyaltyApi
      .getCreditLedger()
      .then((r) => {
        if (alive) setCreditBalance(r.balancePaise);
      })
      .catch(() => {
        if (alive) setCreditBalance(0);
      });
    // First-order offer eligibility is server-truth; when the call fails
    // we show no discount (finalize would not have applied one either).
    loyaltyApi
      .getFirstOrderOffer()
      .then((r) => {
        if (alive) setFirstOrderOffer(r);
      })
      .catch(() => {
        if (alive) setFirstOrderOffer(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  // No tip selector is offered (see checkout form) — there is no
  // server-side capture path for a tip, so it must never be non-zero here.
  const effectiveTip = 0;
  const selectedPickup =
    fulfillmentType === "pickup"
      ? pickupLocations.find((p) => p.id === selectedPickupId) ?? null
      : null;
  const pickupDiscount = selectedPickup?.discountPaise ?? 0;
  // First-order offer — mirrors the server pipeline exactly (applied after
  // pickup/preorder discounts, before credits); the finalize response is
  // reconciled against this estimate before charging.
  const offerPercent = firstOrderOffer ? firstOrderOffer.percentBps / 100 : 25;
  const offerCapPaise = firstOrderOffer ? firstOrderOffer.capPaise : 8000;

  const preFirstOrderSubtotal = Math.max(0, subtotal - preorderDiscount - pickupDiscount);
  const firstOrderDiscount = firstOrderOffer?.eligible
    ? Math.min(
        Math.floor((preFirstOrderSubtotal * firstOrderOffer.percentBps) / 10_000),
        firstOrderOffer.capPaise,
      )
    : 0;
  const discountedSubtotal = Math.max(0, preFirstOrderSubtotal - firstOrderDiscount);
  // Pickup orders skip delivery fee entirely; otherwise the existing free-over-threshold rule.
  // Free-delivery threshold is judged on the RAW meal subtotal — the same
  // basis the cart page and sticky bar use — so an applied offer (e.g. the
  // first-order discount) can never *revoke* free delivery the customer
  // already unlocked while browsing. Customer-favorable and consistent.
  const deliveryFee =
    fulfillmentType === "pickup" ? 0 : subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const amountToFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const freeDeliveryProgress = subtotal === 0 ? 0 : Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100);
  const hasFreeDelivery = fulfillmentType === "pickup" || deliveryFee === 0;
  // Statutory GST split: prepared food 5% (no ITC) + delivery service 18%.
  // Rates are shared with the cart display via cartMath.ts (single
  // client-side source of truth, mirroring the server's computeChargePaise).
  const gst =
    Math.round(discountedSubtotal * GST_RATE_FOOD) +
    Math.round(deliveryFee * GST_RATE_DELIVERY);
  // grossTotal (and razorpayTotal below) intentionally EXCLUDE addonTotal:
  // add-ons are not part of the Razorpay-captured amount (chargePaise) — they
  // are recorded separately via POST /addons/attach after payment succeeds.
  // Folding them into the number shown on the "Pay" button / Razorpay modal
  // would show the customer a total higher than what's actually charged.
  const grossTotal = discountedSubtotal + gst + deliveryFee + effectiveTip;
  // Server only redeems against the (discounted) meal subtotal; cap here too
  // so the UI total matches the server final total exactly.
  const creditApplied =
    applyCredits && creditBalance > 0
      ? Math.min(creditBalance, discountedSubtotal)
      : 0;
  const remainingAfterCredit = Math.max(0, grossTotal - creditApplied);
  const subsidyAvailable =
    applySubsidy && subsidy?.active ? Math.min(subsidy.subsidyPaise ?? 0, remainingAfterCredit) : 0;
  const razorpayTotal = Math.max(0, remainingAfterCredit - subsidyAvailable);

  useEffect(() => {
    let alive = true;
    corporateApi
      .getSubsidy(discountedSubtotal)
      .then((r) => {
        if (alive) setSubsidy(r);
      })
      .catch(() => {
        if (alive) setSubsidy(null);
      });
    return () => {
      alive = false;
    };
  }, [discountedSubtotal]);

  const handleRedeemVoucher = async () => {
    setVoucherError(null);
    if (!voucherCode.trim()) {
      setVoucherError("Enter a voucher code");
      return;
    }
    setRedeemingVoucher(true);
    try {
      const r = await corporateApi.redeemVoucher(voucherCode.trim());
      toast.success(`Voucher applied: +${formatPrice(r.creditedPaise)}`);
      setVoucherCode("");
      // Refresh credit balance so it shows up in summary
      const ledger = await loyaltyApi.getCreditLedger();
      setCreditBalance(ledger.balancePaise);
    } catch (e) {
      const msg = String((e as Error).message);
      const userMsg = msg.includes("404")
        ? "Voucher not found"
        : msg.includes("409")
          ? "Voucher already redeemed"
          : "Could not redeem voucher";
      // Show inline (next to input) AND toast — toasts are easy to
      // miss on mobile when the user is mid-form. Per UX audit C4.
      setVoucherError(userMsg);
      toast.error(userMsg);
    } finally {
      setRedeemingVoucher(false);
    }
  };

  const activeAddr = savedAddresses.find((a) => a.id === selectedAddress);

  // Mobile 3-step flow is deferred (see the useWizardState note above).
  // goToCheckoutStep stays a thin wrapper — still used to reveal the
  // fulfillment card on an error scroll — but the paired step telemetry is
  // intentionally NOT emitted: without the stepped flow live it would inject
  // phantom checkout_step_viewed/_completed events and skew the F2 funnel.
  // The follow-up that ships the stepped mobile flow re-adds the events and
  // the forward-gate guards.
  const goToCheckoutStep = (next: number) => {
    wizard.goToStep(next);
  };
  const handleMobileContinue = () => goToCheckoutStep(Math.min(wizardStep + 1, 2));

  // Mobile checkout follows PR #247's single-scroll design (all sections
  // visible at 390px — its pixel-geometry baseline depends on it). Section
  // gating is deferred with the stepped flow; this stays a no-op so the
  // wiring is ready for the follow-up without changing today's layout.
  const mobileStepClass = (_uiStep: number) => "";

  // Disabled-with-reason for the Pay CTAs (PR-09). Surfaces the first
  // actionable blocker BEFORE the click instead of relying on a post-click
  // toast; the guards inside handlePlaceOrderClick / handleConfirmedPayment
  // stay as defense in depth. Patient-safety blocks intentionally keep their
  // own dedicated flow via checkoutBlocked / checkoutBlockedReason.
  const payBlockedReason: string | null =
    fulfillmentType === "delivery" && !activeAddr
      ? "Select a delivery address to continue"
      : fulfillmentType === "pickup" && selectedPickupId === null
        ? "Choose a pickup location to continue"
        : fulfillmentType === "delivery" &&
            deliveryMode === "schedule" &&
            selectedSlotId === null
          ? "Pick a delivery slot to continue"
          : null;

  // Order reference surfaced while a payment is in flight. The attempt ref
  // is minted synchronously before the first await in
  // handleConfirmedPayment, so by the time the isProcessing re-render
  // happens it is already populated. UPI-recovery polling can flip
  // isProcessing on without an attempt of its own — in that case we simply
  // omit the reference (never show a fabricated one).
  const processingOrderRef = isProcessing
    ? submitAttemptRef.current?.orderId ?? null
    : null;

  useEffect(() => {
    if (!activeAddr || items.length === 0 || fulfillmentType !== "delivery") {
      setEtaMinutes(null);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/delivery/eta/estimate`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((it) => ({ id: it.dishId, qty: it.quantity })),
        address: {
          line: [activeAddr.line1, activeAddr.line2].filter(Boolean).join(", "),
          city: activeAddr.city,
          pincode: activeAddr.pincode,
        },
      }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { etaAt?: string } | null) => {
        if (cancelled || !data?.etaAt) return;
        const mins = Math.round((new Date(data.etaAt).getTime() - Date.now()) / 60000);
        if (mins > 0) setEtaMinutes(mins);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeAddr?.id, items.length, fulfillmentType]);



  if (!isMounted) {
    return (
      <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="content padx tc" style={{ padding: "72px 20px" }}>
            <h1>Checkout</h1>
            <div style={{ marginTop: 24 }}>
              <Link to="/menu" className="btn btn-p opacity-50 pointer-events-none">Browse Menu</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="content padx tc" style={{ padding: "72px 20px" }}>
            <i className="ph-bold ph-warning-circle" style={{ fontSize: 34, color: "var(--safb)" }} />
            <h1 className="h2 mt10" style={{ color: "var(--text-primary)" }}>Your cart is empty</h1>
            <div className="fine mt6">Add meals to your cart before checking out.</div>
            <Link to="/menu" className="btn btn-p mt20 inline-flex items-center justify-center">
              Browse Menu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleConfirmedPayment = async () => {
    if (isProcessing) return; // re-entry guard: a queued double-tap can't fire a 2nd payment
    if (!activeAddr) {
      toast.error("Please select a delivery address");
      setConfirmOpen(false);
      return;
    }
    // Clear any prior server-side block so a fresh attempt isn't shown
    // wearing the previous failure's red panel.
    setServerAllergenError(null);
    setServerConflicts(null);
    // New attempt — retire any previous payment-failed banner.
    setPayFailure(null);
    setIsProcessing(true);
    // (Removed an artificial 1.5s setTimeout that delayed every order
    // for no functional reason. Server timing already drives the spinner.)

    // Pin orderId together with the idempotency key for the lifetime
    // of this submit attempt. If the user clicks again after a
    // transient failure, both the key AND the orderId are reused so
    // the server hashes the same body and replays its cached result.
    if (!submitAttemptRef.current) {
      const newOrderId = generateOrderId();
      submitAttemptRef.current = {
        key: submitOrderIdempotencyKey(newOrderId),
        orderId: newOrderId,
      };
    }
    const orderId = submitAttemptRef.current.orderId;
    const placedAt = new Date().toISOString();
    // Dynamic ETA from server (kitchen queue + rider load + distance + time-of-day).
    // Falls back to legacy 25-min static if the model errors or is disabled.
    let etaAt = new Date(Date.now() + 25 * 60 * 1000).toISOString();
    try {
      const apiBase = API_BASE;
      const r = await fetch(`${apiBase}/delivery/eta/estimate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({ id: it.dishId, qty: it.quantity })),
          address: {
            line: [activeAddr.line1, activeAddr.line2].filter(Boolean).join(", "),
            city: activeAddr.city,
            pincode: activeAddr.pincode,
          },
        }),
      });
      if (r.ok) {
        const data = (await r.json()) as { etaAt?: string };
        if (data.etaAt) etaAt = data.etaAt;
      }
    } catch {
      // keep static fallback
    }

    // Server-owned atomic finalize: persists the order in the database,
    // redeems credits, and awards any pending referral inside one
    // transaction. The server computes the gross from item prices
    // (client-supplied amounts cannot underprice the order).
    let finalTotal = grossTotal;
    let referralAwarded = false;
    let serverOrderIdFromFinalize: number | undefined;
    let firstOrderDiscountApplied = 0;
    // Server-authoritative money fields captured out of the finalize response
    // for the post-payment local order record (`out` is scoped to the try).
    let serverSubtotalPaise = subtotal;
    let serverDeliveryFeePaise = deliveryFee;
    // Corporate subsidy actually applied to the customer's card charge (the
    // company is billed this amount post-payment). Captured here so the
    // subsidy-charge step below bills exactly what reduced the card total.
    let subsidyApplied = 0;
    try {
      const out = await loyaltyApi.finalizeOrder({
        // Same key for every retry of THIS submit attempt; the server
        // dedupes via its idempotency_keys cache, so a network blip or
        // 5xx-then-retry won't double-charge the customer.
        idempotencyKey: submitAttemptRef.current.key,
        orderId,
        items: items.map((it) => ({
          id: it.dishId,
          name: it.recipient ? `${it.name} (For ${it.recipient})` : it.name,
          qty: it.quantity,
          price: it.unitPrice,
        })),
        address: {
          label: activeAddr.label,
          line: [activeAddr.line1, activeAddr.line2].filter(Boolean).join(", "),
          city: activeAddr.city,
          pincode: activeAddr.pincode,
          phone: activeAddr.phone,
        },
        applyCreditsPaise: creditApplied > 0 ? creditApplied : undefined,
        scheduledFor: preorderTomorrow ? tomorrowSlot.toISOString() : undefined,
        bundleSlugs: bundleSlugs.length > 0 ? bundleSlugs : undefined,
        fulfillmentType,
        deliverySlotId: fulfillmentType === "delivery" ? selectedSlotId : null,
        // Phase B2 — à la carte delivery is windows-only: require an explicit
        // future slot (no ASAP). The server 4xxs a missing/expired/full slot
        // and the picker surfaces it inline.
        requireScheduledSlot: fulfillmentType === "delivery",
        pickupLocationId: fulfillmentType === "pickup" ? selectedPickupId : null,
        ecoPackagingOptIn: fulfillmentType === "delivery" && ecoPackagingOptIn,
        deliveryInstructions: deliveryInstructions.trim() || null,
      });
      // Persist the per-address instructions so the next order on this
      // saved address pre-fills with the same note. We always upsert,
      // including empty strings, so the user can clear stale notes.
      if (activeAddr) {
        const trimmed = deliveryInstructions.trim();
        const previous = savedInstructions[activeAddr.label] ?? "";
        if (trimmed !== previous) {
          try {
            await fulfillmentApi.upsertInstructions(activeAddr.label, trimmed);
            setSavedInstructions((prev) => ({
              ...prev,
              [activeAddr.label]: trimmed,
            }));
          } catch {
            // non-fatal: order is already placed
          }
        }
      }
      // ───────────────────────────────────────────────────────────────
      // C3 — Razorpay checkout handoff.
      // Requires: RAZORPAY_KEY_ID env var on the client, and the backend
      // to expose POST /payments/razorpay/order returning { razorpayOrderId }.
      // The server is the single authority for the payable amount: it prices
      // the gateway order from the stored charge_paise, so we bill exactly
      // out.chargePaise (post-discount meal + 18% GST + delivery fee).
      // ───────────────────────────────────────────────────────────────
      const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID as
        | string
        | undefined;
      firstOrderDiscountApplied = out.firstOrderDiscountPaise ?? 0;
      // Server-authoritative money fields for the local order record.
      serverSubtotalPaise = out.finalPaise;
      serverDeliveryFeePaise = out.deliveryFeePaise;
      // Bill EXACTLY the server-computed charge, never a client recomputation.
      // Tip and add-ons are NOT part of this charge: there is no rider-tip
      // capture path at all, and add-ons are only recorded via a separate
      // post-payment bookkeeping call (POST /addons/attach) that does not
      // add to the Razorpay-captured amount. The Razorpay order itself is
      // priced server-side from out.chargePaise only (GST / delivery /
      // discounts / credits are already inside chargePaise — do NOT re-add
      // them here or the customer is double-charged), so the amount we show
      // in the modal / "Pay" button must match that exactly.
      // Corporate subsidy is a client/corporate-side reduction that the server
      // order total does NOT model: the company is billed `subsidyApplied` and
      // the customer's card is charged the remainder. Cap it to the payable so
      // the card charge can never go negative, and bill the company exactly the
      // amount that reduced the card charge (avoids over-collecting).
      const grossPayable = out.chargePaise;
      subsidyApplied = Math.min(Math.max(0, subsidyAvailable), grossPayable);
      const finalCharge = Math.max(0, grossPayable - subsidyApplied);

      // Cancel the (already-created) unpaid server order so it never sits in
      // the kitchen queue when payment doesn't complete. Mirrors CartDrawer.
      const cancelServerOrder = () => {
        void fetch(
          `${API_BASE}/orders/${encodeURIComponent(orderId)}/cancel`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ reason: "Payment not completed" }),
          },
        ).catch((err) => console.error("Failed to cancel unpaid order:", err));
      };

      if (!RAZORPAY_KEY_ID) {
        // No gateway configured — we must NOT present an unpaid order as
        // placed. Cancel it and keep the user on checkout (cart preserved).
        cancelServerOrder();
        removePendingTransaction(orderId);
        submitAttemptRef.current = null;
        toast.error("Payments are temporarily unavailable — your cart is safe");
        setIsProcessing(false);
        setConfirmOpen(false);
        return;
      }

      try {
        // 1. Ask the server to create a Razorpay order. It prices the gateway
        //    order from the stored charge_paise; we pass the SAME
        //    externalOrderId used in finalize (and later in verify) and include
        //    amountPaise only for the server's drift log — it is ignored for
        //    pricing.
        // Bound the pre-modal order-create call so a hung gateway/backend can't
        // leave the buyer stuck on a disabled "Processing…" button forever. Safe
        // to abort+retry here: no payment has been taken yet, and the reused
        // idempotency key makes a retry replay the same server order.
        const rpCtrl = new AbortController();
        const rpTimer = setTimeout(() => rpCtrl.abort(), 12_000);
        let rpOrderRes: Response;
        try {
          rpOrderRes = await fetch(
            `${API_BASE}/payments/razorpay/order`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ orderId, amountPaise: out.chargePaise }),
              signal: rpCtrl.signal,
            },
          );
        } catch (e) {
          throw rpCtrl.signal.aborted
            ? new Error("Payment is taking too long — please try again")
            : e;
        } finally {
          clearTimeout(rpTimer);
        }
        if (!rpOrderRes.ok)
          throw new Error(`razorpay/order ${rpOrderRes.status}`);
        const { razorpayOrderId } = (await rpOrderRes.json()) as {
          razorpayOrderId: string;
        };

        // 2. Open Razorpay checkout modal — script loaded lazily below. The
        //    promise resolves ONLY after the server confirms the payment
        //    (verify res.ok); every other outcome rejects, so an unconfirmed
        //    payment is never treated as placed.
        await new Promise<void>((resolve, reject) => {
          // Load Razorpay checkout.js if not already present.
          if (!document.getElementById("__rzp_script")) {
            const s = document.createElement("script");
            s.id = "__rzp_script";
            s.src = "https://checkout.razorpay.com/v1/checkout.js";
            s.onload = () => openModal();
            s.onerror = () =>
              reject(new Error("Razorpay script failed to load"));
            document.head.appendChild(s);
          } else {
            openModal();
          }

          function openModal() {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const Razorpay = (window as any).Razorpay;
            if (!Razorpay) {
              reject(new Error("Razorpay not available"));
              return;
            }
            const rzp = new Razorpay({
              key: RAZORPAY_KEY_ID,
              amount: finalCharge,
              currency: "INR",
              order_id: razorpayOrderId,
              name: "Tanmatra",
              description: `Order ${orderId}`,
              theme: { color: "var(--tnm-action)" },
              prefill: {
                contact: activeAddr?.phone ?? "",
              },
              handler: async (response: {
                razorpay_payment_id: string;
                razorpay_order_id: string;
                razorpay_signature: string;
              }) => {
                // 3. Verify server-side before accepting the order. Only a
                //    res.ok verify confirms the charge — a 400/404/409 (bad
                //    signature, unknown order, wrong state) means the payment
                //    was NOT confirmed. In that case keep the pending-tx
                //    marker so the webhook + recovery poller reconcile, and do
                //    NOT clear the cart / record the order / navigate as paid.
                try {
                  const vres = await fetch(
                    `${API_BASE}/payments/razorpay/verify`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        orderId,
                        razorpayPaymentId: response.razorpay_payment_id,
                        razorpayOrderId: response.razorpay_order_id,
                        razorpaySignature: response.razorpay_signature,
                      }),
                    },
                  );
                  if (vres.ok) {
                    // Confirmed — safe to drop the recovery marker now.
                    removePendingTransaction(orderId);
                    resolve();
                  } else {
                    reject(new Error("verify_unconfirmed"));
                  }
                } catch {
                  // Network error reaching verify: treat as unconfirmed and
                  // let the webhook + pending-tx recovery reconcile.
                  reject(new Error("verify_unconfirmed"));
                }
              },
              modal: {
                ondismiss: () => reject(new Error("payment_cancelled")),
              },
            });
            savePendingTransaction({
              orderId,
              idempotencyKey: submitAttemptRef.current?.key ?? orderId,
              initiatedAt: Date.now(),
              amount: finalCharge,
              provider: "razorpay",
            });
            rzp.open();
          }
        });
        // Reaching here means verify returned res.ok — payment confirmed.
      } catch (rpErr) {
        const rpMsg = String((rpErr as Error).message);
        if (rpMsg === "verify_unconfirmed") {
          // Payment was attempted but the server did NOT confirm it. Keep the
          // pending-tx marker (webhook + recovery poller reconcile) and do NOT
          // record the order as paid, clear the cart, or navigate as placed.
          // Show an honest "confirming" state and route to the tracker's
          // recovery view.
          toast.info(
            "We're confirming your payment — we'll update your order shortly.",
          );
          setIsProcessing(false);
          setConfirmOpen(false);
          navigate(`/track?orderId=${encodeURIComponent(orderId)}`);
          return;
        }
        // Pre-modal failure (razorpay/order non-OK, script load failure,
        // gateway unavailable) or user cancellation: cancel the unpaid server
        // order and stay on checkout. Never present it as a completed order.
        cancelServerOrder();
        removePendingTransaction(orderId);
        submitAttemptRef.current = null;
        // Persistent inline banner near the Pay area (toasts vanish before
        // a rattled buyer re-engages). Cleared on dismiss / next attempt.
        // A deliberate cancel gets calmer copy — no money moved, so the
        // auto-reversal reassurance would only alarm.
        setPayFailure({
          message:
            rpMsg === "payment_cancelled"
              ? "Payment cancelled — nothing was charged and your cart is saved."
              : "Payment didn't complete. Any amount debited is auto-reversed by your bank, typically within 5-7 business days.",
        });
        toast.info(
          rpMsg === "payment_cancelled"
            ? "Payment cancelled — your cart is safe"
            : "Payment could not be started — your cart is safe",
        );
        setIsProcessing(false);
        setConfirmOpen(false);
        return;
      }

      // Payment confirmed. The recorded local total is the amount actually
      // charged via Razorpay (chargePaise, net of subsidy). The server's
      // finalPaise/deliveryFeePaise are recorded separately for the order
      // breakdown.
      finalTotal = finalCharge;
      setCreditBalance(out.balancePaise);
      referralAwarded = out.referral.awarded;
      serverOrderIdFromFinalize = out.serverOrderId;
      // Attach add-ons (drinks/snacks/supplements) to the freshly-created
      // server order. Failures here should not block the order itself —
      // the user already paid. Add-ons are NOT part of finalCharge (never
      // billed via Razorpay); this call only records them for
      // fulfillment/bookkeeping on the already-placed order.
      if (out.serverOrderId && selectedAddons.size > 0) {
        try {
          const items = Array.from(selectedAddons.entries()).map(
            ([addonId, qty]) => ({ addonId, qty }),
          );
          await addonsApi.attach(out.serverOrderId, items);
        } catch {
          toast.warning("Add-ons could not be attached — contact support");
        }
      }
    } catch (err) {
      const msg = String((err as Error).message);
      // loyaltyApi.request() throws Error(`${status}: ${text}`); parse the
      // status prefix exactly so a future error body containing the digits
      // "401" or "403" can never get misclassified as auth/premium.
      const statusMatch = /^(\d{3}):/.exec(msg);
      const status = statusMatch ? Number(statusMatch[1]) : 0;
      const scrollToFulfillment = () => {
        // On the mobile stepped flow the fulfillment card lives on the
        // Delivery step — walk back first (no-op visually on ≥md), and let
        // the commit land before scrolling to the now-visible element.
        goToCheckoutStep(1);
        setTimeout(() => {
          document
            .getElementById("checkout-fulfillment")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      };
      if (msg.includes("delivery slot full")) {
        try {
          const r = await fulfillmentApi.listSlots();
          setSlots(r.slots);
        } catch {
          /* noop */
        }
        // The picker only exists in "schedule" mode — flip into it so the
        // user always sees the grid the error is pointing at.
        setDeliveryMode("schedule");
        setSelectedSlotId(null);
        setSlotErrorMsg(
          "That delivery window just sold out. Please pick another.",
        );
        scrollToFulfillment();
        toast.error("That delivery slot is full");
      } else if (msg.includes("delivery slot required")) {
        // Server auto-assigns ASAP slots now, so this only fires when no
        // window is open at all — show the picker, not a dead-end toast.
        setDeliveryMode("schedule");
        setSlotErrorMsg("No ASAP window is open right now — pick a delivery slot.");
        scrollToFulfillment();
        toast.error("No ASAP window open — please pick a delivery slot");
      } else if (
        msg.includes("pickup location required") ||
        msg.includes("pickup location unavailable")
      ) {
        toast.error("Please choose a pickup partner to continue", {
          action: { label: "Choose pickup", onClick: scrollToFulfillment },
        });
      } else if (
        // Server-authoritative patient-safety gate (task #3). We treat any
        // 422 whose body parses to a structured safety_block payload as
        // a safety rejection — keyword regex on the message is too narrow
        // (would miss generic `safety_block` / NPO / diet codes) and the
        // server is the source of truth here.
        status === 422 &&
        (() => {
          const parsed = parseSafetyBlock(msg);
          if (parsed && (parsed.conflicts.length > 0 || parsed.primaryCode)) {
            return true;
          }
          return /allergen|diet[_ ]order|safety_block/i.test(msg);
        })()
      ) {
        // Pin a red panel at the top of the page and scroll to it so the
        // clinician sees the exact reason instead of a fleeting toast.
        const parsed = parseSafetyBlock(msg);
        const fallback = msg.replace(/^\d{3}:\s*/, "");
        setServerAllergenError(
          parsed && parsed.conflicts.length > 0
            ? `Server patient-safety gate refused ${parsed.conflicts.length} item${parsed.conflicts.length === 1 ? "" : "s"}. Remove or replace to continue.`
            : fallback ||
                "Order blocked by patient-safety guard. Review flagged items.",
        );
        setServerConflicts(parsed?.conflicts ?? null);
        document
          .getElementById("checkout-server-block")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        toast.error("Order blocked — patient-safety conflict");
        setConfirmOpen(false);
      } else if (status === 401) {
        // Session expired mid-checkout. Cart is preserved in localStorage
        // (Zustand persist key tanmatra:cart:v1), so /login?next=/checkout
        // will drop the user back here ready to retry.
        toast.error("Your session expired — sign in to finish your order", {
          description: "We've kept your cart safe.",
          action: {
            label: "Sign in",
            onClick: () => navigate("/login?next=/checkout"),
          },
        });
      } else if (
        status === 403 ||
        msg.includes("premium membership required")
      ) {
        toast.error("This order includes a Premium-only dish", {
          description:
            "Join Tanmatra Premium to unlock chef-table dishes and finish checkout.",
          action: {
            label: "See Premium",
            onClick: () => navigate("/premium"),
          },
        });
      } else {
        toast.error("Could not finalize order — please try again");
      }
      // User-correctable failure (bad slot, missing pickup, premium
      // gate, auth, validation): the user will edit the form before
      // retrying, so the body will change. Drop the pinned attempt
      // so the next click mints a fresh key+orderId and avoids a
      // 409 idempotency_key_mismatch from the server.
      // Genuine transient failures (network errors, 5xx) throw
      // without a status prefix and are handled by the generic
      // toast above; we KEEP the pinned attempt in that case so a
      // retry hits the server's replay cache. Detect by status≥400.
      if (status >= 400) {
        submitAttemptRef.current = null;
      }
      setIsProcessing(false);
      return;
    }

    // Record the company subsidy AFTER the order is finalized + paid. The
    // customer's card was charged `finalCharge` (already net of the subsidy),
    // so we bill the company exactly `subsidyApplied` — the amount that reduced
    // the card charge — keeping customer-charge + company-charge == the total.
    if (subsidyApplied > 0 && subsidy?.active && subsidy.company) {
      try {
        await corporateApi.chargeSubsidy(
          subsidy.company.id,
          subsidyApplied,
          orderId,
        );
      } catch {
        // Non-fatal: order is placed, just log a soft warning.
        toast.warning("Company subsidy could not be applied to this order");
      }
    }

    const selectedSlot = slots.find((s) => s.id === selectedSlotId);
    const slotLabel = selectedSlot
      ? `${new Date(selectedSlot.startsAt).toLocaleString([], {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        })} – ${new Date(selectedSlot.endsAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}`
      : undefined;

    addOrder({
      orderId,
      placedAt,
      etaAt,
      status: "placed",
      items: [...items],
      // Server-authoritative breakdown: subtotal is the server's post-discount
      // meal total (finalPaise) and deliveryFee is the server's fee. total is
      // the amount actually charged via Razorpay (chargePaise, net of
      // subsidy) — it excludes tip (never charged) and add-ons (recorded
      // separately, not part of the Razorpay charge).
      subtotal: serverSubtotalPaise,
      deliveryFee: serverDeliveryFeePaise,
      tip: effectiveTip,
      total: finalTotal,
      scheduledFor: preorderTomorrow ? tomorrowSlot.toISOString() : undefined,
      preorderDiscount: preorderTomorrow ? preorderDiscount : undefined,
      pickupDiscount: pickupDiscount > 0 ? pickupDiscount : undefined,
      fulfillmentType,
      pickupLocationName: selectedPickup?.name,
      deliverySlotLabel: fulfillmentType === "delivery" ? slotLabel : undefined,
      ecoPackagingOptIn: fulfillmentType === "delivery" && ecoPackagingOptIn,
      deliveryInstructions: deliveryInstructions.trim() || undefined,
      serverOrderId: serverOrderIdFromFinalize,
      address: {
        label: activeAddr.label,
        line1: activeAddr.line1,
        line2: activeAddr.line2,
        city: activeAddr.city,
        pincode: activeAddr.pincode,
        phone: activeAddr.phone,
      },
    });

    track("order_created", {
      orderId,
      total: finalTotal,
      itemCount: items.length,
      fulfillmentType,
      appliedCredits: creditApplied,
    });
    if (firstOrderDiscountApplied > 0) {
      track("first_order_offer_applied", {
        orderId,
        amountPaise: firstOrderDiscountApplied,
      });
    }

    if (referralAwarded) {
      toast.success("Referral reward unlocked for your friend");
    }

    // Terminal success — next checkout is a new intent. The R1 wizard draft
    // (form fields + step + checkout_id) is cleared with the cart.
    submitAttemptRef.current = null;
    clear();
    clearCheckoutDraft();
    setIsProcessing(false);
    setConfirmOpen(false);

    toast.success(`Order ${orderId} confirmed`, {
      description: `Rider will contact you on ${activeAddr.phone}`,
    });
    navigate(`/track?orderId=${encodeURIComponent(orderId)}`);
  };

  // Single-scroll stepper derivation (PR #247): payment once the confirm
  // dialog opens, otherwise address. The section-gated mobile stepping that
  // drove this off the wizard step is deferred (see the useWizardState note).
  // No address chosen yet → still "review"; jumping to "address" would falsely mark Review complete.
  const stepperStep: CheckoutStep = confirmOpen ? "payment" : activeAddr ? "address" : "review";
  const stepperAddressComplete =
    !!activeAddr &&
    (fulfillmentType === "delivery"
      ? selectedSlotId !== null
      : selectedPickupId !== null);

  return (
    <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white antialiased">
      <ProcessingLiveRegion isProcessing={isProcessing} orderRef={processingOrderRef} />
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div className="appbar">
          <button type="button" className="iconbtn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/cart"))} aria-label="Back">
            <i className="ph-bold ph-arrow-left" />
          </button>
          <div className="abt">Checkout</div>
        </div>

        {/* Bottom clearance must exceed the fixed mobile pay bar's footprint
            (it sits at bottom:4rem and is ~114px tall: FSSAI strip + total +
            Review&Pay + WhatsApp line), or the last section — the "Add a little
            extra" upsell rail — scrolls underneath it and gets clipped. */}
        <div className="content padx" style={{ paddingTop: 4, paddingBottom: "calc(220px + var(--safe-bottom))" }}>
          <ConflictsPanel
            panelId="checkout-server-block"
            serverMessage={serverAllergenError}
            serverConflicts={serverConflicts}
          />

          <div className="mb14 mt14">
            <CheckoutStepper
              current={stepperStep}
              reviewComplete={items.length > 0}
              addressComplete={stepperAddressComplete}
            />
          </div>

          {/* Delivery Address — mobile step 2 (Delivery) */}
          <div className={cn("rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] col gap16 mb14 p-4", mobileStepClass(1))}>
            <div className="fx ac gap8">
              <MapPin className="w-4 h-4" style={{ color: "var(--safb)" }} />
              <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50">Delivery Address</div>
            </div>

            <div className="col gap8">
              {savedAddresses.map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => setSelectedAddress(addr.id)}
                  className={selectedAddress === addr.id ? "opt on" : "opt"}
                  style={{ marginBottom: 0, alignItems: "flex-start" }}
                >
                  <div className="f1" style={{ minWidth: 0 }}>
                    <div className="fx ac gap8">
                      {addr.type === "home" && <Home className="w-3 h-3" style={{ color: "var(--safb)" }} />}
                      {addr.type === "work" && <Building2 className="w-3 h-3" style={{ color: "var(--safb)" }} />}
                      <span className="small fw6">{addr.label}</span>
                      <span className="pill" style={{ fontSize: 10, textTransform: "capitalize" }}>{addr.type}</span>
                    </div>
                    <p className="fine mt4">
                      {addr.line1}
                      {addr.line2 ? ` · ${addr.line2}` : ""} · {addr.city} {addr.pincode}
                    </p>
                    <p className="fine fx ac gap6 mt2">
                      <Phone className="w-2.5 h-2.5" />
                      Rider will call you on {addr.phone}
                    </p>
                  </div>
                </button>
              ))}

              {savedAddresses.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setShowNewAddressFlow(true)}
                  className="opt"
                  style={{ marginBottom: 0, flexDirection: "column", alignItems: "flex-start", gap: 4, borderStyle: "dashed", borderColor: "var(--saf)", background: "var(--safd)" }}
                >
                  <p className="small fw6 fx ac gap6">
                    <Plus className="w-3.5 h-3.5" style={{ color: "var(--safb)" }} />
                    Add your delivery address
                  </p>
                  <p className="fine">Noida · fresh in {DELIVERY_ETA_TEXT}</p>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewAddressFlow(true)}
                  className="linkq"
                  style={{ padding: "8px 0" }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New Address
                </button>
              )}
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--ln)", margin: 0 }} />
            <div className="col gap8">
              <div className="fx ac gap8">
                <NotebookPen className="w-3.5 h-3.5" style={{ color: "var(--safb)" }} />
                <span className="small fw6">Notes for the rider</span>
                {activeAddrLabel && savedInstructions[activeAddrLabel] && (
                  <span className="pill sg" style={{ marginLeft: "auto", fontSize: 10 }}>Saved for this address</span>
                )}
              </div>
              <textarea
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                placeholder="e.g. Gate code 4421, leave at door, call on arrival"
                maxLength={512}
                className="inp"
                style={{ display: "block", height: "auto", minHeight: 60, padding: "10px 14px", lineHeight: 1.4 }}
              />
              <p className="fine">
                We'll remember these notes for{" "}
                <span style={{ color: "var(--tx)" }}>{activeAddrLabel ?? "this address"}</span>{" "}
                so you don't have to type them again.
              </p>
            </div>
          </div>

          {/* Fulfillment — mobile step 2 (Delivery) */}
          <div id="checkout-fulfillment" className={cn("rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] col gap16 mb14 scroll-mt-24 p-4", mobileStepClass(1))}>
            <div className="fx ac jb gap8">
              <div className="fx ac gap8">
                <Truck className="w-4 h-4" style={{ color: "var(--safb)" }} />
                <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50">Get it your way</div>
              </div>
              {etaMinutes != null && fulfillmentType === "delivery" && !preorderTomorrow && (
                <span className="pill sg">
                  <Timer className="w-3 h-3" />
                  ~{etaMinutes} min
                </span>
              )}
            </div>
            <div className="grid gap8" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <button
                type="button"
                onClick={() => setFulfillmentType("delivery")}
                className={fulfillmentType === "delivery" ? "opt on" : "opt"}
                style={{ marginBottom: 0, flexDirection: "column", alignItems: "flex-start", gap: 4 }}
              >
                <div className="fx ac gap6">
                  <Truck className="w-3.5 h-3.5" style={{ color: "var(--safb)" }} />
                  <span className="small fw6">Doorstep delivery</span>
                </div>
                <p className="fine">Reserve a 30-minute window</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFulfillmentType("pickup");
                  setSelectedSlotId(null);
                  setPreorderTomorrow(false);
                }}
                disabled={pickupLocations.length === 0}
                className={fulfillmentType === "pickup" ? "opt on" : "opt"}
                style={{ marginBottom: 0, flexDirection: "column", alignItems: "flex-start", gap: 4, opacity: pickupLocations.length === 0 ? 0.5 : undefined }}
              >
                <div className="fx ac gap6">
                  <Store className="w-3.5 h-3.5" style={{ color: "var(--safb)" }} />
                  <span className="small fw6">Partner pickup</span>
                </div>
                <p className="fine sagec">
                  Save up to <span className="tnm-data">₹{Math.max(0, ...pickupLocations.map((p) => p.discountPaise)) / 100 || 30}</span>
                </p>
              </button>
            </div>

            {fulfillmentType === "delivery" && (
              <div className="col gap12">
                <div className="grid gap6" style={{ gridTemplateColumns: "1fr 1fr", padding: 4, background: "var(--s2)", borderRadius: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryMode("now");
                      setSelectedSlotId(null);
                    }}
                    style={{ height: 34, borderRadius: 8, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", background: deliveryMode === "now" ? "var(--s1)" : "transparent", color: deliveryMode === "now" ? "var(--tx)" : "var(--mut)" }}
                  >
                    Deliver Now
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryMode("schedule");
                      if (slots.length > 0 && !selectedSlotId) {
                        setSelectedSlotId(slots[0].id);
                      }
                    }}
                    style={{ height: 34, borderRadius: 8, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", background: deliveryMode === "schedule" ? "var(--s1)" : "transparent", color: deliveryMode === "schedule" ? "var(--tx)" : "var(--mut)" }}
                  >
                    Schedule Later
                  </button>
                </div>

                {deliveryMode === "now" ? (
                  <div className="note" style={{ flexDirection: "column", alignItems: "flex-start", background: "var(--saged)", borderColor: "color-mix(in oklab, var(--sage) 35%, transparent)", color: "var(--sage)" }}>
                    <div className="fx ac gap8" style={{ width: "100%" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sage)", flex: "none" }} />
                      <span className="small fw6" style={{ color: "var(--tx)" }}>Deliver ASAP</span>
                      {etaMinutes != null && (
                        <span className="pill sg" style={{ marginLeft: "auto", fontSize: 11 }}>~{etaMinutes} MINS</span>
                      )}
                    </div>
                    <p className="fine">
                      Your order goes straight into our active kitchen queue. Rider pre-allocation is active. Packaged in a double-insulated, tamper-evident bag.
                    </p>
                  </div>
                ) : (
                  <div className="col gap8">
                    <div className="lab">Pick a delivery slot</div>
                    {loadingSlots ? (
                      <div className="col gap8">
                        <div className="skel" style={{ height: 48 }} />
                        <div className="skel" style={{ height: 48 }} />
                      </div>
                    ) : slotsError || slots.length === 0 ? (
                      <div className="card tc col gap8" style={{ padding: 12 }}>
                        <p className="fine">
                          {slotsError ? "Failed to load delivery slots." : "No slots available today."}
                        </p>
                        <button
                          type="button"
                          onClick={fetchSlots}
                          className="btn btn-g"
                          style={{ height: 34, alignSelf: "center", fontSize: 12 }}
                        >
                          Retry loading slots
                        </button>
                      </div>
                    ) : (
                      <div
                        className="grid gap8"
                        style={{ gridTemplateColumns: "1fr 1fr", maxHeight: 224, overflowY: "auto", ...(slotErrorMsg ? { outline: "1px solid var(--dgr)", borderRadius: 8, padding: 4 } : {}) }}
                        aria-invalid={slotErrorMsg ? true : undefined}
                        aria-describedby={slotErrorMsg ? "slot-error" : undefined}
                      >
                        {slots.map((slot) => {
                          const start = new Date(slot.startsAt);
                          const end = new Date(slot.endsAt);
                          const day = start.toLocaleDateString([], {
                            weekday: "short",
                          });
                          const window = `${start.toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })} – ${end.toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}`;
                          const selected = selectedSlotId === slot.id;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              disabled={slot.full}
                              onClick={() => {
                                setSelectedSlotId(slot.id);
                                if (slotErrorMsg) setSlotErrorMsg(null);
                              }}
                              className={selected ? "opt on" : "opt"}
                              style={{ marginBottom: 0, padding: 8, flexDirection: "column", alignItems: "flex-start", gap: 2, opacity: slot.full ? 0.4 : undefined }}
                            >
                              <div className="small fw6">{day}</div>
                              <div className="mono" style={{ fontSize: 11 }}>{window}</div>
                              <div className="fine" style={{ fontSize: 9 }}>
                                {slot.full ? "Full" : `${slot.remaining} left`}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {slotErrorMsg && (
                      <p id="slot-error" role="alert" className="fine dgrc fx ac gap6">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {slotErrorMsg}
                      </p>
                    )}
                    {isPreorderSlot && (
                      <p className="note" style={{ background: "var(--saged)", borderColor: "color-mix(in oklab, var(--sage) 35%, transparent)", color: "var(--sage)" }}>
                        <Tag className="w-3.5 h-3.5" />
                        <span>Pre-order discount active: 5% off meals applied!</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {fulfillmentType === "pickup" && (
              <div className="col gap8">
                <div className="lab">Choose a pickup partner</div>
                <div className="col gap8" style={{ maxHeight: 224, overflowY: "auto" }}>
                  {pickupLocations.map((loc) => {
                    const selected = selectedPickupId === loc.id;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setSelectedPickupId(loc.id)}
                        className={selected ? "opt on" : "opt"}
                        style={{ marginBottom: 0, flexDirection: "column", alignItems: "flex-start", gap: 4 }}
                      >
                        <div className="fx ac gap8" style={{ width: "100%" }}>
                          <Store className="w-3 h-3" style={{ color: "var(--safb)" }} />
                          <span className="small fw6">{loc.name}</span>
                          <span className="pill sg tnm-data" style={{ marginLeft: "auto", fontSize: 10 }}>
                            -₹{(loc.discountPaise / 100).toFixed(0)}
                          </span>
                        </div>
                        <p className="fine">
                          {loc.addressLine}, {loc.city} {loc.pincode}
                        </p>
                        {loc.hours && (
                          <p className="fine">Open {loc.hours}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {fulfillmentType === "delivery" && (
              <div className="note" style={{ alignItems: "center", justifyContent: "space-between", background: "var(--saged)", borderColor: "color-mix(in oklab, var(--sage) 35%, transparent)", color: "var(--sage)" }}>
                <div className="fx gap8" style={{ minWidth: 0, alignItems: "flex-start" }}>
                  <Leaf className="w-4 h-4" style={{ color: "var(--sage)", flexShrink: 0, marginTop: 2 }} />
                  <div style={{ minWidth: 0 }}>
                    <p className="small fw6" style={{ color: "var(--tx)" }}>Reusable eco packaging</p>
                    <p className="fine">Return clean containers on your next order to earn {formatPrice(2000)} credit</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={ecoPackagingOptIn}
                  className={ecoPackagingOptIn ? "sw on" : "sw"}
                  onClick={() => setEcoPackagingOptIn(!ecoPackagingOptIn)}
                />
              </div>
            )}
          </div>

          {/* Rider tip is intentionally not offered here: there is no
              server-side capture path for it (Razorpay only ever bills
              chargePaise), so presenting a tip selector would collect an
              amount that's never actually charged. Re-add once a real
              capture mechanism exists. */}

          {/* Payment — mobile step 3 (Payment) */}
          <div className={cn("rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] col gap12 mb14 p-4", mobileStepClass(2))}>
            <div className="fx ac gap8">
              <CreditCard className="w-4 h-4" style={{ color: "var(--safb)" }} />
              <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50">Payment</div>
            </div>
            <div
              className="fx ac gap12"
              style={{ padding: 12, borderRadius: 10, border: "1px solid var(--saf)", background: "var(--safd)" }}
              title="Razorpay handles your payment securely. Tanmatra never sees your card or UPI details."
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "color-mix(in srgb, var(--tnm-action) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <CreditCard className="w-4 h-4" style={{ color: "var(--safb)" }} />
              </div>
              <div className="f1">
                <p className="small fw6">Razorpay Secure Checkout</p>
                <div className="fx ac gap6 wrap mt2">
                  <span className="upi">UPI</span>
                  <span className="fine">Cards · Net Banking · Wallets · COD · PCI-DSS L1</span>
                </div>
              </div>
              <ShieldCheck className="w-4 h-4" style={{ color: "var(--sage)", marginLeft: "auto" }} aria-label="Encrypted payment" />
            </div>

            <Link
              to={`/subscribe?fromCart=1&cadence=weekly`}
              className="note"
              style={{ alignItems: "flex-start", background: "var(--safd)", borderColor: "var(--saf)", color: "var(--tx)" }}
            >
              <Sparkles className="w-4 h-4" style={{ color: "var(--safb)", marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
              <div className="f1" style={{ minWidth: 0 }}>
                <p className="small fw6">Make this a weekly subscription — save {cadenceDiscountPct("weekly")}%</p>
                <p className="fine mt2">Skip checkout next week. Pause, swap or cancel any time.</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5" style={{ color: "var(--safb)", marginTop: 4, flexShrink: 0 }} aria-hidden="true" />
            </Link>
          </div>

          {/* Add-ons rail (legacy widget) — mobile step 1 (Review) */}
          <div className={cn("mb14", mobileStepClass(0))}>
            <AddOnRail
              cartTags={cartTags}
              selected={selectedAddons}
              onChange={setSelectedAddons}
            />
          </div>

          {/* Free-delivery tracker — mobile step 1 (Review) */}
          {fulfillmentType !== "pickup" && (
            <div className={cn("banner mb14", mobileStepClass(0))} style={hasFreeDelivery ? { background: "var(--saged)", borderColor: "var(--sage)" } : undefined}>
              <div className="fx ac jb mb8">
                <span className="lab fx ac gap6">
                  {hasFreeDelivery ? <ShieldCheck className="w-4 h-4" style={{ color: "var(--sage)" }} /> : <Zap className="w-4 h-4" style={{ color: "var(--safb)" }} />}
                  Free Delivery Tracker
                </span>
                <span className="small fw7" style={{ color: hasFreeDelivery ? "var(--sage)" : "var(--tx)" }}>
                  {hasFreeDelivery ? (
                    "Free Delivery Unlocked!"
                  ) : (
                    <>
                      Add <span className="tnm-data">₹{Math.ceil(amountToFreeDelivery / 100)}</span> more for free delivery
                    </>
                  )}
                </span>
              </div>
              <div className="pbar">
                <b style={{ width: `${freeDeliveryProgress}%`, background: hasFreeDelivery ? "var(--sage)" : "var(--saf)" }} />
              </div>
              {!hasFreeDelivery && (
                <p className="fine mt6">
                  💡 Tip: Add an RD-curated drink or snack above to reach {formatPrice(FREE_DELIVERY_THRESHOLD)} and save {formatPrice(DELIVERY_FEE)} on delivery!
                </p>
              )}
            </div>
          )}

          {/* Order Summary (desktop bill column) — mobile step 1 (Review) */}
          <div className={cn("rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] col gap16 mb14 p-4", mobileStepClass(0))}>
            <div className="fx ac gap8">
              <ClipboardList className="w-4 h-4" style={{ color: "var(--safb)" }} />
              <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50">Order Summary</div>
            </div>

            <div className="col gap12">
              {items.map((item) => (
                <div key={item.lineId} className="fx gap12" style={{ alignItems: "flex-start" }}>
                  <img src={item.image} alt={item.name} loading="lazy" onError={onDishImageError} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid var(--ln)", flex: "none" }} />
                  <div className="f1" style={{ minWidth: 0 }}>
                    <p className="small fw6">
                      {item.name}
                      {item.recipient && (
                        <span className="safc" style={{ fontSize: 10, fontWeight: 600, marginLeft: 4 }}>
                          (For {item.recipient})
                        </span>
                      )}
                    </p>
                    <p className="fine">Qty: {item.quantity}</p>
                    {item.customizations.length > 0 && (
                      <div className="fx wrap gap6 mt4">
                        {item.customizations.map((c) => (
                          <span key={c} className="pill" style={{ fontSize: 9 }}>
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="price" style={{ fontSize: 12, flex: "none" }}>
                    {formatPrice(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--ln)", margin: 0 }} />

            {activeAddr && (
              <div className="col gap6">
                <div className="fine fx gap8" style={{ alignItems: "flex-start" }}>
                  <MapPin className="w-3 h-3" style={{ color: "var(--safb)", flexShrink: 0, marginTop: 2 }} />
                  <span>
                    {activeAddr.label} · {activeAddr.line1} · {activeAddr.city}
                  </span>
                </div>
                <div className="fine fx gap8" style={{ alignItems: "flex-start" }}>
                  <Phone className="w-3 h-3" style={{ color: "var(--safb)", flexShrink: 0, marginTop: 2 }} />
                  <span>Rider will contact you on {activeAddr.phone}</span>
                </div>
              </div>
            )}

            <hr style={{ border: "none", borderTop: "1px solid var(--ln)", margin: 0 }} />

            <div className="col gap8">
              <div className="billrow" style={{ padding: 0 }}>
                <span>Subtotal</span>
                <span className="mono" style={{ color: "var(--tx)" }}>{formatPrice(subtotal)}</span>
              </div>
              {gst > 0 && (
                <div className="billrow" style={{ padding: 0 }}>
                  <span>GST</span>
                  <span className="mono" style={{ color: "var(--tx)" }}>{formatPrice(gst)}</span>
                </div>
              )}
              {preorderDiscount > 0 && (
                <div className="billrow" style={{ padding: 0 }}>
                  <span className="sagec fx ac gap6">
                    <CalendarClock className="w-3 h-3" /> Pre-order discount (5%)
                  </span>
                  <span className="mono sagec">-{formatPrice(preorderDiscount)}</span>
                </div>
              )}
              {firstOrderDiscount > 0 && (
                <div className="billrow" style={{ padding: 0 }}>
                  <span className="safc fx ac gap6">
                    <Gift className="w-3 h-3" /> First-order offer ({offerPercent}% up to {formatPrice(offerCapPaise)})
                  </span>
                  <span className="mono safc">-{formatPrice(firstOrderDiscount)}</span>
                </div>
              )}
              {pickupDiscount > 0 && (
                <div className="billrow" style={{ padding: 0 }}>
                  <span className="sagec fx ac gap6">
                    <Store className="w-3 h-3" /> Partner pickup
                  </span>
                  <span className="mono sagec">-{formatPrice(pickupDiscount)}</span>
                </div>
              )}
              <div className="billrow" style={{ padding: 0 }}>
                <span>{fulfillmentType === "pickup" ? "Pickup" : "Delivery"}</span>
                <span className={deliveryFee === 0 ? "sagec" : "mono"} style={deliveryFee === 0 ? undefined : { color: "var(--tx)" }}>
                  {fulfillmentType === "pickup"
                    ? "Self-collect"
                    : deliveryFee === 0
                      ? "FREE"
                      : formatPrice(deliveryFee)}
                </span>
              </div>
              {effectiveTip > 0 && (
                <div className="billrow" style={{ padding: 0 }}>
                  <span className="fx ac gap6">
                    <Bike className="w-3 h-3" />
                    Rider Tip
                  </span>
                  <span className="mono safc">{formatPrice(effectiveTip)}</span>
                </div>
              )}
              {creditBalance > 0 && (
                <div className="note" style={{ alignItems: "center", justifyContent: "space-between", background: "var(--saged)", borderColor: "color-mix(in oklab, var(--sage) 35%, transparent)", color: "var(--sage)" }}>
                  <div className="fx ac gap8" style={{ minWidth: 0 }}>
                    <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--sage)", flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <p className="small" style={{ color: "var(--tx)" }}>Apply credits</p>
                      <p className="fine">Wallet: {formatPrice(creditBalance)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={applyCredits}
                    className={applyCredits ? "sw on" : "sw"}
                    onClick={() => setApplyCredits(!applyCredits)}
                  />
                </div>
              )}
              {creditApplied > 0 && (
                <div className="billrow" style={{ padding: 0 }}>
                  <span className="sagec fx ac gap6">
                    <Sparkles className="w-3 h-3" /> Credits applied
                  </span>
                  <span className="mono sagec">-{formatPrice(creditApplied)}</span>
                </div>
              )}

              {subsidy?.active && subsidy.company && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]" style={{ padding: 10 }}>
                  <div className="fx ac jb gap8">
                    <div className="fx ac gap6 small" style={{ color: "var(--tx)" }}>
                      <Building2Icon className="w-3.5 h-3.5" style={{ color: "var(--safb)" }} />
                      <span className="fw6">{subsidy.company.name} subsidy</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={applySubsidy}
                      className={applySubsidy ? "sw on" : "sw"}
                      onClick={() => setApplySubsidy(!applySubsidy)}
                    />
                  </div>
                  <p className="fine mt6">
                    {formatPrice(subsidy.remainingPaise ?? 0)} of{" "}
                    {formatPrice(subsidy.monthlyBudgetPaise ?? 0)} left this month
                  </p>
                  {subsidyAvailable > 0 && (
                    <div className="billrow" style={{ padding: "6px 0 0" }}>
                      <span className="sagec fx ac gap6">
                        <Building2Icon className="w-3 h-3" /> Company pays
                      </span>
                      <span className="mono sagec">-{formatPrice(subsidyAvailable)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]" style={{ padding: 10 }}>
                <div className="fx ac gap6 small" style={{ color: "var(--tx)" }}>
                  <Ticket className="w-3.5 h-3.5" style={{ color: "var(--safb)" }} />
                  <span className="fw6">Have a voucher?</span>
                </div>
                <div className="fx gap6 mt6">
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => {
                      const next = e.target.value.toUpperCase();
                      setVoucherCode(next);
                      if (voucherError && next.length < voucherCode.length) setVoucherError(null);
                    }}
                    placeholder="VOUCHER CODE"
                    className="inp"
                    // 16px floor: any smaller and iOS Safari zoom-jumps the
                    // whole money screen the moment this field is focused.
                    style={{ flex: 1, minWidth: 0, height: 44, textTransform: "uppercase", letterSpacing: ".08em", fontSize: 16, ...(voucherError ? { borderColor: "var(--dgr)" } : {}) }}
                    disabled={redeemingVoucher}
                    aria-invalid={voucherError ? true : undefined}
                    aria-describedby={voucherError ? "voucher-error" : undefined}
                  />
                  <button
                    type="button"
                    onClick={handleRedeemVoucher}
                    disabled={redeemingVoucher || !voucherCode.trim()}
                    className={redeemingVoucher || !voucherCode.trim() ? "btn btn-p dis" : "btn btn-p"}
                    style={{ height: 34, padding: "0 12px", fontSize: 11 }}
                  >
                    <Gift className="w-3 h-3" />
                    {redeemingVoucher ? "..." : "Redeem"}
                  </button>
                </div>
                {voucherError && (
                  <p id="voucher-error" role="alert" className="fine dgrc fx ac gap6 mt6">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {voucherError}
                  </p>
                )}
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--ln)", margin: 0 }} />

            {(() => {
              const totalSavings =
                preorderDiscount +
                firstOrderDiscount +
                pickupDiscount +
                creditApplied +
                subsidyAvailable;
              if (totalSavings <= 0) return null;
              return (
                <details className="note" style={{ display: "block", padding: 0, background: "var(--saged)", borderColor: "color-mix(in oklab, var(--sage) 35%, transparent)", color: "var(--sage)" }}>
                  <summary className="fx ac jb" style={{ padding: "8px 12px", cursor: "pointer", listStyle: "none" }}>
                    <span className="fx ac gap8">
                      <Tag className="w-3.5 h-3.5" style={{ color: "var(--sage)" }} />
                      <span className="small fw6" style={{ color: "var(--sage)" }}>
                        You saved {formatPrice(totalSavings)} on this order
                      </span>
                    </span>
                    <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--sage)" }} />
                  </summary>
                  <div className="col gap6" style={{ padding: "4px 12px 10px", borderTop: "1px solid color-mix(in oklab, var(--sage) 20%, transparent)", fontSize: 11, color: "var(--mut)" }}>
                    {preorderDiscount > 0 && (
                      <div className="fx jb">
                        <span>Pre-order discount (5%)</span>
                        <span className="mono sagec">-{formatPrice(preorderDiscount)}</span>
                      </div>
                    )}
                    {firstOrderDiscount > 0 && (
                      <div className="fx jb">
                        <span>First-order offer ({offerPercent}% up to {formatPrice(offerCapPaise)})</span>
                        <span className="mono safc">-{formatPrice(firstOrderDiscount)}</span>
                      </div>
                    )}
                    {pickupDiscount > 0 && (
                      <div className="fx jb">
                        <span>Pickup partner discount</span>
                        <span className="mono sagec">-{formatPrice(pickupDiscount)}</span>
                      </div>
                    )}
                    {creditApplied > 0 && (
                      <div className="fx jb">
                        <span>Loyalty credits</span>
                        <span className="mono sagec">-{formatPrice(creditApplied)}</span>
                      </div>
                    )}
                    {subsidyAvailable > 0 && (
                      <div className="fx jb">
                        <span>Company subsidy</span>
                        <span className="mono sagec">-{formatPrice(subsidyAvailable)}</span>
                      </div>
                    )}
                  </div>
                </details>
              );
            })()}

            <div className="fx jb" style={{ alignItems: "baseline" }} role="status" aria-live="polite" aria-atomic="true">
              <span className="text-[15px] font-semibold text-white/90">Total</span>
              <div className="tl">
                <span className="price" style={{ fontSize: 20, color: "var(--tnm-action)" }}>{formatPrice(razorpayTotal)}</span>
                <p className="fine">Inclusive of all taxes</p>
              </div>
            </div>

            {checkoutBlocked && checkoutBlockedReason && (
              <p className="note tc" style={{ display: "block", background: "color-mix(in oklab, var(--color-error) 12%, transparent)", borderColor: "color-mix(in oklab, var(--color-error) 35%, transparent)", color: "var(--color-error)" }}>
                {checkoutBlockedReason}
              </p>
            )}

            {payFailure && (
              <div
                className="note"
                role="alert"
                style={{ alignItems: "flex-start", background: "var(--dgrd)", borderColor: "color-mix(in oklab, var(--dgr) 35%, transparent)" }}
              >
                <AlertTriangle className="w-4 h-4" aria-hidden="true" style={{ color: "var(--dgr)", flexShrink: 0, marginTop: 2 }} />
                <div className="f1" style={{ minWidth: 0 }}>
                  <p className="small fw6" style={{ color: "var(--tx)" }}>{payFailure.message}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPayFailure(null);
                      void handlePlaceOrderClick();
                    }}
                    disabled={checkoutBlocked || payBlockedReason !== null}
                    className={
                      checkoutBlocked || payBlockedReason !== null
                        ? "btn btn-g mt8 dis"
                        : "btn btn-g mt8"
                    }
                    title={checkoutBlocked ? checkoutBlockedReason ?? undefined : payBlockedReason ?? undefined}
                    style={{ height: 32, padding: "0 12px", fontSize: 12 }}
                  >
                    Try again
                  </button>
                  {payBlockedReason && (
                    <PayBlockedNotice reason={payBlockedReason} style={{ marginTop: 6, justifyContent: "flex-start" }} />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPayFailure(null)}
                  aria-label="Dismiss payment notice"
                  className="iconbtn"
                  style={{ width: 24, height: 24, flexShrink: 0 }}
                >
                  <i className="ph-bold ph-x" style={{ fontSize: 12 }} />
                </button>
              </div>
            )}

            <div className="hidden lg:block">
              <p className="fine tc" style={{ fontSize: 10.5, color: "var(--mut)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 8 }}>
                FSSAI-licensed · ISO 22000 kitchen · RD-designed menu
              </p>
              {payBlockedReason && (
                <PayBlockedNotice
                  reason={payBlockedReason}
                  style={{ marginBottom: 8 }}
                />
              )}
              {isProcessing && (
                <PayProcessingNotice
                  orderRef={processingOrderRef}
                  style={{ marginBottom: 8 }}
                />
              )}
              <button
                onClick={handlePlaceOrderClick}
                disabled={checkoutBlocked || payBlockedReason !== null}
                className={checkoutBlocked || payBlockedReason !== null ? "btn btn-p btn-blk dis" : "btn btn-p btn-blk"}
                title={checkoutBlocked ? checkoutBlockedReason ?? undefined : payBlockedReason ?? undefined}
              >
                <CreditCard className="w-4 h-4" />
                {checkoutBlocked
                  ? "Blocked by patient safety"
                  : `Review & Pay ${formatPrice(razorpayTotal)}`}
              </button>
              <a
                href="https://wa.me/919289213115"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("support_click", { channel: "whatsapp", placement: "checkout_desktop_summary" })}
                className="fine fx ac jc gap6 mt8"
                style={{ color: "var(--mut)" }}
              >
                <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--sage)" }} />
                Need checkout help? WhatsApp Support
              </a>
            </div>

            <p className="fine tc fx ac jc gap6">
              <ShieldCheck className="w-3 h-3" style={{ color: "var(--sage)" }} />
              256-bit SSL encryption · Razorpay secure
            </p>
            <p className="fine tc" style={{ marginTop: -8 }}>
              <Link to="/refunds" style={{ color: "var(--mut)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                Refund &amp; cancellation policy
              </Link>
            </p>
          </div>
        </div>

        {/* Mobile sticky bottom action bar */}
        <div className="lg:hidden">
          <V2MobilePayBar
            subtotal={subtotal}
            gst={gst}
            addonTotal={addonTotal}
            deliveryFee={deliveryFee}
            fulfillmentType={fulfillmentType}
            preorderDiscount={preorderDiscount}
            firstOrderDiscount={firstOrderDiscount}
            pickupDiscount={pickupDiscount}
            creditApplied={creditApplied}
            subsidyAvailable={subsidyAvailable}
            effectiveTip={effectiveTip}
            razorpayTotal={razorpayTotal}
            checkoutBlocked={checkoutBlocked}
            checkoutBlockedReason={checkoutBlockedReason}
            payBlockedReason={payBlockedReason}
            isProcessing={isProcessing}
            processingOrderRef={processingOrderRef}
            onPay={handlePlaceOrderClick}
            mobileStep={null}
            onContinue={handleMobileContinue}
          />
        </div>

        {/* Guest Phone + OTP Verification Modal */}
        {showGuestAuthDialog && (
          <div
            className="bg-[color-mix(in_srgb,var(--tnm-surface-ink)_95%,transparent)] backdrop-blur-md"
            style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={() => { if (!guestIsVerifying) setShowGuestAuthDialog(false); }}
          >
            <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4" style={{ maxWidth: 360, width: "100%" }} onClick={(e) => e.stopPropagation()}>
              <div className="fx ac gap8">
                <Phone className="w-5 h-5" style={{ color: "var(--safb)" }} />
                <div className="h2" style={{ fontSize: 18 }}>
                  {guestAuthStep === "welcome" ? "Welcome to Tanmatra!" : "Verify Mobile"}
                </div>
              </div>
              <p className="fine mt6">
                {guestAuthStep === "phone" && "Enter your mobile number to get a verification code."}
                {guestAuthStep === "code" && `We've sent a 6-digit code to ${guestCountryCode} ${guestPhone}.`}
                {guestAuthStep === "welcome" && "We need a few details to personalize your clinical kitchen experience."}
              </p>

              {guestAuthStep === "phone" && (
                <div className="col gap16 mt14">
                  <div className="col gap8">
                    <label htmlFor="guest-phone-input" className="lab">Mobile Number</label>
                    <div className="fx gap8">
                      <div style={{ width: 64, height: 46, borderRadius: 10, background: "var(--s3)", border: "1px solid var(--ln2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "var(--tx)", userSelect: "none", flex: "none" }}>
                        {guestCountryCode}
                      </div>
                      <div className="posrel" style={{ flex: 1 }}>
                        <input
                          id="guest-phone-input"
                          placeholder="Enter 10-digit mobile number"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          inputMode="tel"
                          autoComplete="tel-national"
                          className="inp"
                          style={{ width: "100%", paddingRight: 36, ...(guestPhone.length === 10 ? { borderColor: "var(--sage)" } : {}) }}
                        />
                        {guestPhone.length === 10 && (
                          <i
                            className="ph-fill ph-check-circle"
                            aria-hidden="true"
                            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--sage)", fontSize: 18, pointerEvents: "none" }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleSendGuestOtp}
                    disabled={guestIsSending || guestPhone.length < 10}
                    className={guestIsSending || guestPhone.length < 10 ? "btn btn-p btn-blk dis" : "btn btn-p btn-blk"}
                  >
                    {guestIsSending ? "Sending code…" : "Send Verification Code"}
                  </button>
                </div>
              )}

              {guestAuthStep === "code" && (
                <div className="col gap16 mt14">
                  <div className="col gap8">
                    <label htmlFor="guest-otp-input" className="lab">Verification Code</label>
                    <div
                      className={otpShakeOn ? "fx gap8 animate-shake" : "fx gap8"}
                      onAnimationEnd={() => setOtpShakeOn(false)}
                    >
                      {Array.from({ length: 6 }, (_, i) => (
                        <input
                          key={i}
                          ref={(el) => {
                            otpBoxRefs.current[i] = el;
                          }}
                          id={i === 0 ? "guest-otp-input" : undefined}
                          value={guestOtpCode[i] ?? ""}
                          onChange={(e) => handleOtpBoxChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpBoxKeyDown(i, e)}
                          onPaste={(e) => handleOtpPaste(i, e)}
                          onFocus={(e) => {
                            setOtpFocusIdx(i);
                            e.target.select();
                          }}
                          onBlur={() => setOtpFocusIdx((cur) => (cur === i ? null : cur))}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          // one-time-code on the FIRST box only → WebOTP /
                          // keyboard OTP suggestion lands there and the
                          // multi-digit branch distributes it. No maxLength:
                          // it would truncate that autofill to one digit.
                          autoComplete={i === 0 ? "one-time-code" : "off"}
                          autoFocus={i === 0}
                          aria-label={`OTP digit ${i + 1} of 6`}
                          aria-invalid={guestOtpError ? true : undefined}
                          aria-describedby={guestOtpError ? "guest-otp-error" : undefined}
                          className="inp mono tnm-data"
                          style={{
                            flex: 1,
                            minWidth: 0,
                            width: "auto",
                            padding: 0,
                            textAlign: "center",
                            fontSize: 18,
                            ...(guestOtpError ? { borderColor: "var(--dgr)" } : {}),
                            // Deterministic visible focus ring — the theme
                            // resets the native outline on .tnm2 inputs.
                            ...(otpFocusIdx === i
                              ? {
                                  borderColor: guestOtpError ? "var(--dgr)" : "var(--safb)",
                                  boxShadow: "0 0 0 2px var(--safd)",
                                }
                              : {}),
                          }}
                        />
                      ))}
                    </div>
                    {guestOtpError && (
                      <p id="guest-otp-error" role="alert" className="fine" style={{ color: "var(--dgr)" }}>
                        {guestOtpError}
                      </p>
                    )}
                  </div>
                  <div className="fx ac jb fine">
                    <span>Didn't receive code?</span>
                    {guestResendIn > 0 ? (
                      <span>Resend in {guestResendIn}s</span>
                    ) : (
                      <button type="button" onClick={handleSendGuestOtp} className="safc fw6">
                        Resend code
                      </button>
                    )}
                  </div>
                  <div className="grid gap8" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <button
                      onClick={() => {
                        // Leaving the code step — drop transient OTP state so a
                        // return visit doesn't show a stale error/shake.
                        setGuestOtpError(null);
                        setOtpShakeOn(false);
                        setGuestAuthStep("phone");
                      }}
                      disabled={guestIsVerifying}
                      className="btn btn-g"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleVerifyGuestOtp}
                      disabled={guestIsVerifying || guestOtpCode.length < 6}
                      className={guestIsVerifying || guestOtpCode.length < 6 ? "btn btn-p dis" : "btn btn-p"}
                    >
                      {guestIsVerifying ? "Verifying…" : "Verify & Continue"}
                    </button>
                  </div>
                </div>
              )}

              {guestAuthStep === "welcome" && (
                <div className="col gap16 mt14">
                  <div className="col gap12">
                    <div className="col gap8">
                      <label htmlFor="guest-name-input" className="lab">First Name</label>
                      <input
                        id="guest-name-input"
                        placeholder="Enter your first name"
                        value={guestFirstName}
                        onChange={(e) => setGuestFirstName(e.target.value)}
                        className="inp"
                      />
                    </div>
                    <div className="col gap8">
                      <label htmlFor="guest-email-input" className="lab">Email Address (Optional)</label>
                      <input
                        id="guest-email-input"
                        placeholder="Enter email for receipts"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        type="email"
                        className="inp"
                      />
                    </div>
                  </div>
                  <div className="grid gap8" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <button onClick={handleGuestAuthSuccess} className="btn btn-g">
                      Skip
                    </button>
                    <button
                      onClick={handleGuestAuthSuccess}
                      disabled={!guestFirstName.trim()}
                      className={!guestFirstName.trim() ? "btn btn-p dis" : "btn btn-p"}
                    >
                      Let's Eat
                    </button>
                  </div>
                </div>
              )}
              <div id="recaptcha-container" className="fixed bottom-0 right-0 z-50 pointer-events-none"></div>
            </div>
          </div>
        )}

        {/* Payment confirmation modal */}
        {confirmOpen && (
          <div
            className="bg-[color-mix(in_srgb,var(--tnm-surface-ink)_95%,transparent)] backdrop-blur-md"
            style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={() => { if (!isProcessing) setConfirmOpen(false); }}
          >
            <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4" style={{ maxWidth: 400, width: "100%" }} onClick={(e) => e.stopPropagation()}>
              <div className="fx ac gap8">
                <ShieldCheck className="w-5 h-5" style={{ color: "var(--sage)" }} />
                <div className="h2" style={{ fontSize: 18 }}>Confirm Payment</div>
              </div>
              <p className="fine mt6">
                You will be charged <span className="safc fw7 mono">{formatPrice(razorpayTotal)}</span> via Razorpay.
                Your rider will contact you on <span style={{ color: "var(--tx)" }}>{activeAddr?.phone}</span> after pickup.
              </p>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] mt14" style={{ padding: 12 }}>
                <div className="billrow" style={{ padding: "4px 0" }}>
                  <span>Subtotal ({items.length} item{items.length === 1 ? "" : "s"})</span>
                  <span className="mono" style={{ color: "var(--tx)" }}>{formatPrice(subtotal)}</span>
                </div>
                {preorderDiscount > 0 && (
                  <div className="billrow" style={{ padding: "4px 0" }}>
                    <span>Pre-order discount</span>
                    <span className="mono sagec">-{formatPrice(preorderDiscount)}</span>
                  </div>
                )}
                {pickupDiscount > 0 && (
                  <div className="billrow" style={{ padding: "4px 0" }}>
                    <span>Pickup discount</span>
                    <span className="mono sagec">-{formatPrice(pickupDiscount)}</span>
                  </div>
                )}
                {firstOrderDiscount > 0 && (
                  <div className="billrow" style={{ padding: "4px 0" }}>
                    <span>First-order offer</span>
                    <span className="mono safc">-{formatPrice(firstOrderDiscount)}</span>
                  </div>
                )}
                {gst > 0 && (
                  <div className="billrow" style={{ padding: "4px 0" }}>
                    <span>GST</span>
                    <span className="mono" style={{ color: "var(--tx)" }}>{formatPrice(gst)}</span>
                  </div>
                )}
                <div className="billrow" style={{ padding: "4px 0" }}>
                  <span>{fulfillmentType === "pickup" ? "Pickup" : "Delivery"}</span>
                  <span className={deliveryFee === 0 ? "sagec" : "mono"} style={deliveryFee === 0 ? undefined : { color: "var(--tx)" }}>
                    {fulfillmentType === "pickup" ? "Self-collect" : deliveryFee === 0 ? "FREE" : formatPrice(deliveryFee)}
                  </span>
                </div>
                {creditApplied > 0 && (
                  <div className="billrow" style={{ padding: "4px 0" }}>
                    <span>Loyalty credits</span>
                    <span className="mono sagec">-{formatPrice(creditApplied)}</span>
                  </div>
                )}
                {subsidyAvailable > 0 && (
                  <div className="billrow" style={{ padding: "4px 0" }}>
                    <span>Company subsidy</span>
                    <span className="mono sagec">-{formatPrice(subsidyAvailable)}</span>
                  </div>
                )}
                <hr style={{ border: "none", borderTop: "1px solid var(--ln)", margin: "4px 0" }} />
                <div className="billrow" style={{ padding: "4px 0", color: "var(--tx)", fontWeight: 600 }}>
                  <span>Charged via Razorpay</span>
                  <span className="mono safc">{formatPrice(razorpayTotal)}</span>
                </div>
                {addonTotal > 0 && (
                  <div className="billrow" style={{ padding: "4px 0 0", color: "var(--mut)", fontSize: 12 }}>
                    <span>Add-ons (billed separately, not charged now)</span>
                    <span className="mono" style={{ color: "var(--mut)" }}>{formatPrice(addonTotal)}</span>
                  </div>
                )}
                <div className="fx ac jc gap16" style={{ fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--mut)", fontWeight: 600, marginTop: 14, padding: "8px 0 0", borderTop: "1px solid var(--ln)" }}>
                  <span className="fx ac gap6">
                    <ShieldCheck className="w-3.5 h-3.5" style={{ color: "var(--sage)" }} />
                    FSSAI Certified
                  </span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span className="fx ac gap6">
                    <Flame className="w-3.5 h-3.5" style={{ color: "var(--safb)" }} />
                    Insulated Bags
                  </span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span className="fx ac gap6">
                    <Lock className="w-3.5 h-3.5" style={{ color: "var(--sage)" }} />
                    Tamper Sealed
                  </span>
                </div>
              </div>
              <p className="fine tc mt14" style={{ fontSize: 10.5, color: "var(--mut)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                FSSAI-licensed kitchen · RD-designed menu · Allergens disclosed per dish
              </p>
              <p className="fine tc mt4">
                <Link to="/refunds" style={{ color: "var(--mut)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                  Refund &amp; cancellation policy
                </Link>
              </p>
              {isProcessing && (
                <PayProcessingNotice
                  orderRef={processingOrderRef}
                  style={{ marginTop: 10 }}
                />
              )}
              <div className="fx gap8 mt10" style={{ justifyContent: "flex-end" }}>
                <button
                  onClick={() => setConfirmOpen(false)}
                  disabled={isProcessing}
                  className="btn btn-g"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmedPayment}
                  disabled={isProcessing || checkoutBlocked}
                  className={isProcessing || checkoutBlocked ? "btn btn-p dis" : "btn btn-p"}
                >
                  {isProcessing ? "Processing…" : checkoutBlocked ? (
                    "Blocked by patient safety"
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Confirm & Pay {formatPrice(razorpayTotal)}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <LocationPickerFlow
          open={showNewAddressFlow}
          onOpenChange={setShowNewAddressFlow}
          onSave={async (addressData) => {
            if (addressAuthRequired) {
              const guestAddr: UserAddress = {
                id: "guest-addr",
                label: addressData.label,
                type: "home",
                line1: addressData.line1,
                line2: addressData.line2 || "",
                city: addressData.city,
                pincode: addressData.pincode,
                phone: addressData.phone,
                isDefault: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              setSavedAddresses([guestAddr]);
              setSelectedAddress("guest-addr");
            } else {
              const r = await addressesApi.create(addressData);
              setSavedAddresses((prev) => [r.address, ...prev]);
              setSelectedAddress(r.address.id);
            }
          }}
        />
      </div>
    </div>
  );
}

interface V2MobilePayBarProps {
  subtotal: number;
  gst: number;
  addonTotal: number;
  deliveryFee: number;
  fulfillmentType: string;
  preorderDiscount: number;
  firstOrderDiscount: number;
  pickupDiscount: number;
  creditApplied: number;
  subsidyAvailable: number;
  effectiveTip: number;
  razorpayTotal: number;
  checkoutBlocked: boolean;
  checkoutBlockedReason: string | null;
  // First actionable pre-payment blocker (missing address / pickup / slot).
  // Non-null ⇒ Pay is disabled and the reason renders above the button.
  payBlockedReason: string | null;
  isProcessing: boolean;
  // Order reference of the in-flight attempt, if one exists yet.
  processingOrderRef: string | null;
  onPay: () => void;
  /** R1 stepped flow: current wizard step (0 review / 1 delivery / 2 payment)
   * while the mobile 3-step checkout is active, null when single-scroll
   * (md–lg viewports also render this bar). */
  mobileStep: number | null;
  onContinue: () => void;
}

function V2MobilePayBar({
  subtotal,
  gst,
  addonTotal,
  deliveryFee,
  fulfillmentType,
  preorderDiscount,
  firstOrderDiscount,
  pickupDiscount,
  creditApplied,
  subsidyAvailable,
  effectiveTip,
  razorpayTotal,
  checkoutBlocked,
  checkoutBlockedReason,
  payBlockedReason,
  isProcessing,
  processingOrderRef,
  onPay,
  mobileStep,
  onContinue,
}: V2MobilePayBarProps) {
  const [open, setOpen] = useState(false);
  // Stepped mode (<md): steps 1–2 continue forward; the final step pays.
  const isSteppedContinue = mobileStep !== null && mobileStep < 2;
  return (
    <div style={{ position: "fixed", left: 0, right: 0, zIndex: 30, padding: "0 12px 8px", bottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
      {open && (
        <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] col gap6" style={{ marginBottom: 8, padding: 12, fontSize: 11 }}>
          <div className="billrow" style={{ padding: 0 }}>
            <span>Subtotal</span>
            <span className="mono" style={{ color: "var(--tx)" }}>{formatPrice(subtotal)}</span>
          </div>
          {gst > 0 && (
            <div className="billrow" style={{ padding: 0 }}>
              <span>GST</span>
              <span className="mono" style={{ color: "var(--tx)" }}>{formatPrice(gst)}</span>
            </div>
          )}
          <div className="billrow" style={{ padding: 0 }}>
            <span>{fulfillmentType === "pickup" ? "Pickup" : "Delivery"}</span>
            <span className="mono">
              {fulfillmentType === "pickup" || deliveryFee === 0
                ? <span className="sagec">FREE</span>
                : <span style={{ color: "var(--tx)" }}>{formatPrice(deliveryFee)}</span>}
            </span>
          </div>
          {preorderDiscount > 0 && (
            <div className="billrow" style={{ padding: 0 }}><span>Pre-order discount</span><span className="mono sagec">-{formatPrice(preorderDiscount)}</span></div>
          )}
          {firstOrderDiscount > 0 && (
            <div className="billrow" style={{ padding: 0 }}><span>First-order offer</span><span className="mono safc">-{formatPrice(firstOrderDiscount)}</span></div>
          )}
          {pickupDiscount > 0 && (
            <div className="billrow" style={{ padding: 0 }}><span>Pickup discount</span><span className="mono sagec">-{formatPrice(pickupDiscount)}</span></div>
          )}
          {creditApplied > 0 && (
            <div className="billrow" style={{ padding: 0 }}><span>Loyalty credits</span><span className="mono sagec">-{formatPrice(creditApplied)}</span></div>
          )}
          {subsidyAvailable > 0 && (
            <div className="billrow" style={{ padding: 0 }}><span>Company subsidy</span><span className="mono sagec">-{formatPrice(subsidyAvailable)}</span></div>
          )}
          <hr style={{ border: "none", borderTop: "1px solid var(--ln)", margin: "4px 0" }} />
          <div className="billrow" style={{ padding: 0, color: "var(--tx)", fontWeight: 600 }}>
            <span>Charged via Razorpay</span>
            <span className="mono safc">{formatPrice(razorpayTotal)}</span>
          </div>
          {addonTotal > 0 && (
            <div className="billrow" style={{ padding: "6px 0 0", color: "var(--mut)", fontSize: 12 }}>
              <span>Add-ons (billed separately, not charged now)</span>
              <span className="mono" style={{ color: "var(--mut)" }}>{formatPrice(addonTotal)}</span>
            </div>
          )}
        </div>
      )}
      <p className="fine tc" style={{ fontSize: 10, color: "var(--mut)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: "var(--s1)", border: "1px solid var(--ln)", borderRadius: 8, padding: "4px 10px", marginBottom: 6 }}>
        FSSAI-licensed · ISO 22000 kitchen · RD-designed menu
      </p>
      <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] fx ac gap12" style={{ padding: 12 }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="f1"
          style={{ minWidth: 0, textAlign: "left" }}
          aria-label="Toggle order breakdown"
        >
          <p className="fine fx ac gap6" style={{ minWidth: 0 }}>
            <span className="clamp1">
              {fulfillmentType === "pickup" ? "Self-collect" : deliveryFee === 0 ? "FREE delivery" : `+ ${formatPrice(deliveryFee)} delivery`}
            </span>
            <ChevronDown className="w-3 h-3" style={{ transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} />
            <span className="fntc clamp1">See breakdown</span>
          </p>
          <p className="price mt2" style={{ fontSize: 18, color: "var(--safb)" }}>
            {formatPrice(razorpayTotal)}
          </p>
        </button>
        <div className="col gap6" style={{ flexShrink: 0, alignItems: "stretch", maxWidth: 168 }}>
          {checkoutBlocked && checkoutBlockedReason && (
            <p className="fine dgrc tc">{checkoutBlockedReason}</p>
          )}
          {isSteppedContinue ? (
            // Mobile stepper, pre-payment step: advance via the Continue gate
            // (handleMobileContinue already enforces address/slot/pickup).
            <button
              type="button"
              onClick={onContinue}
              className="btn btn-p"
              style={{ height: 48, padding: "0 16px" }}
            >
              {mobileStep === 0 ? "Continue to delivery" : "Continue to payment"}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            // Payment step (or desktop single-scroll): PR-09 disabled-with-
            // reason Pay CTA + in-flight processing notice.
            <>
              {payBlockedReason && <PayBlockedNotice reason={payBlockedReason} />}
              {isProcessing && <PayProcessingNotice orderRef={processingOrderRef} />}
              <button
                onClick={onPay}
                disabled={checkoutBlocked || payBlockedReason !== null}
                className={checkoutBlocked || payBlockedReason !== null ? "btn btn-p dis" : "btn btn-p"}
                // A long reason line above (patient-safety or address/slot/
                // pickup) must not stretch this button wider than its own
                // content — it shares the "col" with alignItems:stretch, so
                // opt it back out.
                style={{ height: 48, padding: "0 16px", alignSelf: "flex-end", width: "max-content" }}
                title={checkoutBlocked ? checkoutBlockedReason ?? undefined : payBlockedReason ?? undefined}
              >
                <CreditCard className="w-4 h-4" />
                {checkoutBlocked ? "Blocked" : "Review & Pay"}
              </button>
            </>
          )}
          <a
            href="https://wa.me/919289213115"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("support_click", { channel: "whatsapp", placement: "checkout_mobile_bar" })}
            className="fine fx ac jc gap6"
            style={{ marginTop: 2, color: "var(--mut)" }}
          >
            <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--sage)" }} />
            WhatsApp Support
          </a>
        </div>
      </div>
    </div>
  );
}

// Why the Pay button is disabled, rendered directly above it. Icon + text —
// never color alone — so the blocker is unmissable pre-click.
function PayBlockedNotice({
  reason,
  style,
}: {
  reason: string;
  style?: CSSProperties;
}) {
  return (
    <p className="fine tc fx ac jc gap6" style={{ color: "var(--tx)", ...style }}>
      <i
        className="ph-bold ph-info"
        aria-hidden="true"
        style={{ color: "var(--safb)", fontSize: 13, flexShrink: 0 }}
      />
      <span>{reason}</span>
    </p>
  );
}

// In-flight payment notice shown near the Pay area / confirm modal. This is
// purely visual — screen readers get the same message from the single
// persistent live region in V2Checkout's <ProcessingLiveRegion>, since a
// role="status" region that's inserted into the DOM already containing its
// text is announced unreliably (and this component mounts in up to three
// places at once, which would risk triple-announcing). aria-hidden here
// keeps a virtual cursor from reading it as a fourth, redundant copy.
function PayProcessingNotice({
  orderRef,
  style,
}: {
  orderRef: string | null;
  style?: CSSProperties;
}) {
  return (
    <p
      className="fine tc fx ac jc gap6"
      aria-hidden="true"
      style={{ color: "var(--tx)", ...style }}
    >
      <i
        className="ph-bold ph-clock"
        aria-hidden="true"
        style={{ color: "var(--safb)", fontSize: 13, flexShrink: 0 }}
      />
      <span>
        Payment in progress — don't close this screen.
        {orderRef ? (
          <>
            {" "}
            Ref: <span className="tnm-data">{orderRef}</span>
          </>
        ) : null}
      </span>
    </p>
  );
}

// Single always-mounted live region for the processing state. Screen
// readers only reliably announce role="status" content when it changes
// AFTER the region already exists in the DOM — mounting a brand-new
// role="status" element that already contains its text (the pattern the
// three visible PayProcessingNotice instances use) is announced
// inconsistently. This region is empty on first render and its text is
// set only once isProcessing flips, so the mutation is a genuine live
// update, and being a single instance it also dedupes the desktop
// summary + confirm-sheet overlap.
function ProcessingLiveRegion({
  isProcessing,
  orderRef,
}: {
  isProcessing: boolean;
  orderRef: string | null;
}) {
  return (
    <p role="status" className="sr-only">
      {isProcessing
        ? `Payment in progress — don't close this screen.${
            orderRef ? ` Ref: ${orderRef}` : ""
          }`
        : ""}
    </p>
  );
}
