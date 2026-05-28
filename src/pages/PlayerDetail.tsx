import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Loader2, MapPin, MessageCircle, Share2, Trophy, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { followUser, getProfile, openConversation, unfollowUser } from "@/lib/api";

interface PlayerProfile {
  id: string;
  username: string;
  handle: string;
  avatar_url: string;
  bio: string;
  location: string;
  player_role: string;
  followers_count: number;
  following_count: number;
  verified: boolean;
  is_following: boolean;
  is_self: boolean;
  total_runs: number;
  total_wickets: number;
  strike_rate: number;
  batting_average: number;
  matches_played: number;
  highlights_count: number;
}

interface ProfileBundle {
  profile: PlayerProfile;
  matches: Array<{ id: string; match_name: string; thumbnail_url: string; team_a: string; team_b: string; created_at: string }>;
  highlights: Array<{ id: string; title: string; thumbnail_url: string; match_id: string | null }>;
}

export default function PlayerDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [bundle, setBundle] = useState<ProfileBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setBundle(await getProfile(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load player");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const profile = bundle?.profile;

  const toggleFollow = async () => {
    if (!profile || profile.is_self) return;
    const wasFollowing = profile.is_following;
    setBusy("follow");
    setBundle((current) => current && {
      ...current,
      profile: {
        ...current.profile,
        is_following: !wasFollowing,
        followers_count: Math.max(0, current.profile.followers_count + (wasFollowing ? -1 : 1)),
      },
    });
    try {
      const response = wasFollowing ? await unfollowUser(profile.id) : await followUser(profile.id);
      if (response.user) {
        setBundle((current) => current && { ...current, profile: { ...current.profile, ...response.user } });
      }
      toast.success(wasFollowing ? "Unfollowed player" : "Following player");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Follow action failed");
      load();
    } finally {
      setBusy("");
    }
  };

  const startChat = async () => {
    if (!profile || profile.is_self) return;
    setBusy("message");
    try {
      await openConversation({ userId: profile.id });
      toast.success(`Chat opened with ${profile.username}`);
      navigate("/chat");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start chat");
    } finally {
      setBusy("");
    }
  };

  const shareProfile = async () => {
    if (!profile) return;
    const url = `${window.location.origin}/player/${profile.id}`;
    if (navigator.share) {
      await navigator.share({ title: profile.username, text: `@${profile.handle} on CrickPulse`, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div className="space-y-4 px-4 py-5">
          <div className="h-56 animate-pulse rounded-[30px] bg-card/70" />
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-white/8" />)}
          </div>
        </div>
      </PageShell>
    );
  }

  if (error || !profile) {
    return (
      <PageShell>
        <div className="px-4 py-20 text-center">
          <h2 className="text-lg font-black">Player unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error || "This player could not be loaded."}</p>
          <Button variant="hero" className="mt-5" onClick={load}>Retry</Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <main className="space-y-5 px-4 py-5 pb-24">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-card/75 shadow-2xl shadow-black/30">
          <div className="h-28 bg-[radial-gradient(circle_at_left,hsl(var(--primary)/0.30),transparent_44%),linear-gradient(135deg,hsl(160_85%_20%),hsl(214_60%_20%))]" />
          <div className="-mt-12 px-5 pb-5">
            <div className="flex items-end gap-4">
              <Avatar profile={profile} />
              <div className="min-w-0 flex-1 pb-2">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-2xl font-black">{profile.username}</h1>
                  {profile.verified && <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />}
                </div>
                <p className="text-sm font-bold text-primary">@{profile.handle}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-black">{profile.player_role || "Player"}</span>
              {profile.location && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-bold text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {profile.location}
                </span>
              )}
            </div>

            {profile.bio && <p className="mt-4 text-sm leading-5 text-foreground/80">{profile.bio}</p>}

            <div className="mt-4 grid grid-cols-4 gap-2">
              <Social label="Followers" value={profile.followers_count} />
              <Social label="Following" value={profile.following_count} />
              <Social label="Matches" value={profile.matches_played} />
              <Social label="Reels" value={profile.highlights_count} />
            </div>

            {!profile.is_self && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant={profile.is_following ? "soft" : "hero"} size="lg" onClick={toggleFollow} disabled={busy === "follow"}>
                  {busy === "follow" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {profile.is_following ? "Following" : "Follow"}
                </Button>
                <Button variant="soft" size="lg" onClick={startChat} disabled={busy === "message"}>
                  {busy === "message" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  Message
                </Button>
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-4 gap-2">
          <Stat label="Runs" value={profile.total_runs} />
          <Stat label="Wkts" value={profile.total_wickets} />
          <Stat label="SR" value={profile.strike_rate || "--"} />
          <Stat label="Avg" value={profile.batting_average || "--"} />
        </section>

        <section className="space-y-3">
          <h2 className="inline-flex items-center gap-2 text-base font-black">
            <Trophy className="h-4 w-4 text-primary" /> Recent highlights
          </h2>
          {bundle.highlights.length ? (
            <div className="grid grid-cols-3 gap-2">
              {bundle.highlights.slice(0, 6).map((highlight) => (
                <Link key={highlight.id} to={highlight.match_id ? `/editor?match=${highlight.match_id}` : "/chat"} className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-card">
                  {highlight.thumbnail_url && <img src={highlight.thumbnail_url} alt={highlight.title} className="absolute inset-0 h-full w-full object-cover" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                  <p className="absolute bottom-2 left-2 right-2 truncate text-[10px] font-black">{highlight.title}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-[24px] border border-dashed border-white/15 bg-card/45 p-5 text-center text-sm text-muted-foreground">No highlights yet.</p>
          )}
        </section>
      </main>

      <button
        type="button"
        onClick={shareProfile}
        className="fixed right-[calc(50%-206px)] top-4 z-40 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-card/90 backdrop-blur-xl"
        aria-label="Share profile"
      >
        <Share2 className="h-4 w-4" />
      </button>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="relative w-full max-w-[440px] min-h-screen border-x border-border/40 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.10),transparent_34%),hsl(var(--background))]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-background/88 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between px-4">
            <Link to="/search" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-card" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-base font-black">Player</h1>
            <div className="w-9" />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

function Avatar({ profile }: { profile: PlayerProfile }) {
  return (
    <span className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[30px] border-4 border-background bg-gradient-cta text-3xl font-black text-primary-foreground shadow-2xl shadow-primary/20">
      {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.username} className="h-full w-full object-cover" /> : profile.username.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Social({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/45 p-2 text-center">
      <p className="text-sm font-black">{value.toLocaleString()}</p>
      <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card/70 p-3 text-center">
      <p className="text-lg font-black">{value}</p>
      <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
