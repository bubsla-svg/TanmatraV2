import { useState } from "react";
import { Link } from "react-router";
import { useRecipes } from "@/lib/contentApi";

const GOALS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Goals" },
  { value: "general_wellness", label: "General Wellness" },
  { value: "lose_weight", label: "Fat Loss" },
  { value: "gain_muscle", label: "Muscle Gain" },
  { value: "maintain", label: "Maintain" },
];

const DIETS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Any Diet" },
  { value: "omnivore", label: "Omnivore" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "keto", label: "Keto" },
];

const TIME_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Any time" },
  { value: 15, label: "≤ 15 min" },
  { value: 30, label: "≤ 30 min" },
  { value: 45, label: "≤ 45 min" },
];

export default function V2Recipes() {
  const [goal, setGoal] = useState("all");
  const [diet, setDiet] = useState("all");
  const [maxTime, setMaxTime] = useState(0);
  const [q, setQ] = useState("");
  const { data: recipes, isLoading, isError, refetch } = useRecipes({ goal, diet, maxTime, q });

  const count = recipes?.length ?? 0;
  const dirty = goal !== "all" || diet !== "all" || maxTime !== 0 || q.trim() !== "";
  const reset = () => { setGoal("all"); setDiet("all"); setMaxTime(0); setQ(""); };

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Recipes</div>
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 24 }}>
          <div className="lab" style={{ color: "var(--safb)", display: "flex", alignItems: "center", gap: 6 }}>
            <i className="ph-bold ph-book-open" />Recipe Library
          </div>
          <h1 className="disp mt6" style={{ color: "#fff" }}>Cook with the RD board</h1>
          <p className="small mut mt6">Every recipe here is written by Tanmatra's registered dietitians and chefs — built for the same goals as our meal plans.</p>

          <div className="inp mt16">
            <i className="ph-bold ph-magnifying-glass" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search recipes…"
              aria-label="Search recipes"
            />
          </div>

          <ChipRow label="Goal">
            {GOALS.map((o) => (
              <button key={o.value} className={goal === o.value ? "chip on" : "chip"} onClick={() => setGoal(o.value)}>{o.label}</button>
            ))}
          </ChipRow>
          <ChipRow label="Diet">
            {DIETS.map((o) => (
              <button key={o.value} className={diet === o.value ? "chip on" : "chip"} onClick={() => setDiet(o.value)}>{o.label}</button>
            ))}
          </ChipRow>
          <ChipRow label="Time">
            {TIME_OPTIONS.map((t) => (
              <button key={t.value} className={maxTime === t.value ? "chip on" : "chip"} onClick={() => setMaxTime(t.value)}>{t.label}</button>
            ))}
          </ChipRow>

          <div className="fine mt12 mb10">
            {isLoading ? "Loading recipes…" : `${count} recipe${count === 1 ? "" : "s"}`}
          </div>

          {isLoading && (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card mb12" style={{ padding: 0, overflow: "hidden" }}>
                  <div className="skel" style={{ height: 150, borderRadius: 0 }} />
                  <div style={{ padding: 14 }}>
                    <div className="skel" style={{ height: 16, width: "70%" }} />
                    <div className="skel mt8" style={{ height: 12, width: "100%" }} />
                    <div className="skel mt8" style={{ height: 12, width: "45%" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && isError && (
            <div className="tc" style={{ padding: "40px 20px" }}>
              <div className="tt mt10">Couldn't load recipes</div>
              <div className="fine mt6">Check your connection and try again.</div>
              <button className="btn btn-g mt20" onClick={() => refetch()}>Try again</button>
            </div>
          )}

          {!isLoading && !isError && recipes?.map((r) => (
            <Link key={r.id} className="card pointer mb12" to={`/recipes/${r.slug}`} style={{ display: "block", padding: 0, overflow: "hidden" }}>
              <div className="plc" style={{ height: 150, ...(r.image ? { backgroundImage: `url(${r.image})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
                {!r.image && <span className="plccap">RECIPE</span>}
                <div className="herograd" />
                {r.authorRole && (
                  <span className="pill sg" style={{ position: "absolute", top: 12, left: 12, zIndex: 2 }}>
                    <i className="ph-fill ph-seal-check" />{r.authorRole}
                  </span>
                )}
              </div>
              <div style={{ padding: 14 }}>
                <div className="tt clamp1" style={{ whiteSpace: "normal" }}>{r.title}</div>
                <div className="fine mt4" style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{r.summary}</div>
                <div className="ribbon cmp mt10" role="group" aria-label={`${r.timeMinutes} minutes${r.calories != null ? `, ${r.calories} kilocalories` : ""}${r.proteinGrams != null ? `, ${r.proteinGrams} grams protein` : ""}`}>
                  <div className="rc"><span className="rl">TIME</span><span className="rv">{r.timeMinutes}<i className="ru">min</i></span></div>
                  {r.calories != null && (
                    <div className="rc"><span className="rl">KCAL</span><span className="rv sf">{r.calories}</span></div>
                  )}
                  {r.proteinGrams != null && (
                    <div className="rc"><span className="rl">PROTEIN</span><span className="rv">{r.proteinGrams}<i className="ru">g</i></span></div>
                  )}
                </div>
                <div className="lab mt10">By {r.authorName}</div>
              </div>
            </Link>
          ))}

          {!isLoading && !isError && count === 0 && (
            <div className="tc" style={{ padding: "40px 20px" }}>
              <div className="tt mt10">No recipes match those filters yet.</div>
              {dirty && <button className="btn btn-g mt20" onClick={reset}>Clear filters</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: any }) {
  return (
    <div className="mt12">
      <div className="lab mb6">{label}</div>
      <div className="fx wrap gap8">{children}</div>
    </div>
  );
}
