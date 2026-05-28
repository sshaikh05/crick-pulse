import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Share2, Trophy, Calendar, Radio, ChevronRight, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShareSheet } from "@/components/ShareSheet";

const TOURNAMENTS: Record<string, { name: string; format: string; venue: string; starts: string; status: "live" | "upcoming" | "ended"; teams: number; about: string; teamIds: string[]; fixtures: { aId: string; a: string; bId: string; b: string; t: string; matchId?: string }[]; standings: { teamId: string; team: string; p: number; w: number; l: number; pts: number }[] }> = {
  tr1: { name: "City Premier League", format: "T20", venue: "Wankhede Ground", starts: "Live now", status: "live", teams: 12, about: "8-week city championship featuring Mumbai's top 12 club sides.", teamIds: ["t1", "t2"], fixtures: [
    { aId: "t1", a: "Lions XI", bId: "t2", b: "Royal Strikers", t: "Today · 7:30 PM", matchId: "tr-live" },
    { aId: "t3", a: "Night Hawks", bId: "t4", b: "Sunrise CC", t: "Sat · 5:00 PM" },
  ], standings: [
    { teamId: "t1", team: "Lions XI", p: 8, w: 7, l: 1, pts: 14 },
    { teamId: "t2", team: "Royal Strikers", p: 8, w: 5, l: 3, pts: 10 },
    { teamId: "t3", team: "Night Hawks", p: 8, w: 4, l: 4, pts: 8 },
    { teamId: "t4", team: "Sunrise CC", p: 8, w: 2, l: 6, pts: 4 },
  ] },
  tr2: { name: "Monsoon Cup 2026", format: "T10", venue: "DY Patil", starts: "May 12", status: "upcoming", teams: 8, about: "Fast-format knockout under the lights.", teamIds: ["t3"], fixtures: [], standings: [] },
  tr3: { name: "Corporate Smash", format: "T20", venue: "MIG Club", starts: "Apr 02", status: "ended", teams: 16, about: "Corporate league across 4 weekends.", teamIds: ["t4"], fixtures: [], standings: [] },
};

export default function TournamentDetail() {
  const { id = "" } = useParams();
  const t = TOURNAMENTS[id] ?? TOURNAMENTS.tr1;
  const [shareOpen, setShareOpen] = useState(false);
  const url = useMemo(() => `${window.location.origin}/tournament/${id}`, [id]);

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="relative w-full max-w-[440px] min-h-screen border-x border-border/40">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/85 border-b border-border/60">
          <div className="flex items-center justify-between px-4 h-14">
            <Link to="/search" className="h-9 w-9 grid place-items-center rounded-full bg-card border border-border" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-base font-extrabold">Tournament</h1>
            <button onClick={() => setShareOpen(true)} className="h-9 w-9 rounded-full bg-card border border-border grid place-items-center" aria-label="Share">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="px-4 py-5 space-y-5">
          <section className="rounded-3xl bg-gradient-to-br from-accent/15 via-card to-card border border-border p-5">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-3xl bg-accent/25 border border-accent/40 grid place-items-center"><Trophy className="h-9 w-9 text-accent" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold truncate">{t.name}</h2>
                  <span className={cn(
                    "shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                    t.status === "live" && "bg-destructive/15 text-destructive border-destructive/40",
                    t.status === "upcoming" && "bg-primary/15 text-primary border-primary/40",
                    t.status === "ended" && "bg-muted text-muted-foreground border-border",
                  )}>{t.status}</span>
                </div>
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1"><MapPin className="h-3 w-3" />{t.venue}</p>
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5"><Calendar className="h-3 w-3" />{t.starts} · {t.format}</p>
              </div>
            </div>
            <p className="text-sm text-foreground/80 mt-4">{t.about}</p>
            <div className="mt-4 flex gap-2">
              {t.status === "live" ? (
                <Button asChild variant="accent" size="sm" className="flex-1"><Link to="/scoring/tr-live"><Radio className="h-4 w-4" />Watch live</Link></Button>
              ) : (
                <Button variant="neon" size="sm" className="flex-1">Follow</Button>
              )}
              <Button variant="soft" size="sm" className="flex-1" onClick={() => setShareOpen(true)}>Share</Button>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2">
            {[{ l: "Teams", v: t.teams }, { l: "Format", v: t.format }, { l: "Status", v: t.status }].map((s) => (
              <div key={s.l} className="rounded-2xl bg-card border border-border p-3 text-center">
                <p className="text-sm font-black capitalize">{s.v}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{s.l}</p>
              </div>
            ))}
          </section>

          {t.standings.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Standings</h3>
              <div className="rounded-2xl bg-card border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                  <span>Team</span><span>P</span><span>W</span><span>L</span><span>Pts</span>
                </div>
                {t.standings.map((s, i) => (
                  <Link key={s.teamId} to={`/team/${s.teamId}`} className={cn("grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40", i !== t.standings.length - 1 && "border-b border-border/60")}>
                    <span className="font-semibold inline-flex items-center gap-2">
                      <span className="text-muted-foreground text-xs w-4">{i + 1}</span>{s.team}
                    </span>
                    <span className="text-muted-foreground tabular-nums w-5 text-right">{s.p}</span>
                    <span className="text-muted-foreground tabular-nums w-5 text-right">{s.w}</span>
                    <span className="text-muted-foreground tabular-nums w-5 text-right">{s.l}</span>
                    <span className="font-black text-primary tabular-nums w-6 text-right">{s.pts}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fixtures</h3>
            <div className="space-y-2">
              {t.fixtures.length === 0 && <p className="text-sm text-muted-foreground">No fixtures published.</p>}
              {t.fixtures.map((m, i) => (
                <div key={i} className="p-3 rounded-2xl bg-card border border-border">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <Link to={`/team/${m.aId}`} className="hover:text-primary">{m.a}</Link>
                      <span className="text-muted-foreground font-normal">vs</span>
                      <Link to={`/team/${m.bId}`} className="hover:text-primary">{m.b}</Link>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{m.t}</span>
                  </div>
                  {m.matchId && (
                    <Link to={`/scoring/${m.matchId}`} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-accent">
                      <Radio className="h-3 w-3" /> Watch live <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        </main>

        <ShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          url={url}
          title={t.name}
          subtitle={`${t.format} · ${t.venue}`}
        />
      </div>
    </div>
  );
}
