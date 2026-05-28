import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Radio, RotateCcw, Plus, Trophy, Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";

type BallEvent = "dot" | "run" | "four" | "six" | "wicket" | "wide" | "no_ball" | "bye" | "leg_bye";

interface Innings {
  id: string;
  innings_number: number;
  batting_team: string;
  bowling_team: string | null;
  total_runs: number;
  total_wickets: number;
  total_balls: number;
  extras: number;
  is_closed: boolean;
}

interface InningsBundle {
  innings: Innings;
  balls: Ball[];
}

interface Ball {
  id: string;
  over_number: number;
  ball_number: number;
  runs: number;
  event: BallEvent;
  batsman_name: string | null;
  bowler_name: string | null;
}

const fmtOvers = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

const ACTIONS: { event: BallEvent; runs: number; label: string; cls: string }[] = [
  { event: "dot", runs: 0, label: "•", cls: "bg-card" },
  { event: "run", runs: 1, label: "1", cls: "bg-card" },
  { event: "run", runs: 2, label: "2", cls: "bg-card" },
  { event: "run", runs: 3, label: "3", cls: "bg-card" },
  { event: "four", runs: 4, label: "4", cls: "bg-secondary text-secondary-foreground" },
  { event: "six", runs: 6, label: "6", cls: "bg-accent text-accent-foreground glow-orange" },
  { event: "wide", runs: 1, label: "WD", cls: "bg-muted" },
  { event: "no_ball", runs: 1, label: "NB", cls: "bg-muted" },
  { event: "wicket", runs: 0, label: "W", cls: "bg-destructive text-destructive-foreground" },
];

export default function LiveScoring() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [match, setMatch] = useState<{ id: string; match_name: string; team_a: string | null; team_b: string | null; owner_id: string } | null>(null);
  const [innings, setInnings] = useState<Innings | null>(null);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [closedBundles, setClosedBundles] = useState<InningsBundle[]>([]);
  const [setupTeam, setSetupTeam] = useState("");
  const [setupBowl, setSetupBowl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [batsman, setBatsman] = useState("");
  const [bowler, setBowler] = useState("");
  const [copied, setCopied] = useState(false);
  const [showInningsRecap, setShowInningsRecap] = useState<InningsBundle | null>(null);
  const [showMatchRecap, setShowMatchRecap] = useState(false);
  const [betweenInnings, setBetweenInnings] = useState(false); // true after innings 1 closed, before innings 2 setup

  // Load match + current open innings
  useEffect(() => {
    if (!matchId) return;
    setMatch({
      id: matchId,
      match_name: "Sunday Showdown",
      team_a: "Team A",
      team_b: "Team B",
      owner_id: user?.id || "local-user",
    });
    setSetupTeam("Team A");
    setSetupBowl("Team B");
  }, [matchId, user?.id]);

  const isOwner = !!user && !!match && user.id === match.owner_id;

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !matchId) return "";
    return `${window.location.origin}/scoring/${matchId}`;
  }, [matchId]);

  const copyShareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: match?.match_name || "Live match", text: "Watch this live match", url: shareUrl });
        return;
      }
    } catch { /* fall through to clipboard */ }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Live link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — long-press the URL bar");
    }
  };

  const startInnings = async () => {
    if (!match || !setupTeam.trim()) return toast.error("Enter batting team");
    setSubmitting(true);
    const nextNumber = closedBundles.length + 1;
    setInnings({
      id: `innings-${Date.now()}`,
      innings_number: nextNumber,
      batting_team: setupTeam.trim(),
      bowling_team: setupBowl.trim() || null,
      total_runs: 0,
      total_wickets: 0,
      total_balls: 0,
      extras: 0,
      is_closed: false,
    });
    setBalls([]);
    setBetweenInnings(false);
    setBatsman("");
    setBowler("");
    setSubmitting(false);
  };

  const recordBall = async (action: typeof ACTIONS[number]) => {
    if (!innings) return;
    const isExtra = action.event === "wide" || action.event === "no_ball";
    const isWicket = action.event === "wicket";
    const newBalls = isExtra ? innings.total_balls : innings.total_balls + 1;
    const overNum = Math.floor(innings.total_balls / 6);
    const ballNum = (innings.total_balls % 6) + 1;

    const updated = {
      ...innings,
      total_runs: innings.total_runs + action.runs,
      total_wickets: innings.total_wickets + (isWicket ? 1 : 0),
      total_balls: newBalls,
      extras: innings.extras + (isExtra ? 1 : 0),
    };
    setInnings(updated);

    const nextBall: Ball = {
      id: `ball-${Date.now()}`,
      over_number: overNum,
      ball_number: ballNum,
      runs: action.runs,
      event: action.event,
      batsman_name: batsman.trim() || null,
      bowler_name: bowler.trim() || null,
    };
    setBalls((current) => [...current, nextBall]);
  };

  const undoLast = async () => {
    if (!innings || balls.length === 0) return;
    const last = balls[balls.length - 1];
    const isExtra = last.event === "wide" || last.event === "no_ball";
    const isWicket = last.event === "wicket";

    const updated = {
      ...innings,
      total_runs: Math.max(0, innings.total_runs - last.runs),
      total_wickets: Math.max(0, innings.total_wickets - (isWicket ? 1 : 0)),
      total_balls: Math.max(0, innings.total_balls - (isExtra ? 0 : 1)),
      extras: Math.max(0, innings.extras - (isExtra ? 1 : 0)),
    };
    setInnings(updated);
    setBalls((current) => current.slice(0, -1));
  };

  const closeInnings = async () => {
    if (!innings || !match) return;
    const finishedBundle: InningsBundle = {
      innings: { ...innings, is_closed: true },
      balls: [...balls],
    };
    const newBundles = [...closedBundles, finishedBundle];
    setClosedBundles(newBundles);

    if (newBundles.length >= 2) {
      // Match complete
      setInnings(null);
      setBalls([]);
      setShowMatchRecap(true);
    } else {
      // First innings done — show innings recap, prepare innings 2
      setInnings(null);
      setBalls([]);
      setBetweenInnings(true);
      // Swap teams for innings 2
      const battedTeam = innings.batting_team;
      const bowledTeam = innings.bowling_team || "";
      setSetupTeam(bowledTeam);
      setSetupBowl(battedTeam);
      setShowInningsRecap(finishedBundle);
    }
  };

  if (!match) {
    return <div className="px-4 pt-10 text-center text-muted-foreground">Loading match…</div>;
  }

  return (
    <div className="px-4 pt-6 pb-10 space-y-5 max-w-2xl mx-auto">
      <header className="flex items-center justify-between">
        <Link to="/" className="h-10 w-10 rounded-full bg-card border border-border grid place-items-center">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="text-center">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Live Scoring</p>
          <h1 className="font-bold leading-tight">{match.match_name}</h1>
        </div>
        <button
          onClick={copyShareLink}
          aria-label="Share live link"
          className="h-10 w-10 rounded-full bg-card border border-border grid place-items-center"
        >
          {copied ? <Check className="h-5 w-5 text-primary" /> : <Share2 className="h-5 w-5" />}
        </button>
      </header>

      {/* Share link card */}
      <button
        onClick={copyShareLink}
        className="w-full flex items-center gap-2 rounded-2xl bg-card border border-border px-4 py-3 text-left hover:border-primary/60 transition-colors"
      >
        <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground truncate flex-1">{shareUrl}</span>
        <span className="text-[11px] font-bold text-primary uppercase tracking-wider">{copied ? "Copied" : "Share"}</span>
      </button>

      {!innings && isOwner && closedBundles.length < 2 && (
        <div className="space-y-4 animate-float-up">
          {/* Show innings 1 summary card if between innings */}
          {betweenInnings && closedBundles[0] && (
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Innings 1 · {closedBundles[0].innings.batting_team}</p>
              <p className="text-3xl font-black mt-1">{closedBundles[0].innings.total_runs}/{closedBundles[0].innings.total_wickets}
                <span className="text-sm font-bold text-muted-foreground ml-2">({fmtOvers(closedBundles[0].innings.total_balls)} ov)</span>
              </p>
              <button
                onClick={() => setShowInningsRecap(closedBundles[0])}
                className="mt-2 text-xs font-bold text-primary"
              >
                View innings 1 recap →
              </button>
            </div>
          )}
          <div className="rounded-3xl border border-border bg-card p-5 space-y-3">
            <h2 className="font-bold">
              {betweenInnings ? `Start innings 2 · Target ${(closedBundles[0]?.innings.total_runs ?? 0) + 1}` : "Start innings"}
            </h2>
            <Input placeholder="Batting team" value={setupTeam} onChange={(e) => setSetupTeam(e.target.value)} className="h-12 rounded-2xl bg-background border-border" />
            <Input placeholder="Bowling team (optional)" value={setupBowl} onChange={(e) => setSetupBowl(e.target.value)} className="h-12 rounded-2xl bg-background border-border" />
            <Button variant="hero" size="xl" className="w-full" onClick={startInnings} disabled={submitting}>
              <Plus className="h-5 w-5" /> {betweenInnings ? "Start innings 2" : "Start scoring"}
            </Button>
          </div>
        </div>
      )}

      {!innings && !isOwner && closedBundles.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center space-y-2">
          <Radio className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="font-bold">Match hasn't started yet</p>
          <p className="text-sm text-muted-foreground">The scorer will start the innings shortly. This page will update live.</p>
        </div>
      )}

      {!innings && !isOwner && closedBundles.length === 1 && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-card border border-border p-4 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Innings 1 · {closedBundles[0].innings.batting_team}</p>
            <p className="text-3xl font-black mt-1">{closedBundles[0].innings.total_runs}/{closedBundles[0].innings.total_wickets}</p>
            <p className="text-xs text-muted-foreground">({fmtOvers(closedBundles[0].innings.total_balls)} ov) · Target {closedBundles[0].innings.total_runs + 1}</p>
          </div>
          <p className="text-xs text-center text-muted-foreground">Waiting for innings 2 to begin…</p>
        </div>
      )}

      {!innings && closedBundles.length >= 2 && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-card border border-border p-4 text-center space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Match complete</p>
            <Button variant="hero" size="lg" className="w-full" onClick={() => setShowMatchRecap(true)}>
              <Trophy className="h-4 w-4" /> View match recap
            </Button>
          </div>
        </div>
      )}

      {innings && (
        <>
          {/* Scoreboard */}
          <div className="rounded-3xl bg-gradient-cta p-6 text-primary-foreground glow-primary">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-90">
              <span className="flex items-center gap-2"><Radio className="h-3.5 w-3.5 animate-pulse" /> Live · {innings.batting_team}</span>
              <span>Innings {innings.innings_number}</span>
            </div>
            <div className="mt-2 flex items-end gap-3">
              <p className="text-6xl font-black leading-none">
                {innings.total_runs}/{innings.total_wickets}
              </p>
              <p className="pb-2 text-sm font-bold opacity-90">({fmtOvers(innings.total_balls)} ov)</p>
            </div>
            {innings.innings_number === 2 && closedBundles[0] && (
              <p className="mt-1 text-xs font-bold opacity-90">
                Target {closedBundles[0].innings.total_runs + 1} · Need {Math.max(0, closedBundles[0].innings.total_runs + 1 - innings.total_runs)} more
              </p>
            )}
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <Stat label="Run rate" value={innings.total_balls > 0 ? ((innings.total_runs / innings.total_balls) * 6).toFixed(2) : "0.00"} />
              <Stat label="Extras" value={innings.extras} />
              <Stat label="Balls" value={innings.total_balls} />
            </div>
          </div>

          {/* Recent balls */}
          <div className="rounded-3xl border border-border bg-card p-4 space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">This over</p>
            <div className="flex flex-wrap gap-1.5">
              {balls.slice(-12).map((b) => (
                <span key={b.id} className={`h-9 min-w-9 px-2 rounded-full inline-flex items-center justify-center text-xs font-black ${
                  b.event === "six" ? "bg-accent text-accent-foreground"
                  : b.event === "four" ? "bg-secondary text-secondary-foreground"
                  : b.event === "wicket" ? "bg-destructive text-destructive-foreground"
                  : "bg-muted text-foreground"
                }`}>
                  {b.event === "wicket" ? "W" : b.event === "wide" ? "WD" : b.event === "no_ball" ? "NB" : b.runs}
                </span>
              ))}
              {balls.length === 0 && <span className="text-xs text-muted-foreground">First ball coming up…</span>}
            </div>
          </div>

          {/* Action grid - owner only */}
          {isOwner && (
            <>
              {/* Quick tag chips — fast one-tap event capture, like Reels live tagging */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Quick tag</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { recordBall(ACTIONS[4]); toast.success("🏏 Four tagged"); }}
                    className="h-14 rounded-2xl bg-secondary text-secondary-foreground font-black text-base active:scale-95 transition-transform"
                  >
                    This is 4
                  </button>
                  <button
                    onClick={() => { recordBall(ACTIONS[5]); toast.success("💥 Six tagged"); }}
                    className="h-14 rounded-2xl bg-accent text-accent-foreground font-black text-base glow-orange active:scale-95 transition-transform"
                  >
                    This is 6
                  </button>
                  <button
                    onClick={() => { recordBall(ACTIONS[8]); toast.success("🎯 Wicket tagged"); }}
                    className="h-14 rounded-2xl bg-destructive text-destructive-foreground font-black text-base active:scale-95 transition-transform"
                  >
                    Wicket
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="On-strike batsman" value={batsman} onChange={(e) => setBatsman(e.target.value)} className="h-11 rounded-2xl bg-card border-border" />
                <Input placeholder="Current bowler" value={bowler} onChange={(e) => setBowler(e.target.value)} className="h-11 rounded-2xl bg-card border-border" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ACTIONS.map((a, idx) => (
                  <button
                    key={idx}
                    onClick={() => recordBall(a)}
                    className={`h-16 rounded-2xl font-black text-xl border border-border ${a.cls} active:scale-95 transition-transform`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="soft" size="lg" onClick={undoLast} disabled={balls.length === 0}>
                  <RotateCcw className="h-4 w-4" /> Undo
                </Button>
                <Button variant="accent" size="lg" onClick={closeInnings}>
                  <Trophy className="h-4 w-4" /> {closedBundles.length === 0 ? "End innings" : "End match"}
                </Button>
              </div>
            </>
          )}

          {!isOwner && (
            <div className="rounded-2xl bg-card border border-border p-3 text-center text-xs text-muted-foreground">
              👀 You're watching live. Updates appear automatically.
            </div>
          )}
        </>
      )}

      {/* Single innings recap (between innings 1 and 2) */}
      <InningsRecapDialog
        open={!!showInningsRecap}
        onClose={() => setShowInningsRecap(null)}
        bundle={showInningsRecap}
        matchName={match.match_name}
        title="Innings Recap"
      />

      {/* Full match recap (after innings 2) */}
      <MatchRecapDialog
        open={showMatchRecap}
        onClose={() => { setShowMatchRecap(false); navigate("/"); }}
        bundles={closedBundles}
        matchName={match.match_name}
      />
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div>
    <p className="text-lg font-black leading-tight">{value}</p>
    <p className="text-[10px] uppercase tracking-wider opacity-90">{label}</p>
  </div>
);

// ----- Recap helpers -----

function summarize(bundle: InningsBundle) {
  const { innings, balls } = bundle;
  const batMap = new Map<string, { runs: number; balls: number; fours: number; sixes: number }>();
  const bowlMap = new Map<string, { wickets: number; runsConceded: number; balls: number }>();
  const overMap = new Map<number, number>();

  for (const b of balls) {
    const isExtra = b.event === "wide" || b.event === "no_ball";
    const name = b.batsman_name?.trim();
    if (name && !isExtra) {
      const cur = batMap.get(name) || { runs: 0, balls: 0, fours: 0, sixes: 0 };
      cur.runs += b.event === "wicket" ? 0 : b.runs;
      cur.balls += 1;
      if (b.event === "four") cur.fours += 1;
      if (b.event === "six") cur.sixes += 1;
      batMap.set(name, cur);
    }
    const bn = b.bowler_name?.trim();
    if (bn) {
      const cur = bowlMap.get(bn) || { wickets: 0, runsConceded: 0, balls: 0 };
      if (b.event === "wicket") cur.wickets += 1;
      cur.runsConceded += b.runs;
      if (!isExtra) cur.balls += 1;
      bowlMap.set(bn, cur);
    }
    overMap.set(b.over_number, (overMap.get(b.over_number) || 0) + b.runs);
  }

  const topBatters = [...batMap.entries()]
    .map(([name, s]) => ({ name, ...s, sr: s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : "0.0" }))
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 3);

  const topBowlers = [...bowlMap.entries()]
    .map(([name, s]) => ({ name, ...s, overs: fmtOvers(s.balls), econ: s.balls > 0 ? ((s.runsConceded / s.balls) * 6).toFixed(2) : "0.00" }))
    .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)
    .slice(0, 3);

  const overs = [...overMap.entries()].sort(([a], [b]) => a - b).map(([n, r]) => ({ over: n + 1, runs: r }));
  const wickets = balls.filter((b) => b.event === "wicket").length;
  const boundaries = balls.filter((b) => b.event === "four" || b.event === "six").length;

  return { innings, topBatters, topBowlers, overs, wickets, boundaries };
}

function InningsBlock({ bundle, label }: { bundle: InningsBundle; label?: string }) {
  const s = useMemo(() => summarize(bundle), [bundle]);
  const { innings } = bundle;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-cta p-5 text-primary-foreground text-center">
        {label && <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">{label}</p>}
        <p className="text-xs font-bold uppercase tracking-wider opacity-90 mt-1">{innings.batting_team}</p>
        <p className="text-5xl font-black mt-1">{innings.total_runs}/{innings.total_wickets}</p>
        <p className="text-sm font-bold opacity-90 mt-1">
          {fmtOvers(innings.total_balls)} overs · RR {innings.total_balls > 0 ? ((innings.total_runs / innings.total_balls) * 6).toFixed(2) : "0.00"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Boundaries" value={s.boundaries} />
        <MiniStat label="Wickets" value={s.wickets} />
        <MiniStat label="Extras" value={innings.extras} />
      </div>

      <Section title="🏏 Top scorers">
        {s.topBatters.length > 0 ? (
          <ul className="space-y-1.5">
            {s.topBatters.map((b) => (
              <li key={b.name} className="flex items-center justify-between text-sm bg-card border border-border rounded-xl px-3 py-2">
                <span className="font-bold truncate">{b.name}</span>
                <span className="font-mono text-xs">
                  <span className="font-black text-base">{b.runs}</span>
                  <span className="text-muted-foreground"> ({b.balls}) · {b.fours}×4 · {b.sixes}×6 · SR {b.sr}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No batsman names recorded.</p>
        )}
      </Section>

      <Section title="🎯 Wicket-takers">
        {s.topBowlers.filter(b => b.wickets > 0).length > 0 ? (
          <ul className="space-y-1.5">
            {s.topBowlers.filter(b => b.wickets > 0).map((b) => (
              <li key={b.name} className="flex items-center justify-between text-sm bg-card border border-border rounded-xl px-3 py-2">
                <span className="font-bold truncate">{b.name}</span>
                <span className="font-mono text-xs">
                  <span className="font-black text-base">{b.wickets}/{b.runsConceded}</span>
                  <span className="text-muted-foreground"> · {b.overs} ov · Econ {b.econ}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No wickets recorded with bowler names.</p>
        )}
      </Section>

      <Section title="📊 Overs breakdown">
        {s.overs.length > 0 ? (
          <div className="space-y-1">
            {s.overs.map((o) => {
              const max = Math.max(...s.overs.map((x) => x.runs), 6);
              return (
                <div key={o.over} className="flex items-center gap-2 text-xs">
                  <span className="w-10 font-mono text-muted-foreground">Ov {o.over}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-cta" style={{ width: `${(o.runs / max) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right font-bold">{o.runs}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No overs played.</p>
        )}
      </Section>
    </div>
  );
}

function InningsRecapDialog({ open, onClose, bundle, matchName, title }: {
  open: boolean;
  onClose: () => void;
  bundle: InningsBundle | null;
  matchName: string;
  title: string;
}) {
  if (!bundle) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black flex items-center gap-2">
            <Trophy className="h-6 w-6 text-accent" /> {title}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{matchName}</p>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          <InningsBlock bundle={bundle} label={`Innings ${bundle.innings.innings_number}`} />
          <Button variant="hero" size="xl" className="w-full" onClick={onClose}>
            Close recap
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MatchRecapDialog({ open, onClose, bundles, matchName }: {
  open: boolean;
  onClose: () => void;
  bundles: InningsBundle[];
  matchName: string;
}) {
  const [tab, setTab] = useState<"summary" | "i1" | "i2">("summary");

  const result = useMemo(() => {
    if (bundles.length < 2) return null;
    const [a, b] = bundles;
    if (a.innings.total_runs > b.innings.total_runs) {
      return { winner: a.innings.batting_team, by: `${a.innings.total_runs - b.innings.total_runs} runs` };
    }
    if (b.innings.total_runs > a.innings.total_runs) {
      const wicketsLeft = 10 - b.innings.total_wickets;
      return { winner: b.innings.batting_team, by: `${wicketsLeft} wickets` };
    }
    return { winner: null, by: "Match tied" };
  }, [bundles]);

  if (bundles.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black flex items-center gap-2">
            <Trophy className="h-6 w-6 text-accent" /> Match Recap
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{matchName}</p>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Result banner */}
          {result && (
            <div className="rounded-2xl bg-accent/15 border border-accent/40 p-4 text-center">
              {result.winner ? (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Result</p>
                  <p className="text-xl font-black mt-1 text-accent">{result.winner} won</p>
                  <p className="text-xs font-bold text-muted-foreground">by {result.by}</p>
                </>
              ) : (
                <p className="text-xl font-black text-accent">{result.by}</p>
              )}
            </div>
          )}

          {/* Side-by-side summary */}
          <div className="grid grid-cols-2 gap-2">
            {bundles.map((b) => (
              <div key={b.innings.id} className="rounded-2xl bg-card border border-border p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Innings {b.innings.innings_number}</p>
                <p className="text-xs font-bold mt-0.5 truncate">{b.innings.batting_team}</p>
                <p className="text-2xl font-black mt-1">{b.innings.total_runs}/{b.innings.total_wickets}</p>
                <p className="text-[10px] text-muted-foreground">{fmtOvers(b.innings.total_balls)} ov</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5">
            {(["summary", "i1", "i2"] as const).map((t) => {
              if (t === "i2" && bundles.length < 2) return null;
              const label = t === "summary" ? "Summary" : t === "i1" ? `I1 · ${bundles[0]?.innings.batting_team}` : `I2 · ${bundles[1]?.innings.batting_team}`;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 h-9 rounded-xl text-xs font-bold transition truncate px-2 ${
                    tab === t ? "bg-foreground text-background" : "bg-card border border-border text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {tab === "summary" && (
            <CombinedSummary bundles={bundles} />
          )}
          {tab === "i1" && bundles[0] && <InningsBlock bundle={bundles[0]} />}
          {tab === "i2" && bundles[1] && <InningsBlock bundle={bundles[1]} />}

          <Button variant="hero" size="xl" className="w-full" onClick={onClose}>
            Back to feed
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CombinedSummary({ bundles }: { bundles: InningsBundle[] }) {
  const summaries = bundles.map(summarize);

  // Best batter & best bowler across both innings
  const allBatters = summaries.flatMap((s) => s.topBatters);
  const allBowlers = summaries.flatMap((s) => s.topBowlers);
  const bestBatter = allBatters.sort((a, b) => b.runs - a.runs)[0];
  const bestBowler = allBowlers.sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)[0];

  const totalBoundaries = summaries.reduce((n, s) => n + s.boundaries, 0);
  const totalWickets = summaries.reduce((n, s) => n + s.wickets, 0);
  const totalExtras = summaries.reduce((n, s) => n + s.innings.extras, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Boundaries" value={totalBoundaries} />
        <MiniStat label="Wickets" value={totalWickets} />
        <MiniStat label="Extras" value={totalExtras} />
      </div>

      <Section title="⭐ Player of the match">
        {bestBatter || bestBowler ? (
          <div className="grid grid-cols-2 gap-2">
            {bestBatter && (
              <div className="rounded-xl bg-card border border-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Top batter</p>
                <p className="font-bold truncate">{bestBatter.name}</p>
                <p className="text-xs text-muted-foreground">{bestBatter.runs} ({bestBatter.balls}) · SR {bestBatter.sr}</p>
              </div>
            )}
            {bestBowler && bestBowler.wickets > 0 && (
              <div className="rounded-xl bg-card border border-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Top bowler</p>
                <p className="font-bold truncate">{bestBowler.name}</p>
                <p className="text-xs text-muted-foreground">{bestBowler.wickets}/{bestBowler.runsConceded} · {bestBowler.overs} ov</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Player names weren't recorded during scoring.</p>
        )}
      </Section>

      <Section title="📈 Innings comparison">
        {summaries.map((s) => {
          const max = Math.max(...summaries.flatMap((x) => x.overs.map((o) => o.runs)), 6);
          return (
            <div key={s.innings.id} className="space-y-1">
              <p className="text-[11px] font-bold text-muted-foreground">Innings {s.innings.innings_number} · {s.innings.batting_team}</p>
              {s.overs.map((o) => (
                <div key={o.over} className="flex items-center gap-2 text-xs">
                  <span className="w-10 font-mono text-muted-foreground">Ov {o.over}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${s.innings.innings_number === 1 ? "bg-primary" : "bg-accent"}`}
                      style={{ width: `${(o.runs / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-bold">{o.runs}</span>
                </div>
              ))}
            </div>
          );
        })}
      </Section>
    </div>
  );
}

const MiniStat = ({ label, value }: { label: string; value: number | string }) => (
  <div className="rounded-xl bg-card border border-border p-3 text-center">
    <p className="text-2xl font-black leading-tight">{value}</p>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <h3 className="text-sm font-bold">{title}</h3>
    {children}
  </div>
);
