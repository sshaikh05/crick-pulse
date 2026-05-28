import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Crown, Flame, Medal, RefreshCw, ShieldCheck, Target, TrendingUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLeaderboard } from "@/lib/api";
import avatar from "@/assets/player-avatar.jpg";

type Period = "week" | "month" | "all";
type Metric = "runs" | "wickets";

interface RowData {
  user_id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  player_role: string | null;
  location: string | null;
  verified?: boolean;
  runs: number;
  wickets: number;
  matches: number;
  demo?: boolean;
}

const periods: Array<{ value: Period; label: string }> = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];

const metricOptions: Array<{ value: Metric; label: string; icon: typeof Flame }> = [
  { value: "runs", label: "Most runs", icon: Flame },
  { value: "wickets", label: "Most wickets", icon: Target },
];

const demoBase = [
  { name: "Shahnawaz Shanu", handle: "shahnawazshanu", role: "All-Rounder", location: "Indore", avatar: "https://api.dicebear.com/9.x/initials/svg?seed=Shahnawaz%20Shanu" },
  { name: "Aryan Verma", handle: "aryanverma", role: "Top Order", location: "Mumbai", avatar: "https://api.dicebear.com/9.x/initials/svg?seed=Aryan%20Verma" },
  { name: "Rohit Kings", handle: "rohitkings", role: "Power Hitter", location: "Delhi", avatar: "https://api.dicebear.com/9.x/initials/svg?seed=Rohit%20Kings" },
  { name: "Akash XI", handle: "akashxi", role: "Fast Bowler", location: "Jaipur", avatar: "https://api.dicebear.com/9.x/initials/svg?seed=Akash%20XI" },
  { name: "CricketBoy_18", handle: "cricketboy18", role: "Finisher", location: "Pune", avatar: "https://api.dicebear.com/9.x/initials/svg?seed=CricketBoy" },
  { name: "Sultan Striker", handle: "sultanstriker", role: "Swing Bowler", location: "Bhopal", avatar: "https://api.dicebear.com/9.x/initials/svg?seed=Sultan%20Striker" },
];

const demoStats: Record<Period, Record<Metric, Array<{ runs: number; wickets: number; matches: number }>>> = {
  week: {
    runs: [
      { runs: 245, wickets: 4, matches: 5 },
      { runs: 198, wickets: 2, matches: 4 },
      { runs: 176, wickets: 7, matches: 4 },
      { runs: 142, wickets: 12, matches: 6 },
      { runs: 119, wickets: 3, matches: 3 },
      { runs: 96, wickets: 10, matches: 5 },
    ],
    wickets: [
      { runs: 142, wickets: 12, matches: 6 },
      { runs: 96, wickets: 10, matches: 5 },
      { runs: 176, wickets: 8, matches: 4 },
      { runs: 88, wickets: 7, matches: 4 },
      { runs: 245, wickets: 4, matches: 5 },
      { runs: 119, wickets: 3, matches: 3 },
    ],
  },
  month: {
    runs: [
      { runs: 672, wickets: 10, matches: 12 },
      { runs: 588, wickets: 5, matches: 10 },
      { runs: 521, wickets: 18, matches: 11 },
      { runs: 466, wickets: 21, matches: 13 },
      { runs: 405, wickets: 8, matches: 9 },
      { runs: 377, wickets: 16, matches: 10 },
    ],
    wickets: [
      { runs: 466, wickets: 21, matches: 13 },
      { runs: 521, wickets: 18, matches: 11 },
      { runs: 377, wickets: 16, matches: 10 },
      { runs: 672, wickets: 10, matches: 12 },
      { runs: 405, wickets: 8, matches: 9 },
      { runs: 588, wickets: 5, matches: 10 },
    ],
  },
  all: {
    runs: [
      { runs: 1840, wickets: 24, matches: 34 },
      { runs: 1612, wickets: 14, matches: 31 },
      { runs: 1396, wickets: 39, matches: 28 },
      { runs: 1222, wickets: 48, matches: 37 },
      { runs: 998, wickets: 19, matches: 25 },
      { runs: 842, wickets: 36, matches: 27 },
    ],
    wickets: [
      { runs: 1222, wickets: 48, matches: 37 },
      { runs: 1396, wickets: 39, matches: 28 },
      { runs: 842, wickets: 36, matches: 27 },
      { runs: 1840, wickets: 24, matches: 34 },
      { runs: 998, wickets: 19, matches: 25 },
      { runs: 1612, wickets: 14, matches: 31 },
    ],
  },
};

const demoRows = (period: Period, metric: Metric): RowData[] =>
  demoBase.map((player, index) => ({
    user_id: `demo-${period}-${metric}-${index}`,
    display_name: player.name,
    handle: player.handle,
    avatar_url: player.avatar,
    player_role: player.role,
    location: player.location,
    verified: index < 3,
    demo: true,
    ...demoStats[period][metric][index],
  }));

export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>("week");
  const [metric, setMetric] = useState<Metric>("runs");
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usingDemo, setUsingDemo] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getLeaderboard({ period, type: metric });
      if (data.length) {
        setRows(data);
        setUsingDemo(false);
      } else {
        setRows(demoRows(period, metric));
        setUsingDemo(true);
      }
    } catch (err) {
      setRows(demoRows(period, metric));
      setUsingDemo(true);
      setError(err instanceof Error ? err.message : "Could not load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [period, metric]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const ranked = useMemo(() => {
    const metricKey = metric === "runs" ? "runs" : "wickets";
    return [...rows]
      .sort((a, b) => b[metricKey] - a[metricKey] || b.matches - a.matches)
      .slice(0, 50);
  }, [rows, metric]);

  const topThree = ranked.slice(0, 3);
  const MetricIcon = metric === "runs" ? Flame : Target;

  return (
    <div className="space-y-5 px-4 pb-10 pt-2">
      <section className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_36%),hsl(var(--card)/0.78)] p-4 shadow-2xl shadow-black/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Leaderboard</p>
            <h2 className="mt-1 flex items-center gap-2 text-2xl font-black">
              <Trophy className="h-6 w-6 text-accent" />
              Top Players
            </h2>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Ranked by real scorecards and uploaded match performances.
            </p>
          </div>
          <button
            type="button"
            onClick={loadLeaderboard}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition hover:text-primary active:scale-95"
            aria-label="Refresh leaderboard"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {usingDemo && !loading && (
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/8 px-3 py-2 text-xs font-semibold text-primary">
            Demo rankings shown until more real scorecards are available.
          </div>
        )}
        {error && !loading && (
          <div className="mt-3 rounded-2xl border border-orange-300/20 bg-orange-400/10 px-3 py-2 text-xs font-semibold text-orange-100">
            API unavailable, showing demo data.
          </div>
        )}
      </section>

      <div className="grid grid-cols-3 gap-2">
        {periods.map((item) => (
          <button
            key={item.value}
            onClick={() => setPeriod(item.value)}
            className={`h-11 rounded-2xl text-xs font-black transition active:scale-[0.98] ${
              period === item.value
                ? "bg-white text-background shadow-[0_12px_26px_rgba(255,255,255,0.12)]"
                : "border border-white/10 bg-card/70 text-muted-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {metricOptions.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setMetric(value)}
            className={`flex h-12 items-center justify-center gap-2 rounded-2xl font-black transition active:scale-[0.98] ${
              metric === value
                ? value === "runs"
                  ? "bg-primary text-primary-foreground shadow-[0_0_28px_hsl(var(--primary)/0.25)]"
                  : "bg-accent text-accent-foreground shadow-[0_0_28px_hsl(var(--accent)/0.22)]"
                : "border border-white/10 bg-card/70 text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <LeaderboardSkeleton />
      ) : ranked.length === 0 ? (
        <EmptyState onRetry={loadLeaderboard} />
      ) : (
        <>
          <Podium rows={topThree} metric={metric} />

          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-black">Rankings</p>
              <p className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                <MetricIcon className="h-3.5 w-3.5" />
                {metric === "runs" ? "Runs" : "Wickets"}
              </p>
            </div>

            <ol className="space-y-2">
              {ranked.map((row, index) => (
                <LeaderboardRow key={row.user_id} row={row} rank={index + 1} metric={metric} />
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-36 animate-pulse rounded-[26px] border border-white/10 bg-white/5" />
        ))}
      </div>
      {[0, 1, 2, 3, 4].map((item) => (
        <div key={item} className="h-20 animate-pulse rounded-[24px] border border-white/10 bg-card/70" />
      ))}
    </div>
  );
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/12 bg-card/65 p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Trophy className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-black">No rankings yet</h3>
      <p className="mt-2 text-sm text-muted-foreground">Upload matches and add scorecards to start ranking players.</p>
      <Button variant="soft" size="sm" className="mt-5" onClick={onRetry}>Retry</Button>
    </div>
  );
}

function LeaderboardRow({ row, rank, metric }: { row: RowData; rank: number; metric: Metric }) {
  const score = metric === "runs" ? row.runs : row.wickets;
  const label = metric === "runs" ? "runs" : "wkts";
  const medalTone = rank === 1 ? "text-accent" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-secondary" : "text-muted-foreground";
  const to = row.demo ? "/search" : `/player/${row.user_id}`;

  return (
    <li>
      <Link
        to={to}
        className={`flex items-center gap-3 rounded-[24px] border p-3 transition active:scale-[0.99] ${
          rank <= 3
            ? "border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.10),hsl(var(--card)/0.78))] shadow-xl shadow-black/20"
            : "border-white/10 bg-card/70 hover:border-primary/30"
        }`}
      >
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-background/50">
          {rank <= 3 ? <Medal className={`h-4 w-4 ${medalTone}`} /> : <span className="text-sm font-black text-muted-foreground">{rank}</span>}
        </div>
        <img src={row.avatar_url || avatar} alt={row.display_name} className="h-12 w-12 rounded-2xl border border-white/10 object-cover" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-black">
            <span className="truncate">{row.display_name}</span>
            {row.verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" />}
          </p>
          <p className="truncate text-xs font-semibold text-muted-foreground">@{row.handle || "player"}</p>
          <p className="truncate text-[11px] text-muted-foreground/80">
            {row.player_role || "Player"} · {row.matches} match{row.matches === 1 ? "" : "es"}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-black ${metric === "runs" ? "text-primary" : "text-accent"}`}>{score}</p>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-primary">
            <TrendingUp className="h-3 w-3" />
            Live
          </p>
        </div>
      </Link>
    </li>
  );
}

function Podium({ rows, metric }: { rows: RowData[]; metric: Metric }) {
  const [first, second, third] = rows;
  const ordered = [
    { row: second, place: 2, height: "h-20", tone: "border-slate-300/35 text-slate-200", bg: "from-slate-300/14" },
    { row: first, place: 1, height: "h-28", tone: "border-accent/50 text-accent", bg: "from-accent/24" },
    { row: third, place: 3, height: "h-16", tone: "border-secondary/45 text-secondary", bg: "from-secondary/18" },
  ].filter((item): item is { row: RowData; place: number; height: string; tone: string; bg: string } => Boolean(item.row));

  return (
    <section className="grid grid-cols-3 items-end gap-2">
      {ordered.map(({ row, place, height, tone, bg }) => {
        const score = metric === "runs" ? row.runs : row.wickets;
        return (
          <Link
            key={row.user_id}
            to={row.demo ? "/search" : `/player/${row.user_id}`}
            className={`relative overflow-hidden rounded-[26px] border bg-card/75 p-2 text-center shadow-xl shadow-black/20 transition active:scale-[0.99] ${tone} ${place === 1 ? "shadow-[0_0_34px_hsl(var(--primary)/0.16)]" : ""}`}
          >
            <div className={`absolute inset-x-0 bottom-0 ${height} bg-gradient-to-t ${bg} to-transparent`} />
            <div className="relative">
              {place === 1 ? <Crown className="mx-auto h-5 w-5" /> : <Medal className="mx-auto h-5 w-5" />}
              <img
                src={row.avatar_url || avatar}
                alt={row.display_name}
                className={`mx-auto mt-1 rounded-full border-2 object-cover ${place === 1 ? "h-16 w-16" : "h-12 w-12"} ${tone}`}
              />
              <p className="mt-2 truncate text-[11px] font-black text-foreground">{row.display_name}</p>
              <p className={`text-xl font-black ${metric === "runs" ? "text-primary" : "text-accent"}`}>{score}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{metric === "runs" ? "runs" : "wickets"}</p>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-1 text-[10px] font-black">
                #{place}
                <ArrowUpRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
