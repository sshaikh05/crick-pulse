import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, Clock, Loader2, MessageCircle, Search as SearchIcon, UserPlus, Users, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { followUser, openConversation, searchUsers, unfollowUser } from "@/lib/api";

interface SearchUser {
  id: string;
  username: string;
  name: string;
  handle: string;
  email: string;
  avatar_url: string;
  location: string;
  player_role: string;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  is_self: boolean;
  verified: boolean;
}

const RECENT_KEY = "crickpulse_recent_user_searches";
const suggested = ["batter", "all-rounder", "coach", "Indore"];

export default function Search() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [players, setPlayers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 5);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  const persistRecent = useCallback((value: string) => {
    if (!value.trim()) return;
    setRecent((items) => {
      const next = [value.trim(), ...items.filter((item) => item.toLowerCase() !== value.trim().toLowerCase())].slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const load = useCallback(async (query = debounced) => {
    setLoading(true);
    setError("");
    try {
      const data = await searchUsers(query);
      setPlayers(data);
      if (query) persistRecent(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search players");
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [debounced, persistRecent]);

  useEffect(() => {
    if (!debounced) {
      setPlayers([]);
      setError("");
      return;
    }
    load(debounced);
  }, [debounced, load]);

  const toggleFollow = async (player: SearchUser) => {
    if (player.is_self) return toast.error("You cannot follow yourself");
    const wasFollowing = player.is_following;
    setBusyId(player.id);
    setPlayers((items) => items.map((item) => item.id === player.id
      ? {
          ...item,
          is_following: !wasFollowing,
          followers_count: Math.max(0, item.followers_count + (wasFollowing ? -1 : 1)),
        }
      : item));
    try {
      const response = wasFollowing ? await unfollowUser(player.id) : await followUser(player.id);
      if (response.user) {
        setPlayers((items) => items.map((item) => item.id === player.id ? { ...item, ...response.user } : item));
      }
      toast.success(wasFollowing ? "Unfollowed player" : "Following player");
    } catch (err) {
      setPlayers((items) => items.map((item) => item.id === player.id ? player : item));
      toast.error(err instanceof Error ? err.message : "Follow action failed");
    } finally {
      setBusyId("");
    }
  };

  const startChat = async (player: SearchUser) => {
    if (player.is_self) return;
    setBusyId(player.id);
    try {
      await openConversation({ userId: player.id });
      toast.success(`Chat opened with ${player.username}`);
      navigate("/chat");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start chat");
    } finally {
      setBusyId("");
    }
  };

  const showSuggestions = !q.trim();
  const hasQuery = debounced.length > 0;

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="relative w-full max-w-[440px] min-h-screen border-x border-border/40 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.10),transparent_34%),hsl(var(--background))]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-background/88 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-2 px-3">
            <Link to="/" aria-label="Back" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-card">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search players by name, handle, email"
                className="h-11 rounded-full border-white/10 bg-card/80 pl-9 pr-9 focus-visible:ring-primary"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-muted text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="space-y-5 px-4 py-4 pb-24">
          {showSuggestions && (
            <>
              <Section title="Recent searches" icon={Clock}>
                {recent.length ? (
                  <div className="flex flex-wrap gap-2">
                    {recent.map((item) => (
                      <button key={item} onClick={() => setQ(item)} className="h-9 rounded-full border border-white/10 bg-card px-3.5 text-sm font-bold">
                        {item}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-white/10 bg-card/45 p-4 text-sm text-muted-foreground">Your player searches will appear here.</p>
                )}
              </Section>
              <Section title="Try searching" icon={Users}>
                <div className="flex flex-wrap gap-2">
                  {suggested.map((item) => (
                    <button key={item} onClick={() => setQ(item)} className="h-9 rounded-full border border-primary/25 bg-primary/10 px-3.5 text-sm font-black text-primary">
                      {item}
                    </button>
                  ))}
                </div>
              </Section>
            </>
          )}

          {!showSuggestions && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Players</h2>
                {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
              {error && <ErrorState message={error} onRetry={() => load()} />}
              {!error && loading && <UserSkeleton />}
              {!error && !loading && hasQuery && players.length === 0 && <EmptyState />}
              {!error && players.map((player) => (
                <PlayerResult
                  key={player.id}
                  player={player}
                  busy={busyId === player.id}
                  onFollow={() => toggleFollow(player)}
                  onMessage={() => startChat(player)}
                />
              ))}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Clock; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h3>
      {children}
    </section>
  );
}

function PlayerResult({
  player,
  busy,
  onFollow,
  onMessage,
}: {
  player: SearchUser;
  busy: boolean;
  onFollow: () => void;
  onMessage: () => void;
}) {
  return (
    <article className="rounded-[26px] border border-white/10 bg-card/75 p-3 shadow-xl shadow-black/20">
      <div className="flex gap-3">
        <Avatar player={player} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-base font-black">{player.username}</h3>
            {player.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
          </div>
          <p className="truncate text-xs font-bold text-primary">@{player.handle}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {player.player_role || "Player"}{player.location ? ` · ${player.location}` : ""}
          </p>
          <p className="mt-1 text-[11px] font-bold text-muted-foreground">
            {player.followers_count.toLocaleString()} followers
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button
          variant={player.is_following ? "soft" : "hero"}
          size="sm"
          className="h-10"
          disabled={busy || player.is_self}
          onClick={onFollow}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
          {player.is_following ? "Following" : "Follow"}
        </Button>
        <Button variant="soft" size="sm" className="h-10" disabled={busy || player.is_self} onClick={onMessage}>
          <MessageCircle className="h-3.5 w-3.5" />
          Message
        </Button>
        <Link to={`/player/${player.id}`}>
          <Button variant="soft" size="sm" className="h-10 w-full">Profile</Button>
        </Link>
      </div>
    </article>
  );
}

function Avatar({ player }: { player: SearchUser }) {
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-primary/25 bg-primary/12 text-lg font-black text-primary">
      {player.avatar_url ? <img src={player.avatar_url} alt={player.username} className="h-full w-full object-cover" /> : player.username.slice(0, 1).toUpperCase()}
    </span>
  );
}

function UserSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-28 animate-pulse rounded-[26px] bg-white/8" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[28px] border border-dashed border-white/15 bg-card/50 p-8 text-center">
      <SearchIcon className="mx-auto h-8 w-8 text-muted-foreground" />
      <h3 className="mt-3 font-black">No players found</h3>
      <p className="mt-1 text-sm text-muted-foreground">Try a name, username, handle, email, role, or location.</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[24px] border border-destructive/25 bg-destructive/10 p-4 text-sm">
      <p className="font-bold text-destructive">{message}</p>
      <Button variant="soft" size="sm" className="mt-3" onClick={onRetry}>Retry</Button>
    </div>
  );
}
