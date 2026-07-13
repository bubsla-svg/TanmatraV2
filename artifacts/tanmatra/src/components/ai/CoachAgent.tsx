import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router";
import {
  streamCoachAgentChat,
  type CoachAction,
  type CoachActionAddToCart,
  type CoachActionBookRd,
} from "@/lib/queries";
import { API_BASE } from "@/lib/apiBase";
import { useCart, type CartItem } from "@/lib/cartContext";
import { getDishBySlug } from "@/lib/menuData";
import { onDishImageError } from "@/lib/imgFallback";
import { toast } from "sonner";
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  ShoppingCart,
  Calendar,
  ArrowUpRight,
  Apple,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "agent";
  text: string;
  actions?: CoachAction[];
  escalated?: boolean;
  timestamp: string;
}

interface CoachAgentWidgetProps {
  /** When provided, the coach opens scoped to this dish and includes it as context. */
  dishSlug?: string;
  /** Custom trigger label/icon. Defaults to a floating gold button. */
  trigger?: React.ReactNode;
  /** When true, render the chat surface inline (no floating button). Used for the dish detail "ask the coach" panel. */
  inline?: boolean;
  /** Initial open state for inline mode. */
  defaultOpen?: boolean;
}

const greetingFor = (dishSlug?: string): string => {
  if (dishSlug) {
    const d = getDishBySlug(dishSlug);
    if (d) {
      return `Hi! I'm your nutrition coach. Want to know more about the ${d.name} — its macros, how it fits your goal, or a higher-protein swap? Ask me anything (general guidance, not medical advice).`;
    }
  }
  return "Hi! I'm your nutrition coach. Ask me about macros, swaps to hit your protein goal, or what to add to your next order. I'll only suggest dishes that respect your allergens and diet — and route you to a dietitian for anything clinical.";
};

function ActionCard({
  action,
  onAddToCart,
  onBookRd,
}: {
  action: CoachAction;
  onAddToCart: (a: CoachActionAddToCart) => void;
  onBookRd: (a: CoachActionBookRd) => void;
}) {
  if (action.kind === "add_to_cart") {
    return (
      <div
        className="mt-2 rounded-lg p-3"
        style={{ background: "var(--s2)", border: "1px solid var(--ln2)" }}
      >
        <div className="flex items-start gap-3">
          {action.image && (
            <img
              src={action.image}
              alt={action.name}
              onError={onDishImageError}
              className="w-12 h-12 rounded object-cover shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold leading-tight" style={{ color: "var(--tx)" }}>{action.name}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--mut)" }}>
              {action.priceLabel} · {action.macros.protein}g protein ·{" "}
              {action.macros.calories} kcal
            </p>
            <p className="text-[10px] mt-1 italic" style={{ color: "var(--mut)" }}>
              {action.reasoning}
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            className="btn btn-p"
            style={{ flex: 1, height: 28, fontSize: 11, padding: "0 10px" }}
            onClick={() => onAddToCart(action)}
          >
            <ShoppingCart className="w-3 h-3 mr-1" />
            {action.target === "next_delivery"
              ? "Add to next order"
              : action.target === "replace_in_cart"
                ? "Replace cart with this"
                : `Add ${action.quantity > 1 ? `×${action.quantity}` : ""} to cart`}
          </button>
          <Link
            to={`/dish/${action.slug}`}
            className="btn btn-g"
            style={{ height: 28, fontSize: 11, padding: "0 10px" }}
          >
            View
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div
      className="mt-2 rounded-lg p-3"
      style={{ background: "var(--s2)", border: "1px solid var(--dgr)" }}
    >
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4" style={{ color: "var(--dgr)" }} />
        <p className="text-xs font-semibold" style={{ color: "var(--tx)" }}>Talk to a Registered Dietitian</p>
      </div>
      <p className="text-[10px] mt-1" style={{ color: "var(--mut)" }}>{action.reason}</p>
      {action.premiumConsultsRemaining != null && (
        <p className="text-[10px] mt-1" style={{ color: "var(--safb)" }}>
          {action.premiumConsultsRemaining} premium consult
          {action.premiumConsultsRemaining === 1 ? "" : "s"} remaining
        </p>
      )}
      <button
        type="button"
        className="btn btn-p btn-blk mt-2"
        style={{ height: 28, fontSize: 11 }}
        onClick={() => onBookRd(action)}
      >
        <ArrowUpRight className="w-3 h-3 mr-1" />
        Book a consult
      </button>
    </div>
  );
}

interface PromptChip {
  label: string;
  query: string;
}

const getPromptChips = (dishSlug?: string): PromptChip[] => {
  if (dishSlug) {
    const d = getDishBySlug(dishSlug);
    if (d) {
      return [
        { label: "Show macros", query: `What are the exact macros for ${d.name}?` },
        { label: "Is it spicy?", query: `What is the spice level of ${d.name}?` },
        { label: "Safer swap?", query: `Is there a safer or higher-protein swap for ${d.name}?` },
        { label: "Ingredients", query: `What are the key ingredients in ${d.name}?` }
      ];
    }
  }
  return [
    { label: "High-protein options", query: "Show me high-protein options on the menu." },
    { label: "Renal-safe meals", query: "Which meals are safe for kidney health / low potassium?" },
    { label: "How to order?", query: "How does the subscription and delivery work?" }
  ];
};

/**
 * Shares the app-wide ["auth","user"] query cache (same key as Account/
 * DishReviews/GroupOrder) so this adds no extra request. The coach chat endpoint
 * is auth-gated (401 for anonymous), so we use this to render a "log in to chat"
 * state instead of letting a logged-out user tap a control that silently fails.
 */
function useCoachAuthUser() {
  return useQuery({
    queryKey: ["auth", "user"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/auth/user`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { user: { id: string } | null };
      return data.user;
    },
    staleTime: 30_000,
    retry: false,
  });
}

export default function CoachAgentWidget({
  dishSlug,
  trigger,
  inline = false,
  defaultOpen = false,
}: CoachAgentWidgetProps = {}) {
  const { data: authUser, isLoading: authLoading } = useCoachAuthUser();
  const isAuthenticated = !!authUser;
  const [isOpen, setIsOpen] = useState(inline ? defaultOpen : false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "agent",
      text: greetingFor(dishSlug),
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [streaming, setStreaming] = useState(false);
  const streamingIndexRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { items: cartItems, addItem, removeItem } = useCart();

  const hasSecondaryCheckoutBar = /^\/(dish|marketplace)\/.+/.test(pathname) || /^\/(cart|checkout|track)\/?/.test(pathname);
  const hasStickyCheckoutBar = cartItems.length > 0 && !hasSecondaryCheckoutBar && !/^\/(admin|rd-console|subscribe|subscriptions|subscription-plans|plans)(\/.*)?$/.test(pathname);

  const triggerPositionClass = hasStickyCheckoutBar
    ? "bottom-[calc(var(--bottom-nav-height)+136px+var(--safe-bottom))] md:bottom-24 max-[359px]:hidden"
    : hasSecondaryCheckoutBar
      ? "bottom-[calc(var(--bottom-nav-height)+var(--bottom-cta-height)+16px+var(--safe-bottom))] md:bottom-24 hidden sm:inline-flex"
      : "bottom-[calc(var(--bottom-nav-height)+var(--bottom-cta-height)+16px+var(--safe-bottom))] md:bottom-24";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAddToCart = async (a: CoachActionAddToCart) => {
    const dish = getDishBySlug(a.slug);
    if (!dish) {
      toast.error("Dish unavailable right now");
      return;
    }
    if (a.target === "next_delivery") {
      try {
        const res = await fetch(`${API_BASE}/subscriptions/next-delivery/add-item`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            slug: dish.slug,
            name: dish.name,
            image: dish.image,
            quantity: a.quantity,
            unitPricePaise: dish.price,
          }),
        });
        if (res.status === 409) {
          addItem({
            dishId: dish.id,
            slug: dish.slug,
            name: dish.name,
            image: dish.image,
            basePrice: dish.price,
            unitPrice: dish.price,
            quantity: a.quantity,
            kitchen: dish.kitchen,
            isVeg: dish.isVeg,
            rdVerified: dish.rdVerified,
            macros: dish.macros,
            customizations: [],
          });
          toast.success(`${dish.name} added to your order`, {
            description:
              "No upcoming subscription delivery — placed in your cart instead.",
            action: { label: "View Cart", onClick: () => navigate("/cart") },
          });
          return;
        }
        if (!res.ok) throw new Error(`add-to-next-delivery failed: ${res.status}`);
        toast.success(`${dish.name} queued for your next subscription delivery`);
      } catch {
        toast.error("Couldn't add to next delivery — please try again.");
      }
      return;
    }
    let replacedName: string | null = null;
    if (a.target === "replace_in_cart") {
      // Surgical replace: only drop the cart line(s) matching the slug
      // the coach explicitly named. Without an explicit replaceSlug we
      // refuse to guess which item to evict — fall through to a plain
      // add so we can never silently remove an unrelated line.
      const targetSlug = a.replaceSlug ?? null;
      const toRemove: CartItem[] = targetSlug
        ? cartItems.filter((it) => it.slug === targetSlug)
        : [];
      for (const it of toRemove) {
        removeItem(it.lineId);
      }
      replacedName = toRemove[0]?.name ?? null;
    }
    addItem({
      dishId: dish.id,
      slug: dish.slug,
      name: dish.name,
      image: dish.image,
      basePrice: dish.price,
      unitPrice: dish.price,
      quantity: a.quantity,
      kitchen: dish.kitchen,
      isVeg: dish.isVeg,
      rdVerified: dish.rdVerified,
      macros: dish.macros,
      customizations: [],
    });
    toast.success(
      a.target === "replace_in_cart"
        ? replacedName
          ? `Swapped ${replacedName} for ${dish.name}`
          : `${dish.name} added to your order`
        : `${dish.name} added to your order`,
      {
        action: { label: "View Cart", onClick: () => navigate("/cart") },
      },
    );
  };

  const handleBookRd = (a: CoachActionBookRd) => {
    setIsOpen(false);
    navigate(a.href);
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = typeof overrideText === "string" ? overrideText : input;
    const trimmed = textToSend.trim();
    if (!trimmed || streaming) return;
    const userMsg: ChatMessage = {
      role: "user",
      text: trimmed,
      timestamp: new Date().toLocaleTimeString(),
    };
    let placeholderIdx = -1;
    setMessages((prev) => {
      const next = [
        ...prev,
        userMsg,
        {
          role: "agent" as const,
          text: "",
          timestamp: new Date().toLocaleTimeString(),
        },
      ];
      placeholderIdx = next.length - 1;
      streamingIndexRef.current = placeholderIdx;
      return next;
    });
    setInput("");
    setStreaming(true);

    try {
      const result = await streamCoachAgentChat(
        {
          message: userMsg.text,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
          dishSlug,
        },
        {
          onDelta: (delta) => {
            setMessages((prev) => {
              const idx = streamingIndexRef.current;
              if (idx == null) return prev;
              const copy = prev.slice();
              const cur = copy[idx];
              if (!cur) return prev;
              copy[idx] = { ...cur, text: cur.text + delta };
              return copy;
            });
          },
        },
      );
      // Never leave a blank bubble: if the model returned empty/whitespace and
      // there's no action card to carry the reply, show a friendly fallback so
      // the coach never reads as "broken".
      const hasActions = (result.actions?.length ?? 0) > 0;
      const safeText = result.text?.trim()
        ? result.text
        : hasActions
          ? result.text
          : "I couldn't put together a reply just then — mind rephrasing? You can ask about a dish's macros, a higher-protein swap, or what to add to your order.";
      setMessages((prev) => {
        const idx = streamingIndexRef.current;
        if (idx == null) return prev;
        const copy = prev.slice();
        const cur = copy[idx];
        if (!cur) return prev;
        copy[idx] = {
          ...cur,
          text: safeText,
          actions: result.actions,
          escalated: result.escalated,
        };
        return copy;
      });
    } catch {
      setMessages((prev) => {
        const idx = streamingIndexRef.current;
        if (idx == null) return prev;
        const copy = prev.slice();
        copy[idx] = {
          role: "agent",
          text: "Sorry — I'm having trouble reaching the menu right now. Please try again in a moment.",
          timestamp: new Date().toLocaleTimeString(),
        };
        return copy;
      });
    } finally {
      streamingIndexRef.current = null;
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const chatSurface = (
    <div
      className={
        inline
          ? "card w-full flex flex-col max-h-[520px]"
          : "card fixed bottom-[calc(var(--bottom-nav-height)+12px+var(--safe-bottom))] md:bottom-24 right-3 md:right-6 left-3 md:left-auto z-50 w-auto md:w-[380px] max-h-[65vh] md:max-h-[560px] flex flex-col"
      }
      style={{ padding: 0, overflow: "hidden" }}
    >
      <div
        className="shrink-0"
        style={{ padding: "12px 16px", borderBottom: "1px solid var(--ln)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "var(--safd)" }}
          >
            <Apple className="w-5 h-5" style={{ color: "var(--safb)" }} />
          </div>
          <div>
            <div className="text-sm" style={{ color: "var(--tx)", fontWeight: 600 }}>Nutrition Coach</div>
            <p className="text-[10px] mono" style={{ color: "var(--mut)" }}>
              General guidance · not medical advice
            </p>
          </div>
          <span className="pill sg" style={{ marginLeft: "auto", fontSize: 10 }}>
            Online
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close nutrition coach"
            className="p-1 -mr-1 rounded"
            style={{ color: "var(--mut)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1" style={{ overflowY: "auto", padding: 16 }}>
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "agent" && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1"
                  style={{ background: "var(--safd)" }}
                >
                  <Bot className="w-3 h-3" style={{ color: "var(--safb)" }} />
                </div>
              )}
              <div
                className="max-w-[85%] rounded-lg px-3 py-2 text-sm"
                style={
                  msg.role === "user"
                    ? { background: "var(--saf)", color: "var(--onsaf)" }
                    : { background: "var(--s2)", color: "var(--tx)" }
                }
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.actions?.map((a, ai) => (
                  <ActionCard
                    key={ai}
                    action={a}
                    onAddToCart={handleAddToCart}
                    onBookRd={handleBookRd}
                  />
                ))}
                {msg.escalated && (
                  <div className="mt-2 flex items-center gap-1 text-[10px]" style={{ color: "var(--dgr)" }}>
                    <ArrowUpRight className="w-3 h-3" />
                    Routed to RD
                  </div>
                )}
                <p className="text-[10px] opacity-60 mt-1 text-right">
                  {msg.timestamp}
                </p>
              </div>
              {msg.role === "user" && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1"
                  style={{ background: "var(--s3)" }}
                >
                  <User className="w-3 h-3" style={{ color: "var(--mut)" }} />
                </div>
              )}
            </div>
          ))}
          {streaming &&
            messages[streamingIndexRef.current ?? -1]?.text === "" && (
              <div className="flex gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "var(--safd)" }}
                >
                  <Bot className="w-3 h-3 animate-bounce" style={{ color: "var(--safb)" }} />
                </div>
                <div
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: "var(--s2)", color: "var(--mut)" }}
                >
                  Thinking...
                </div>
              </div>
            )}
          {messages.length === 1 && !streaming && isAuthenticated && (
            <div className="pt-2 flex flex-col gap-1.5">
              <span className="text-[9px] uppercase tracking-wider text-clinical-zinc/50 font-semibold pl-1">Suggested Questions</span>
              <div className="flex flex-wrap gap-1.5">
                {getPromptChips(dishSlug).map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(chip.query)}
                    className="chip hover:bg-clinical-gold/10 hover:border-clinical-gold/30 hover:text-clinical-gold"
                    style={{ height: 28, padding: "0 10px", fontSize: 11, borderRadius: 8, cursor: "pointer" }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="shrink-0"
        style={{ padding: 12, borderTop: "1px solid var(--ln)" }}
      >
        {isAuthenticated ? (
          <div className="flex gap-2">
            <input
              className="inp"
              style={{ flex: 1 }}
              placeholder={
                dishSlug ? "Ask about this dish..." : "Ask about macros, swaps, goals..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Coach chat input"
            />
            <button
              type="button"
              className={`btn btn-p ${!input.trim() || streaming ? "dis" : ""}`}
              style={{ width: 46, padding: 0 }}
              onClick={() => handleSend()}
              disabled={!input.trim() || streaming}
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          // The coach endpoint is auth-gated (401 for anonymous). Rather than
          // show an input/chips that fail with a misleading "menu is down"
          // error, invite a login. Suppress while the auth probe is in flight
          // to avoid a flash of the logged-out state for signed-in users.
          <div className="flex flex-col gap-2" style={{ opacity: authLoading ? 0 : 1 }}>
            <span className="fine" style={{ color: "var(--mut)", textAlign: "center" }}>
              Log in to chat with your nutrition coach.
            </span>
            <a
              className="btn btn-p btn-blk text-center"
              href={`/login?next=${encodeURIComponent(pathname)}`}
              aria-label="Log in to chat with your nutrition coach"
            >
              Log in to chat
            </a>
          </div>
        )}
      </div>
    </div>
  );

  if (inline) {
    if (!isOpen) {
      return (
        <div className="space-y-1.5 text-center">
          <button
            type="button"
            className="btn btn-g btn-blk"
            onClick={() => setIsOpen(true)}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Ask the coach about this dish
          </button>
          <p className="fine">
            Ask about protein modifications, metabolic impacts, or allergen alternatives.
          </p>
        </div>
      );
    }
    return chatSurface;
  }

  return (
    <>
      {trigger ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close nutrition coach" : "Open nutrition coach"}
        >
          {trigger}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`fixed ${triggerPositionClass} left-3 sm:left-4 md:left-auto md:right-6 z-50 h-12 w-12 md:h-14 md:w-14 rounded-full shadow-lg flex items-center justify-center`}
          style={{ background: "var(--saf)", color: "var(--onsaf)" }}
          aria-label={isOpen ? "Close nutrition coach" : "Open nutrition coach"}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Apple className="w-6 h-6" />}
        </button>
      )}

      {isOpen && chatSurface}
    </>
  );
}
