import { Check, FileCheck2, ChefHat, Truck, ClipboardList, UserRound, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import {
  CLINICAL_STAGES,
  clinicalStageIndex,
  statusToClinicalStage,
  type ClinicalStage,
} from "@/lib/clinicalLifecycle";
import type { PastOrder } from "@/lib/ordersContext";

const STAGE_ICONS: Record<ClinicalStage, React.ComponentType<{ className?: string }>> = {
  submitted: ClipboardList,
  verified: FileCheck2,
  preparing: ChefHat,
  out_for_delivery: Truck,
  received: Check,
};

function fmtTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function stageTimestamp(order: PastOrder, stage: ClinicalStage): string | undefined {
  switch (stage) {
    case "submitted":
      return order.placedAt;
    case "verified":
      return order.verifiedAt;
    case "preparing":
      return order.preparingAt;
    case "out_for_delivery":
      return order.outForDeliveryAt;
    case "received":
      return order.deliveredAt;
  }
}

function stageActor(order: PastOrder, stage: ClinicalStage): string | undefined {
  if (stage === "verified") return order.verifiedByName;
  if (stage === "submitted") return order.patientName ? `Patient · ${order.patientName}` : undefined;
  return undefined;
}

interface Props {
  order: PastOrder;
  socketConnected: boolean;
  compact?: boolean;
}

export function ClinicalLifecycleStepper({ order, socketConnected, compact = false }: Props) {
  const isCancelled = order.status === "cancelled";
  const currentStage = statusToClinicalStage(order.status, !!order.verifiedAt);
  const currentIdx = isCancelled ? -1 : clinicalStageIndex(currentStage);
  const currentMeta = CLINICAL_STAGES[Math.max(0, currentIdx)];
  const currentTs = stageTimestamp(order, currentMeta.key);
  const currentActor = stageActor(order, currentMeta.key);

  return (
    <div className="space-y-3">
      {/* Connection / cancellation status banner */}
      {isCancelled ? (
        <div
          className="flex items-center gap-2 text-xs"
          style={{ borderRadius: 8, border: "1px solid rgba(201,124,112,.4)", background: "rgba(201,124,112,.12)", padding: "8px 12px", color: "var(--dgr)" }}
          role="status"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
          <span>
            STAT cancel · {order.cancelReason ?? "reason not recorded"}
            {order.cancelledAt ? ` · ${fmtTime(order.cancelledAt)}` : ""}
          </span>
        </div>
      ) : !socketConnected ? (
        <div
          className="flex items-center gap-2 text-xs"
          style={{ borderRadius: 8, border: "1px solid rgba(232,154,62,.4)", background: "var(--safd)", padding: "8px 12px", color: "var(--safb)" }}
          role="status"
        >
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden />
          <span>Live updates paused — reconnecting. Status shown may be stale.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--sage)" }} aria-live="polite">
          <Wifi className="w-3.5 h-3.5" aria-hidden />
          <span>Live</span>
          {currentTs && <span style={{ color: "var(--mut)" }}>· {currentMeta.label} at {fmtTime(currentTs)}</span>}
          {currentActor && (
            <span className="inline-flex items-center gap-1" style={{ color: "var(--mut)" }}>
              · <UserRound className="w-3 h-3" aria-hidden /> {currentActor}
            </span>
          )}
        </div>
      )}

      {/* Stepper */}
      <ol
        className={`grid grid-cols-5 gap-1 ${compact ? "" : "sm:gap-3"}`}
        aria-label="Clinical order lifecycle"
      >
        {CLINICAL_STAGES.map((stage, idx) => {
          const Icon = STAGE_ICONS[stage.key];
          const reached = !isCancelled && idx <= currentIdx;
          const isCurrent = !isCancelled && idx === currentIdx;
          const ts = stageTimestamp(order, stage.key);
          const actor = stageActor(order, stage.key);
          return (
            <li
              key={stage.key}
              className="relative flex flex-col items-center text-center"
              aria-current={isCurrent ? "step" : undefined}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors z-10"
                style={{
                  background: isCancelled ? "var(--s3)" : reached ? "var(--saf)" : "var(--s1)",
                  borderColor: isCancelled ? "var(--ln2)" : reached ? "var(--saf)" : "var(--ln2)",
                  color: isCancelled ? "var(--mut)" : reached ? "var(--onsaf)" : "var(--mut)",
                  boxShadow: isCurrent ? "0 0 0 2px rgba(232,154,62,.5)" : undefined,
                }}
              >
                <Icon className="w-4 h-4" aria-hidden />
              </div>
              {idx < CLINICAL_STAGES.length - 1 && (
                <div
                  className="absolute top-4 left-1/2 w-full h-0.5"
                  style={{ background: !isCancelled && idx < currentIdx ? "rgba(232,154,62,.6)" : "var(--s3)" }}
                  aria-hidden
                />
              )}
              <span
                className="mt-2 text-[10px] leading-tight"
                style={{
                  color: reached && !isCancelled ? "var(--tx)" : "var(--mut)",
                  fontWeight: reached && !isCancelled ? 500 : undefined,
                }}
              >
                <span className={compact ? "sm:hidden" : "hidden"}>{stage.shortLabel}</span>
                <span className={compact ? "hidden sm:inline" : ""}>{stage.label}</span>
              </span>
              {ts && reached && (
                <span className="text-[9px] tabular-nums mt-0.5" style={{ color: "var(--mut)" }}>{fmtTime(ts)}</span>
              )}
              {actor && reached && (
                <span className="text-[9px] truncate max-w-[80px]" style={{ color: "var(--sage)" }} title={actor}>
                  {actor}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
