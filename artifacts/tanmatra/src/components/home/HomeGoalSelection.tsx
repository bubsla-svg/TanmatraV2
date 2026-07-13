import { track } from "@/lib/analytics";
import { type WellnessGoal } from "@/lib/preferencesApi";
import { Target, Barbell, Heartbeat, Hourglass, Pulse, ShieldPlus } from "@phosphor-icons/react";

interface GoalCard {
  id: WellnessGoal | "healthy_aging" | "diabetes_support" | "gut_health" | "pcos_balance";
  label: string;
  icon: typeof Target;
  desc: string;
  // Map custom UI goals to standard preferences wellness goals
  prefGoal: WellnessGoal;
  // Optional extra parameters (e.g. medical conditions) to set if needed
  condition?: string;
}

const GOAL_CARDS: GoalCard[] = [
  {
    id: "lose_weight",
    label: "Weight Loss",
    icon: Target,
    desc: "Low-GI, calorie deficit & high satiety to support weight goals.",
    prefGoal: "lose_weight",
  },
  {
    id: "gain_muscle",
    label: "Muscle Gain",
    icon: Barbell,
    desc: "High protein & recovery macros for lean muscle synthesis.",
    prefGoal: "gain_muscle",
  },
  {
    id: "pcos_balance",
    label: "Manage PCOS",
    icon: Heartbeat,
    desc: "Anti-inflammatory and insulin-sensitizing nutrients.",
    prefGoal: "general_wellness",
    condition: "PCOS",
  },
  {
    id: "healthy_aging",
    label: "Healthy Aging",
    icon: Hourglass,
    desc: "High antioxidants & joint/cognitive health optimization.",
    prefGoal: "general_wellness",
    condition: "Healthy Aging",
  },
  {
    id: "diabetes_support",
    label: "Diabetes Support",
    icon: Pulse,
    desc: "Strictly low glycemic load to support blood sugar stability.",
    prefGoal: "general_wellness",
    condition: "Diabetes",
  },
  {
    id: "gut_health",
    label: "Gut Health",
    icon: ShieldPlus,
    desc: "Fiber-rich, prebiotics & low FODMAP options for digestion.",
    prefGoal: "general_wellness",
    condition: "Gut Health",
  },
];

interface HomeGoalSelectionProps {
  onSelectGoal: (goal: WellnessGoal, condition?: string) => void;
}

export default function HomeGoalSelection({ onSelectGoal }: HomeGoalSelectionProps) {
  const handleSelect = (card: GoalCard) => {
    track("goal_selected", {
      goal: card.id,
      entry_point: "homepage_goal_card",
    });
    onSelectGoal(card.prefGoal, card.condition);
  };

  return (
    <section className="padx mt-8">
      <div className="lab mb-4">Choose your health goal</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {GOAL_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => handleSelect(card)}
              className="flex flex-col text-left p-4 rounded-xl bg-[var(--tnm-surface-ink-2)] border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all w-full"
              style={{ minHeight: 120 }}
            >
              <div className="flex items-center gap-2 text-[var(--tnm-action)] mb-2">
                <Icon className="w-5 h-5" weight="bold" />
              </div>
              <div className="text-sm font-semibold text-white/95">{card.label}</div>
              <div className="text-[11px] text-white/50 leading-relaxed mt-1.5">{card.desc}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
