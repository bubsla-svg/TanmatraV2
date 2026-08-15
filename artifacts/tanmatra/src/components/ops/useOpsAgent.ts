import { useState, useRef, useCallback, useEffect } from "react";
import { streamOpsAgentChat, type SupportToolCall } from "@/lib/queries";
import { toast } from "sonner";

export interface ChatMessage {
  role: "user" | "agent";
  text: string;
  toolCalls?: SupportToolCall[];
  escalated?: boolean;
  timestamp: string;
  id: string;
}

export interface PendingAction {
  id: string;
  actionType: "refund" | "stock_update" | "rider_assign" | "order_cancel" | "price_change";
  description: string;
  parameters: Record<string, unknown>;
  riskScore: number;
  requestedAt: string;
}

export function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useOpsAgent() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "agent",
      text: "Tanmatra Ops Agent online. I can check inventory, assign riders, process refunds, and update stock levels. Destructive actions require your explicit confirmation.",
      timestamp: new Date().toLocaleTimeString(),
      id: generateId(),
    },
  ]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<PendingAction | null>(null);
  const [actionHistory, setActionHistory] = useState<
    Array<PendingAction & { approved: boolean; decidedAt: string }>
  >([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [streaming, setStreaming] = useState(false);
  const streamingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const parsePendingActions = useCallback(
    (_agentText: string, toolCalls?: SupportToolCall[]): PendingAction[] => {
      const actions: PendingAction[] = [];
      if (!toolCalls) return actions;
      for (const tc of toolCalls) {
        let actionType: PendingAction["actionType"] | null = null;
        let riskScore = 0.5;
        if (tc.name === "refund_payment") {
          actionType = "refund";
          riskScore = 0.9;
        } else if (tc.name === "update_inventory" || tc.name === "consume_inventory") {
          actionType = "stock_update";
          riskScore = 0.6;
        } else if (tc.name === "assign_rider") {
          actionType = "rider_assign";
          riskScore = 0.3;
        } else if (tc.name === "cancel_order") {
          actionType = "order_cancel";
          riskScore = 0.85;
        }
        if (actionType && riskScore >= 0.5) {
          actions.push({
            id: generateId(),
            actionType,
            description: `${tc.name}: ${JSON.stringify(tc.args ?? {})}`,
            parameters: (tc.args as Record<string, unknown>) ?? {},
            riskScore,
            requestedAt: new Date().toISOString(),
          });
        }
      }
      return actions;
    },
    []
  );

  const handleSend = async () => {
    if (!input.trim() || streaming) return;
    const userMsg: ChatMessage = {
      role: "user",
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString(),
      id: generateId(),
    };
    const placeholderId = generateId();
    streamingIdRef.current = placeholderId;
    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        role: "agent",
        text: "",
        timestamp: new Date().toLocaleTimeString(),
        id: placeholderId,
      },
    ]);
    setInput("");
    setStreaming(true);

    try {
      const result = await streamOpsAgentChat(
        {
          message: userMsg.text,
          history: messages
            .filter((m) => m.role === "user" || m.role === "agent")
            .map((m) => ({ role: m.role, text: m.text })),
        },
        {
          onDelta: (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId ? { ...m, text: m.text + delta } : m,
              ),
            );
          },
        },
      );

      const newActions = parsePendingActions(result.text, result.toolCalls);
      if (newActions.length > 0) {
        setPendingActions((prev) => [...prev, ...newActions]);
        const highestRisk = newActions.sort(
          (a, b) => b.riskScore - a.riskScore,
        )[0];
        if (highestRisk && highestRisk.riskScore >= 0.7) {
          setConfirmDialog(highestRisk);
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                text: result.text,
                toolCalls: result.toolCalls,
                escalated: result.escalated,
              }
            : m,
        ),
      );

      if (result.escalated) {
        toast.info("Escalated to human support. Ticket created.");
      }
    } catch (err) {
      // Prefer the server's own words. This is an internal staff console, so
      // a raw upstream message ("API key not valid…") is far more actionable
      // to an operator than a generic connection line.
      const detail = err instanceof Error && err.message ? err.message : null;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                text: detail
                  ? `Ops Agent error: ${detail}`
                  : "Ops Agent connection failed. Please retry or escalate to on-call engineer.",
              }
            : m,
        ),
      );
    } finally {
      streamingIdRef.current = null;
      setStreaming(false);
    }
  };

  const handleConfirmAction = (approved: boolean) => {
    if (!confirmDialog) return;
    const action = confirmDialog;
    setActionHistory((prev) => [...prev, { ...action, approved, decidedAt: new Date().toISOString() }]);
    setPendingActions((prev) => prev.filter((a) => a.id !== action.id));
    setConfirmDialog(null);
    toast[approved ? "success" : "error"](`Action ${approved ? "approved" : "rejected"}: ${action.actionType}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const pendingCount = pendingActions.length;
  const highRiskCount = pendingActions.filter((a) => a.riskScore >= 0.7).length;

  return {
    input,
    setInput,
    messages,
    pendingActions,
    confirmDialog,
    setConfirmDialog,
    actionHistory,
    scrollRef,
    streaming,
    streamingIdRef,
    handleSend,
    handleConfirmAction,
    handleKeyDown,
    pendingCount,
    highRiskCount,
  };
}
