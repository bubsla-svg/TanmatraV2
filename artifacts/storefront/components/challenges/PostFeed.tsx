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
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-ink-muted">
        No posts yet — be the first to check in.
      </p>
    );
  }
  return (
    <ul className="mt-4 flex flex-col gap-4">
      {posts.map((p) => (
        <li key={p.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-ink-muted">
            {initials(p.authorName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-semibold text-ink">{p.authorName}</span>
              <span className="font-data text-xs text-ink-faint">{relTime(p.createdAt)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{p.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
