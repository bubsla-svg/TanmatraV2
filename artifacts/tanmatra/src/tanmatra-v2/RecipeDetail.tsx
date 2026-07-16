import { Link, useParams } from "react-router";
import { useRecipe } from "@/lib/contentApi";
import { unsplashSrcset } from "@/lib/imgSrcset";
import { onDishImageError } from "@/lib/imgFallback";

export default function V2RecipeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: recipe, isLoading } = useRecipe(slug);

  // ---- loading ----
  if (isLoading) {
    return (
      <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/recipes" aria-label="Back to recipes"><i className="ph-bold ph-arrow-left" /></Link>
            <div className="abt">Recipe</div>
          </div>
          <div className="content">
            <div className="skel" style={{ height: 240, borderRadius: 0 }} />
            <div className="padx" style={{ paddingTop: 16 }}>
              <div className="skel" style={{ height: 14, width: 130, marginBottom: 14 }} />
              <div className="skel" style={{ height: 26, width: "82%", marginBottom: 10 }} />
              <div className="skel" style={{ height: 13, width: "100%", marginBottom: 6 }} />
              <div className="skel" style={{ height: 13, width: "88%", marginBottom: 16 }} />
              <div className="skel" style={{ height: 60, width: "100%", marginBottom: 20 }} />
              <div className="skel" style={{ height: 18, width: 120, marginBottom: 12 }} />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skel" style={{ height: 13, width: "100%", marginBottom: 12 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- not found / empty ----
  if (!recipe) {
    return (
      <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/recipes" aria-label="Back to recipes"><i className="ph-bold ph-arrow-left" /></Link>
            <div className="abt">Recipe</div>
          </div>
          <div className="content padx">
            <div className="tc" style={{ padding: "52px 20px" }}>
              <i className="ph-bold ph-book-open" style={{ fontSize: 32, color: "var(--fnt)" }} />
              <div className="tt mt10">Recipe not found</div>
              <div className="fine mt6">This recipe may have moved or been unpublished.</div>
              <Link className="btn btn-p mt20" to="/recipes"><i className="ph-bold ph-arrow-left" />Back to recipes</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const goalLabel = (recipe.goal || "").replaceAll("_", " ");

  return (
    <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="content">
          {recipe.image ? (
            <div className="plc" style={{ height: 240, position: "relative" }}>
              <img
                src={recipe.image}
                srcSet={unsplashSrcset(recipe.image)}
                sizes="(max-width: 480px) 100vw, 480px"
                alt={recipe.title}
                loading="eager"
                fetchPriority="high"
                onError={onDishImageError}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div className="herograd" />
              <div className="posabs" style={{ top: 12, left: 16, zIndex: 2 }}>
                <Link className="glass" to="/recipes" aria-label="Back to recipes"><i className="ph-bold ph-arrow-left" /></Link>
              </div>
            </div>
          ) : (
            <div className="appbar">
              <Link className="iconbtn" to="/recipes" aria-label="Back to recipes"><i className="ph-bold ph-arrow-left" /></Link>
              <div className="abt">Recipe</div>
            </div>
          )}

          <div className="padx" style={{ paddingTop: 16 }}>
            <div className="fx ac g6 wrap">
              <span className="pill sg"><i className="ph-fill ph-seal-check" />{recipe.authorRole} authored</span>
              {goalLabel && <span className="pill" style={{ textTransform: "capitalize" }}>{goalLabel}</span>}
              {recipe.diet && <span className="pill" style={{ textTransform: "capitalize" }}>{recipe.diet}</span>}
            </div>

            <h1 className="h2 mt10">{recipe.title}</h1>
            {recipe.summary && <p className="small mut mt6" style={{ lineHeight: 1.5 }}>{recipe.summary}</p>}
            <div className="fine mt6">By {recipe.authorName} · {recipe.authorRole}</div>

            <div className="ribbon mt14" role="group" aria-label={`Time ${recipe.timeMinutes} minutes${recipe.calories != null ? `, ${recipe.calories} kilocalories` : ""}${recipe.proteinGrams != null ? `, ${recipe.proteinGrams} grams protein` : ""}`}>
              <div className="rc"><span className="rl">TIME</span><span className="rv">{recipe.timeMinutes}<i className="ru">min</i></span></div>
              {recipe.calories != null && (
                <div className="rc"><span className="rl">KCAL</span><span className="rv sf">{recipe.calories}</span></div>
              )}
              {recipe.proteinGrams != null && (
                <div className="rc"><span className="rl">PROTEIN</span><span className="rv">{recipe.proteinGrams}<i className="ru">g</i></span></div>
              )}
              <div className="rc"><span className="rl">TAGS</span><span className="rv" style={{ fontSize: 12.5 }}>{recipe.tags.slice(0, 2).join(", ") || "—"}</span></div>
            </div>

            {recipe.body && <p className="small mut mt16" style={{ lineHeight: 1.55 }}>{recipe.body}</p>}

            <div className="sh mt20 mb10">Ingredients</div>
            {recipe.ingredients.map((ing, i) => (
              <div key={i} className="fx ac gap10 small" style={{ padding: "9px 0", borderBottom: "1px solid var(--ln)" }}>
                <i className="ph-fill ph-circle safc" style={{ fontSize: 6, flex: "none" }} />
                <span>{ing}</span>
              </div>
            ))}

            <div className="sh mt20 mb10">Method</div>
            {recipe.steps.map((step, i) => (
              <div key={i} className="fx gap12 mb14">
                <span
                  className="mono"
                  style={{ flex: "none", width: 28, height: 28, borderRadius: 8, background: "var(--safd)", color: "var(--safb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}
                >
                  {i + 1}
                </span>
                <p className="small mut" style={{ paddingTop: 3, lineHeight: 1.55 }}>{step}</p>
              </div>
            ))}

            <div className="note mt14"><i className="ph-bold ph-seal-check" />Recipes are written and portioned by our registered dietitians.</div>
            <div style={{ height: 24 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
