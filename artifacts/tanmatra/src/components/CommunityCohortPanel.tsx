import { Sparkles, Trophy, Users } from "lucide-react";
import { useCommunityMe } from "@/lib/contentApi";

const METRIC_LABELS: Record<string, string> = {
  high_protein_lunches: "high-protein meals",
  plant_forward_meals: "plant-forward meals",
  calorie_floor_days: "calorie-floor days",
  logged_meals: "logged meals",
  ordered_days: "ordered days",
};

export default function CommunityCohortPanel() {
  const { data, isLoading } = useCommunityMe();

  if (isLoading) {
    return (
      <p className="fine">Loading your cohorts…</p>
    );
  }
  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4" style={{ color: "var(--safb)" }} />
        <h2 className="h2" style={{ color: "var(--tx)" }}>
          Your cohort this week
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map((card) => {
          const pct = Math.round(card.progress.ratio * 100);
          const metricLabel =
            METRIC_LABELS[card.challenge.metric] ?? card.challenge.metric;
          return (
            <div key={card.cohort.id} className="card">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="pill">{card.cohort.name}</span>
                  <span className="lab" style={{ fontSize: 10 }}>
                    Week of {card.challenge.weekStartDate}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: "var(--tx)" }}>
                    {card.challenge.title}
                  </h3>
                  <p className="fine mt-1">
                    {card.challenge.description}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between fine">
                    <span>
                      {card.progress.count}/{card.challenge.targetCount}{" "}
                      {metricLabel}
                    </span>
                    <span className="flex items-center gap-1" style={{ color: "var(--safb)" }}>
                      <Trophy className="w-3 h-3" />
                      {card.challenge.rewardPoints} pts
                    </span>
                  </div>
                  <div className="pbar" style={{ height: 8 }}>
                    <b
                      style={{
                        width: `${pct}%`,
                        background: card.progress.completed
                          ? "var(--sage)"
                          : "var(--saf)",
                      }}
                    />
                  </div>
                  {card.progress.completed && (
                    <p className="fine flex items-center gap-1" style={{ color: "var(--sage)" }}>
                      <Sparkles className="w-3 h-3" />
                      Goal reached — reward unlocked.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
