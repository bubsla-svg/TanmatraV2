import { Link } from "react-router";

/* Viewport 4 — Ambient assessment nudge (honesty-critical).
 *
 * Primary CTA opens the REAL 60-second metabolic assessment (IntakeQuiz),
 * which re-ranks the menu around the user's GOAL + MACRO targets via
 * evaluateDishForPreferences. We say exactly that — no more.
 *
 * The wearable CTA is framed as early-access / coming-soon and routes to the
 * honest /wellness connect flow. We deliberately do NOT claim live glucose
 * re-ranks the menu — that pipeline is inert until a provider key is set. */

export default function AssessmentNudge({ onStart }: { onStart: () => void }) {
  return (
    <div className="padx">
      <div className="assess">
        <div className="fx ac gap12">
          <div className="dic" style={{ color: "var(--safb)" }}>
            <i className="ph-bold ph-brain" />
          </div>
          <div className="f1" style={{ minWidth: 0 }}>
            <div className="tt">60-second metabolic assessment</div>
            <div className="fine mt2">
              Answer a few questions and the menu re-ranks around your goal and macro targets.
            </div>
          </div>
        </div>

        <button className="btn btn-p btn-blk mt12" onClick={onStart}>
          Start Assessment <i className="ph-bold ph-arrow-right" />
        </button>

        <Link to="/wellness" className="assess-2nd mt10">
          <span className="fx ac g6" style={{ minWidth: 0 }}>
            <i className="ph-bold ph-lightning" style={{ color: "var(--safb)" }} />
            <span className="clamp1">Connect a wearable</span>
            <span className="pill" style={{ fontSize: 9, padding: "3px 8px" }}>Early access</span>
          </span>
          <i className="ph-bold ph-caret-right" style={{ color: "var(--fnt)", flex: "none" }} />
        </Link>
        <div className="fine mt6" style={{ fontSize: 11 }}>
          Live glucose-based re-ranking is a future unlock — wearables show a web preview for now.
        </div>
      </div>
    </div>
  );
}
