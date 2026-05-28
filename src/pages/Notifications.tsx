import { useMemo, useState } from "react";
import { ArrowLeft, Bell, Heart, MessageCircle, UserPlus, Radio, Trophy, Settings2, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NotifType = "like" | "comment" | "follow" | "live" | "match" | "system";

interface Notif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  actor?: { id?: string; name: string; avatar?: string };
  link?: string; // primary deep link when row is tapped
  matchId?: string;
  clipId?: string;
}

const seed: Notif[] = [
  { id: "1", type: "like", title: "Shahnawaz liked your clip", body: "🔥 45 runs in 12 balls", time: "2m", unread: true, actor: { id: "p1", name: "Shahnawaz" }, clipId: "c1", link: "/editor?match=m1" },
  { id: "2", type: "live", title: "Lions XI is live now", body: "Lions XI vs Royal Strikers · T20", time: "8m", unread: true, matchId: "m-live-1", link: "/scoring/m-live-1" },
  { id: "3", type: "comment", title: "Arjun K. commented", body: "“Cleanest yorker I've seen all week 🔥”", time: "21m", unread: true, actor: { id: "p2", name: "Arjun K." }, clipId: "c2", link: "/editor?match=m2" },
  { id: "4", type: "follow", title: "Imran A. started following you", body: "Tap to view profile", time: "1h", unread: false, actor: { id: "p3", name: "Imran A." }, link: "/player/p3" },
  { id: "5", type: "match", title: "Match recap ready", body: "Lions XI won by 5 wickets — view highlights", time: "3h", unread: false, matchId: "m-recap-1", link: "/editor?match=m-recap-1" },
  { id: "6", type: "system", title: "Highlights generated", body: "12 moments detected from your last upload", time: "Yesterday", unread: false, matchId: "m-up-1", link: "/editor?match=m-up-1" },
];

const iconFor = (t: NotifType) => {
  switch (t) {
    case "like": return { Icon: Heart, tint: "bg-destructive/15 text-destructive border-destructive/40" };
    case "comment": return { Icon: MessageCircle, tint: "bg-secondary/15 text-secondary border-secondary/40" };
    case "follow": return { Icon: UserPlus, tint: "bg-primary/15 text-primary border-primary/40" };
    case "live": return { Icon: Radio, tint: "bg-destructive/15 text-destructive border-destructive/40" };
    case "match": return { Icon: Trophy, tint: "bg-accent/15 text-accent border-accent/40" };
    default: return { Icon: Bell, tint: "bg-muted text-muted-foreground border-border" };
  }
};

const tabs = [
  { key: "all", label: "All" },
  { key: "mentions", label: "Mentions" },
  { key: "matches", label: "Matches" },
] as const;

export default function Notifications() {
  const [items, setItems] = useState<Notif[]>(seed);
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("all");

  const filtered = useMemo(() => {
    if (tab === "mentions") return items.filter((i) => i.type === "comment" || i.type === "like");
    if (tab === "matches") return items.filter((i) => i.type === "match" || i.type === "live");
    return items;
  }, [items, tab]);

  const unread = items.filter((i) => i.unread).length;

  const markAll = () => setItems((xs) => xs.map((x) => ({ ...x, unread: false })));

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="relative w-full max-w-[440px] min-h-screen border-x border-border/40">
        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/85 border-b border-border/60">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2">
              <Link to="/" aria-label="Back" className="h-9 w-9 grid place-items-center rounded-full bg-card border border-border">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <h1 className="text-base font-extrabold leading-none">Notifications</h1>
                <p className="text-[11px] text-muted-foreground mt-0.5">{unread > 0 ? `${unread} new updates` : "You’re all caught up"}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={markAll}
                className="h-9 px-3 rounded-full bg-card border border-border text-xs font-bold inline-flex items-center gap-1.5"
              >
                <CheckCheck className="h-4 w-4 text-primary" /> Mark read
              </button>
              <button aria-label="Notification settings" className="h-9 w-9 rounded-full bg-card border border-border grid place-items-center">
                <Settings2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 px-4 pb-3">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "h-9 px-4 rounded-full text-xs font-bold transition-colors",
                  tab === t.key
                    ? "bg-foreground text-background"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {/* List */}
        <main className="px-4 py-4 space-y-2.5">
          {filtered.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center space-y-3">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/15 grid place-items-center">
                <Bell className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-bold">No notifications</h3>
              <p className="text-sm text-muted-foreground">When players, matches or fans interact with you, it’ll show up here.</p>
            </div>
          )}

          {filtered.map((n, i) => {
            const { Icon, tint } = iconFor(n.type);
            const markRead = () => setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
            return (
              <article
                key={n.id}
                className={cn(
                  "relative flex gap-3 p-3.5 rounded-2xl border transition-colors animate-float-up",
                  n.unread ? "bg-card border-primary/30" : "bg-card/60 border-border",
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className={cn("h-11 w-11 rounded-2xl border grid place-items-center shrink-0", tint)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  {n.link ? (
                    <Link to={n.link} onClick={markRead} className="block">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm leading-tight truncate">{n.title}</p>
                        <span className="text-[11px] text-muted-foreground shrink-0">{n.time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-snug mt-0.5 line-clamp-2">{n.body}</p>
                    </Link>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm leading-tight truncate">{n.title}</p>
                        <span className="text-[11px] text-muted-foreground shrink-0">{n.time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-snug mt-0.5 line-clamp-2">{n.body}</p>
                    </>
                  )}

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {n.type === "follow" && (
                      <>
                        <Button size="sm" variant="neon" className="h-8 px-3" onClick={markRead}>Follow back</Button>
                        {n.actor?.id && (
                          <Button asChild size="sm" variant="soft" className="h-8 px-3">
                            <Link to={`/player/${n.actor.id}`} onClick={markRead}>View profile</Link>
                          </Button>
                        )}
                      </>
                    )}
                    {n.type === "live" && n.matchId && (
                      <Button asChild size="sm" variant="accent" className="h-8 px-3">
                        <Link to={`/scoring/${n.matchId}`} onClick={markRead}>Watch live</Link>
                      </Button>
                    )}
                    {(n.type === "match" || n.type === "system") && n.matchId && (
                      <Button asChild size="sm" variant="neon" className="h-8 px-3">
                        <Link to={`/editor?match=${n.matchId}`} onClick={markRead}>View highlights</Link>
                      </Button>
                    )}
                    {(n.type === "like" || n.type === "comment") && (
                      <>
                        {n.matchId || n.clipId ? (
                          <Button asChild size="sm" variant="soft" className="h-8 px-3">
                            <Link to={n.link ?? "/"} onClick={markRead}>View clip</Link>
                          </Button>
                        ) : null}
                        {n.actor?.id && (
                          <Button asChild size="sm" variant="ghost" className="h-8 px-3">
                            <Link to={`/player/${n.actor.id}`} onClick={markRead}>{n.actor.name}'s profile</Link>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {n.unread && <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary glow-primary" />}
              </article>
            );
          })}
        </main>
      </div>
    </div>
  );
}
