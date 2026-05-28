import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Share2, Trophy, Users, ChevronRight, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareSheet } from "@/components/ShareSheet";

const TEAMS: Record<string, { name: string; city: string; members: number; wins: number; losses: number; founded: string; about: string; tournamentId: string; tournamentName: string; roster: { id: string; name: string; role: string }[]; recent: { a: string; b: string; r: string; opponentTeamId?: string }[] }> = {
  t1: { name: "Lions XI", city: "Mumbai", members: 14, wins: 22, losses: 6, founded: "2019", about: "Mumbai's premier club side with three city-league titles.", tournamentId: "tr1", tournamentName: "City Premier League", roster: [
    { id: "p1", name: "Shahnawaz Ali", role: "Batter" },
    { id: "p4", name: "Rohit Verma", role: "Wicket-keeper" },
  ], recent: [{ a: "Lions XI", b: "Royal Strikers", r: "Won by 5 wkts", opponentTeamId: "t2" }, { a: "Lions XI", b: "Sunrise CC", r: "Won by 22 runs", opponentTeamId: "t4" }] },
  t2: { name: "Royal Strikers", city: "Delhi", members: 13, wins: 18, losses: 9, founded: "2020", about: "Aggressive batting, even more aggressive fielding.", tournamentId: "tr1", tournamentName: "City Premier League", roster: [{ id: "p2", name: "Arjun Khanna", role: "All-rounder" }], recent: [{ a: "Royal Strikers", b: "Lions XI", r: "Lost by 5 wkts", opponentTeamId: "t1" }] },
  t3: { name: "Night Hawks", city: "Bangalore", members: 15, wins: 16, losses: 11, founded: "2018", about: "Bowling-first outfit, swarms in the death overs.", tournamentId: "tr2", tournamentName: "Monsoon Cup 2026", roster: [{ id: "p3", name: "Imran Ahmed", role: "Bowler" }], recent: [] },
  t4: { name: "Sunrise CC", city: "Pune", members: 12, wins: 9, losses: 14, founded: "2022", about: "Young squad on the rise.", tournamentId: "tr3", tournamentName: "Corporate Smash", roster: [], recent: [] },
};

export default function TeamDetail() {
  const { id = "" } = useParams();
  const t = TEAMS[id] ?? TEAMS.t1;
  const [shareOpen, setShareOpen] = useState(false);
  const url = useMemo(() => `${window.location.origin}/team/${id}`, [id]);

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="relative w-full max-w-[440px] min-h-screen border-x border-border/40">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/85 border-b border-border/60">
          <div className="flex items-center justify-between px-4 h-14">
            <Link to="/search" className="h-9 w-9 grid place-items-center rounded-full bg-card border border-border" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-base font-extrabold">Team</h1>
            <button onClick={() => setShareOpen(true)} className="h-9 w-9 rounded-full bg-card border border-border grid place-items-center" aria-label="Share">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="px-4 py-5 space-y-5">
          <section className="rounded-3xl bg-gradient-to-br from-secondary/15 via-card to-card border border-border p-5">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-3xl bg-secondary/25 border border-secondary/40 grid place-items-center text-3xl font-black text-secondary">{t.name[0]}</div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-extrabold truncate">{t.name}</h2>
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1"><MapPin className="h-3 w-3" />{t.city} · since {t.founded}</p>
                <Link to={`/tournament/${t.tournamentId}`} className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 mt-1">
                  <Trophy className="h-3 w-3" /> {t.tournamentName}
                </Link>
              </div>
            </div>
            <p className="text-sm text-foreground/80 mt-4">{t.about}</p>
            <div className="mt-4 flex gap-2">
              <Button variant="neon" size="sm" className="flex-1">Follow team</Button>
              <Button asChild variant="soft" size="sm" className="flex-1">
                <Link to={`/tournament/${t.tournamentId}`}><BarChart3 className="h-4 w-4" />Standings</Link>
              </Button>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2">
            {[{ l: "Players", v: t.members }, { l: "Wins", v: t.wins }, { l: "Losses", v: t.losses }].map((s) => (
              <div key={s.l} className="rounded-2xl bg-card border border-border p-3 text-center">
                <p className="text-lg font-black">{s.v}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{s.l}</p>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Squad</h3>
            <ul className="space-y-2">
              {t.roster.length === 0 && <p className="text-sm text-muted-foreground">Roster not published yet.</p>}
              {t.roster.map((r) => (
                <li key={r.id}>
                  <Link to={`/player/${r.id}`} className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border transition-colors hover:border-primary/40">
                    <div className="h-11 w-11 rounded-2xl bg-primary/20 border border-primary/40 grid place-items-center font-black text-primary">{r.name[0]}</div>
                    <div className="flex-1"><p className="font-bold text-sm">{r.name}</p><p className="text-xs text-muted-foreground">{r.role}</p></div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> Recent results</h3>
            <div className="space-y-2">
              {t.recent.map((m, i) => {
                const Inner = (
                  <div className="p-3 rounded-2xl bg-card border border-border flex items-center justify-between transition-colors hover:border-primary/40">
                    <p className="font-bold text-sm">
                      {m.a} <span className="text-muted-foreground">vs</span> {m.b}
                    </p>
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/40">{m.r}</span>
                  </div>
                );
                return m.opponentTeamId ? (
                  <Link key={i} to={`/team/${m.opponentTeamId}`}>{Inner}</Link>
                ) : (
                  <div key={i}>{Inner}</div>
                );
              })}
            </div>
          </section>
        </main>

        <ShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          url={url}
          title={t.name}
          subtitle={`${t.city} · ${t.tournamentName}`}
        />
      </div>
    </div>
  );
}
