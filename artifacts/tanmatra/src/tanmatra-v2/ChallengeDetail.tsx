import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useChallenge,
  useJoinChallenge,
  useLeaveChallenge,
  usePostToChallenge,
} from "@/lib/contentApi";
import { toast } from "sonner";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = Math.floor(diff / 86_400_000);
  if (day < 1) {
    const hr = Math.floor(diff / 3_600_000);
    if (hr < 1) return "just now";
    return `${hr}h ago`;
  }
  if (day < 30) return `${day}d ago`;
  return `${Math.floor(day / 30)}mo ago`;
}

function formatCheckInWhen(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

function formatCountdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "live now";
  const hr = Math.floor(ms / 3_600_000);
  if (hr < 1) {
    const min = Math.max(1, Math.floor(ms / 60_000));
    return `in ${min}m`;
  }
  if (hr < 24) return `in ${hr}h`;
  return `in ${Math.floor(hr / 24)}d`;
}

function initials(name: string): string {
  return (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function V2ChallengeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = useChallenge(slug);
  const join = useJoinChallenge(slug ?? "");
  const leave = useLeaveChallenge(slug ?? "");
  const post = usePostToChallenge(slug ?? "");
  const [body, setBody] = useState("");
  // These two pieces of UI state must be declared BEFORE any early
  // return below, otherwise React's hook-call-count differs between the
  // first (loading) render and the second (data-arrived) render — which
  // throws "Rendered more hooks than during the previous render" and
  // bubbles up to the error boundary as "Something went wrong".
  // (Keep this comment — easy to regress.)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  if (isLoading) {
    return (
      <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/challenges" aria-label="Back to challenges">
              <i className="ph-bold ph-arrow-left" />
            </Link>
            <div className="abt">Challenge</div>
          </div>
          <div className="content padx" style={{ paddingTop: 4 }}>
            <div className="skel" style={{ height: 200, borderRadius: 12 }} />
            <div className="skel mt16" style={{ height: 26, width: "70%" }} />
            <div className="skel mt10" style={{ height: 14, width: "90%" }} />
            <div className="skel mt8" style={{ height: 14, width: "55%" }} />
            <div className="skel mt16" style={{ height: 46, width: "100%", borderRadius: 10 }} />
            <div className="skel mt20" style={{ height: 90, width: "100%", borderRadius: 12 }} />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/challenges" aria-label="Back to challenges">
              <i className="ph-bold ph-arrow-left" />
            </Link>
            <div className="abt">Challenge</div>
          </div>
          <div className="content padx">
            <div className="tc" style={{ padding: "52px 20px" }}>
              <i className="ph-bold ph-flag" style={{ fontSize: 32, color: "var(--fnt)" }} />
              <div className="tt mt10">Challenge not found</div>
              <div className="fine mt6">This challenge may have ended or moved.</div>
              <Link className="btn btn-p mt20" to="/challenges">
                <i className="ph-bold ph-arrow-left" />
                Back to challenges
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { challenge, joined, posts, checkIns } = data;
  const upcomingCheckIns = checkIns ?? [];
  const SOON_MS = 24 * 60 * 60 * 1000;

  const handleJoin = () => {
    join.mutate(undefined, {
      onSuccess: () => {
        // Reveal a "what happens next" panel so the user understands what
        // they just signed up for. Per UX audit J-C finding 6.
        setShowWelcome(true);
        toast.success(`Joined ${challenge.title}`, {
          description: "Check your email for your start-day instructions.",
        });
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Could not join";
        if (msg.startsWith("401")) {
          toast.error("Log in to join challenges");
        } else {
          toast.error(msg);
        }
      },
    });
  };

  const handleLeave = () => {
    leave.mutate(undefined, {
      onSuccess: () => {
        toast.success(`Left ${challenge.title}`);
        setLeaveConfirmOpen(false);
      },
    });
  };

  const handlePost = () => {
    if (!body.trim()) return;
    post.mutate(body, {
      onSuccess: () => {
        setBody("");
        toast.success("Posted to the cohort feed");
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Could not post";
        toast.error(msg);
      },
    });
  };

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/challenges" aria-label="Back to challenges">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Challenge</div>
        </div>

        <div className="content" style={{ paddingBottom: 24 }}>
          {/* Hero */}
          {challenge.image && (
            <div
              className="plc"
              style={{
                height: 200,
                backgroundImage: `url(${challenge.image})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="herograd" />
              {challenge.featured > 0 && (
                <span
                  className="pill"
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    zIndex: 2,
                    background: "var(--safd)",
                    color: "var(--safb)",
                  }}
                >
                  <i className="ph-fill ph-sparkle" />
                  Featured
                </span>
              )}
            </div>
          )}

          {/* Header */}
          <div className="padx" style={{ paddingTop: 16 }}>
            <h1 className="disp" style={{ color: "#fff" }}>{challenge.title}</h1>
            <p className="small mut mt6">{challenge.tagline}</p>
            <div className="fx ac wrap gap12 mt10">
              <span className="fine fx ac g6">
                <i className="ph-bold ph-calendar-dots safc" />
                {challenge.durationDays} days
              </span>
              <span className="fine fx ac g6">
                <i className="ph-bold ph-users safc" />
                {challenge.memberCount} joined
              </span>
              <span className="fine">Led by {challenge.rdName}</span>
            </div>

            {joined ? (
              <button
                type="button"
                className={`btn btn-g btn-blk mt16${leave.isPending ? " dis" : ""}`}
                onClick={() => setLeaveConfirmOpen(true)}
                disabled={leave.isPending}
              >
                Leave challenge
              </button>
            ) : (
              <button
                type="button"
                className={`btn btn-p btn-blk mt16${join.isPending ? " dis" : ""}`}
                onClick={handleJoin}
                disabled={join.isPending}
              >
                {join.isPending ? "Joining…" : "Join challenge"}
              </button>
            )}

            {challenge.description && (
              <p className="small mut mt16" style={{ lineHeight: 1.55 }}>
                {challenge.description}
              </p>
            )}

            {challenge.bundleSlug && (
              <div
                className="banner mt16 fx ac gap12"
                role="group"
                aria-label="Meal bundle"
              >
                <i className="ph-fill ph-sparkle safc" style={{ fontSize: 18, flex: "none" }} />
                <span className="fine f1" style={{ color: "var(--tx)" }}>
                  This challenge ships with the{" "}
                  <span className="safc" style={{ textTransform: "capitalize" }}>
                    {challenge.bundleSlug.replaceAll("-", " ")}
                  </span>{" "}
                  meal bundle.
                </span>
                <Link to="/menu" className="linkq" style={{ flex: "none" }}>
                  See menu
                  <i className="ph-bold ph-arrow-right" />
                </Link>
              </div>
            )}
          </div>

          {/* Upcoming RD check-ins */}
          {joined && upcomingCheckIns.length > 0 && (
            <>
              <div className="secrow">
                <span className="sh fx ac gap8">
                  <i className="ph-fill ph-video-camera safc" />
                  Upcoming RD check-ins
                </span>
                <span className="lab mono">{upcomingCheckIns.length} scheduled</span>
              </div>
              <div className="padx">
                {upcomingCheckIns.map((ci: any) => {
                  const ms = new Date(ci.scheduledAt).getTime() - Date.now();
                  const soon = ms > 0 && ms <= SOON_MS;
                  return (
                    <div key={ci.id} className="card mb10">
                      <div className="fx ac jb gap12">
                        <div className="f1" style={{ minWidth: 0 }}>
                          <div className="fx ac wrap g6">
                            <span className="small" style={{ fontWeight: 600 }}>{ci.title}</span>
                            {soon && (
                              <span
                                className="pill"
                                style={{ background: "var(--safd)", color: "var(--safb)" }}
                              >
                                <i className="ph-fill ph-bell" />
                                Within 24h
                              </span>
                            )}
                          </div>
                          <div className="fine mono mt4">
                            {formatCheckInWhen(ci.scheduledAt)}{" "}
                            <span className="fntc">· {formatCountdown(ci.scheduledAt)}</span>
                          </div>
                        </div>
                        {ci.joinUrl ? (
                          <a
                            href={ci.joinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-p"
                            style={{ flex: "none", height: 40, padding: "0 14px" }}
                          >
                            <i className="ph-bold ph-video-camera" />
                            Join
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Cohort feed */}
          <div className="secrow">
            <span className="sh fx ac gap8">
              <i className="ph-fill ph-chat-circle safc" />
              Cohort feed
            </span>
            <span className="lab mono">
              {posts.length} post{posts.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="padx">
            {joined ? (
              <div className="card">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, 1000))}
                  rows={3}
                  placeholder="Share progress, a meal photo idea, or a question for the RD…"
                  aria-label="Write a cohort update"
                  style={{
                    width: "100%",
                    resize: "vertical",
                    minHeight: 76,
                    background: "var(--s2)",
                    border: "1px solid var(--ln2)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    color: "var(--tx)",
                    fontFamily: "inherit",
                    fontSize: 14,
                    lineHeight: 1.45,
                    outline: "none",
                  }}
                />
                <div className="fx ac jb mt10">
                  <span className="lab mono">{body.length}/1000</span>
                  <button
                    type="button"
                    className={`btn btn-p${!body.trim() || post.isPending ? " dis" : ""}`}
                    disabled={!body.trim() || post.isPending}
                    onClick={handlePost}
                  >
                    {post.isPending ? "Posting…" : "Post update"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="fine mut">Join the challenge to post in the cohort feed.</p>
            )}

            {posts.length === 0 ? (
              <p className="fine mut mt12">No posts yet — be the first to share.</p>
            ) : (
              <div className="mt12">
                {posts.map((p: any) => (
                  <div key={p.id} className="card mb10">
                    <div className="fx ac jb">
                      <div className="fx ac gap8" style={{ minWidth: 0 }}>
                        <span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                          {initials(p.authorName)}
                        </span>
                        <span className="small clamp1" style={{ fontWeight: 600 }}>{p.authorName}</span>
                      </div>
                      <span className="lab mono" style={{ flex: "none" }}>{formatRelative(p.createdAt)}</span>
                    </div>
                    <p
                      className="small mut mt8"
                      style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}
                    >
                      {p.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------ Leave-challenge confirmation ------ */}
      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent className="bg-clinical-surface border-clinical-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Leave this challenge?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-clinical-zinc text-xs">
              You'll lose your spot in the cohort. Your check-in history is
              preserved if you re-join later, but your current streak resets
              to zero. You can re-join while spots are open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">
              Stay in challenge
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-red-500 text-white hover:bg-red-600"
              onClick={handleLeave}
            >
              Yes, leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ------ Post-join welcome — sets expectations for first-time joiners ------ */}
      <AlertDialog open={showWelcome} onOpenChange={setShowWelcome}>
        <AlertDialogContent className="bg-clinical-surface border-clinical-gold/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              You're in — here's what's next
            </AlertDialogTitle>
            <AlertDialogDescription className="text-clinical-zinc text-xs">
              Welcome to {challenge.title}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="text-xs text-clinical-zinc space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-clinical-gold font-bold">1.</span>
              <span>
                <strong className="text-white">Starts {formatRelative(challenge.startsAt)}.</strong>
                {" "}You'll get a kickoff email with your day-1 plan.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-clinical-gold font-bold">2.</span>
              <span>
                <strong className="text-white">Daily check-ins</strong> appear
                on this page once the challenge is live — log meals, mood,
                and metrics in 30 seconds.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-clinical-gold font-bold">3.</span>
              <span>
                <strong className="text-white">Cohort feed</strong> below lets
                you ask questions and cheer on others. {challenge.rdName} drops
                in a few times a week.
              </span>
            </li>
            {challenge.bundleSlug && (
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-clinical-gold font-bold">4.</span>
                <span>
                  <strong className="text-white">Optional meal bundle</strong>{" "}
                  available below — RD-curated dishes that fit the protocol.
                </span>
              </li>
            )}
          </ul>
          <AlertDialogFooter>
            <AlertDialogAction
              className="min-h-11 bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 font-semibold"
              onClick={() => setShowWelcome(false)}
            >
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
