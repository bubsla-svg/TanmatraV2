import type { ChallengePost } from "@/lib/challengesApi";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "M"
  );
}

function relTime(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Cohort post list. Rendered client-side (inside ChallengeRoom). */
export function PostFeed({ posts }: { posts: ChallengePost[] }) {
  if (posts.length === 0) {
    return <p className="mt-4 text-sm text-ink-muted">No posts yet — be the first to check in.</p>;
  }
  return (
    <ul className="mt-4 flex flex-col gap-4">
      {posts.map((p) => (
        <li key={p.id} className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[11px] font-semibold text-ink-muted">
            {initials(p.authorName)}
          </div>
          <div className="flex-1">
            <p className="text-xs">
              <span className="font-semibold text-ink">{p.authorName}</span>{" "}
              <span className="text-ink-faint">· {relTime(p.createdAt)}</span>
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{p.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
