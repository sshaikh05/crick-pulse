import {
  Bell,
  Bookmark,
  ArrowRight,
  ChevronUp,
  CheckCircle2,
  Flame,
  Heart,
  LogIn,
  MapPin,
  MessageCircle,
  Play,
  Radio,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Send,
  Trophy,
  Upload,
  User as UserIcon,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { AuthUser } from "@/types/auth";
import { createComment, followUser, getComments, getMatches, searchUsers, toggleCommentLike } from "@/lib/api";
import { cn } from "@/lib/utils";

const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

interface FeedClip {
  id: string;
  match_name: string;
  location: string;
  team_a: string;
  team_b: string;
  video_url: string;
  thumbnail_url: string;
  video_file_name: string;
  video_size: number;
  created_at: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  owner_id: string;
  user_id?: string;
  user: {
    id: string;
    name: string;
    avatar: string | null;
    handle?: string;
    is_following?: boolean;
    is_self?: boolean;
  } | null;
}

interface CommentItem {
  id: string;
  match_id: string | null;
  highlight_id: string | null;
  comment: string;
  likes_count: number;
  liked: boolean;
  created_at: string;
  user: {
    id: string;
    name: string;
    handle: string;
    avatar: string | null;
    verified: boolean;
  } | null;
}

type FeedTab = "trending" | "following";

export default function Home() {
  const { user } = useAuth();
  const [clips, setClips] = useState<FeedClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [liveMatches, setLiveMatches] = useState<Array<{ id: string; match_name: string }>>([]);
  const [activeTab, setActiveTab] = useState<FeedTab>("trending");
  const [commentClip, setCommentClip] = useState<FeedClip | null>(null);
  const [shareClipItem, setShareClipItem] = useState<FeedClip | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const refreshStartRef = useRef<number | null>(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setFeedError(null);
    try {
      const [matches, users] = await Promise.all([
        getMatches(),
        user ? searchUsers("").catch(() => []) : Promise.resolve([]),
      ]);
      const userById = new Map(users.map((item: {
        id: string;
        handle?: string;
        is_following?: boolean;
        is_self?: boolean;
      }) => [item.id, item]));
      setClips(
        await Promise.all(matches.map(async (match: FeedClip) => {
          let commentsCount = 0;
          try {
            const data = await getComments({ matchId: match.id });
            commentsCount = data.count || data.comments?.length || 0;
          } catch {
            commentsCount = 0;
          }

          return {
          ...match,
          likes_count: 0,
          comments_count: commentsCount,
          shares_count: 0,
          owner_id: match.user?.id || match.user_id || "",
          user: match.user ? {
            ...match.user,
            handle: userById.get(match.user.id)?.handle,
            is_following: Boolean(userById.get(match.user.id)?.is_following),
            is_self: match.user.id === user?.id,
          } : match.user,
          };
        })),
      );
      setLiveMatches([]);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Could not load matches");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    if (!user || clips.length === 0) {
      setLikedIds(new Set());
      setSavedIds(new Set());
    }
  }, [user, clips]);

  const toggleLike = (clipId: string) => {
    if (!user) {
      toast.message("Sign in to like matches");
      return;
    }

    const isLiked = likedIds.has(clipId);
    const next = new Set(likedIds);
    if (isLiked) next.delete(clipId);
    else next.add(clipId);
    setLikedIds(next);
    setClips((cs) =>
      cs.map((c) => (c.id === clipId ? { ...c, likes_count: c.likes_count + (isLiked ? -1 : 1) } : c)),
    );
  };

  const toggleSave = (clipId: string) => {
    if (!user) {
      toast.message("Sign in to save matches");
      return;
    }

    const next = new Set(savedIds);
    if (next.has(clipId)) next.delete(clipId);
    else next.add(clipId);
    setSavedIds(next);
  };

  const followClipOwner = async (clip: FeedClip) => {
    if (!user) {
      toast.message("Sign in to follow players");
      return;
    }
    const ownerId = clip.owner_id || clip.user?.id;
    if (!ownerId || ownerId === user.id || clip.user?.is_self) return;

    setClips((items) => items.map((item) => {
      const itemOwnerId = item.owner_id || item.user?.id;
      return itemOwnerId === ownerId
        ? { ...item, user: item.user ? { ...item.user, is_following: true } : item.user }
        : item;
    }));

    try {
      await followUser(ownerId);
      toast.success(`Following ${clip.user?.name || "player"}`);
    } catch (err) {
      setClips((items) => items.map((item) => {
        const itemOwnerId = item.owner_id || item.user?.id;
        return itemOwnerId === ownerId
          ? { ...item, user: item.user ? { ...item.user, is_following: false } : item.user }
          : item;
      }));
      toast.error(err instanceof Error ? err.message : "Could not follow player");
    }
  };

  const openShare = (clip: FeedClip) => {
    setShareClipItem(clip);
    setClips((cs) => cs.map((c) => (c.id === clip.id ? { ...c, shares_count: c.shares_count + 1 } : c)));
  };

  const updateCommentCount = useCallback((matchId: string, count: number) => {
    setClips((items) => items.map((item) => item.id === matchId ? { ...item, comments_count: count } : item));
  }, []);

  const shareNative = async (clip: FeedClip) => {
    const url = `${window.location.origin}/editor?match=${clip.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: clip.match_name || "Cricket match", text: clip.location || "", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  const onTouchStart = () => {
    if (scrollRef.current?.scrollTop === 0) refreshStartRef.current = Date.now();
  };

  const onTouchEnd = () => {
    if (refreshStartRef.current && Date.now() - refreshStartRef.current > 350 && scrollRef.current?.scrollTop === 0) {
      loadMatches();
    }
    refreshStartRef.current = null;
  };

  return (
    <div className="relative h-[calc(100dvh-5rem)] overflow-hidden bg-[hsl(222_45%_5%)]">
      <FeedHeader
        user={user}
        liveCount={liveMatches.length}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth touch-pan-y scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        <HeroSlide liveMatches={liveMatches} />

        {loading && <LoadingSlide />}

        {!loading && feedError && <ErrorSlide message={feedError} onRetry={loadMatches} />}

        {!loading && !feedError && clips.length === 0 && <EmptySlide />}

        {!loading && !feedError && clips.map((clip, index) => (
          <ReelSlide
            key={clip.id}
            clip={clip}
            index={index}
            liked={likedIds.has(clip.id)}
            saved={savedIds.has(clip.id)}
            onLike={() => toggleLike(clip.id)}
            onComment={() => setCommentClip(clip)}
            onShare={() => openShare(clip)}
            onSave={() => toggleSave(clip.id)}
            onFollow={() => followClipOwner(clip)}
          />
        ))}
      </div>

      <CommentDrawer
        clip={commentClip}
        currentUser={user}
        onOpenChange={(open) => !open && setCommentClip(null)}
        onCountChange={updateCommentCount}
      />
      <ShareDrawer
        clip={shareClipItem}
        onOpenChange={(open) => !open && setShareClipItem(null)}
        onShare={shareNative}
      />
    </div>
  );
}

function FeedHeader({
  user,
  liveCount,
  activeTab,
  onTabChange,
}: {
  user: AuthUser | null;
  liveCount: number;
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
}) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-3">
      <div className="pointer-events-auto rounded-[22px] border border-white/10 bg-background/70 px-2 py-2 shadow-2xl shadow-black/35 backdrop-blur-2xl">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link to="/" className="flex min-w-0 shrink items-center gap-1.5">
            <img
              src="/logo.png"
              alt="CrickPulse"
              className="h-7 w-7 shrink-0 rounded-xl border border-primary/30 object-cover shadow-[0_0_16px_hsl(var(--primary)/0.28)]"
            />
            <h1 className="max-w-[92px] truncate text-[13px] font-black leading-tight">CrickPulse</h1>
          </Link>

          <div className="mx-auto flex min-w-0 flex-1 items-center justify-center gap-0.5 rounded-full bg-white/6 p-0.5">
            <button
              type="button"
              onClick={() => onTabChange("trending")}
              className={cn(
                "h-7 flex-1 rounded-full px-1.5 text-[10px] font-black transition-all",
                activeTab === "trending"
                  ? "bg-gradient-cta text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.24)]"
                  : "text-muted-foreground",
              )}
            >
              Trending
            </button>
            <button
              type="button"
              onClick={() => onTabChange("following")}
              className={cn(
                "h-7 flex-1 rounded-full px-1.5 text-[10px] font-black transition-all",
                activeTab === "following"
                  ? "bg-gradient-cta text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.24)]"
                  : "text-muted-foreground",
              )}
            >
              Following
            </button>
          </div>

          <div className="flex items-center gap-1">
            <Link
              to="/search"
              aria-label="Search players, teams, tournaments"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/8 text-foreground/90 transition hover:bg-white/12 active:scale-95"
            >
              <Search size={16} className="h-4.5 w-4.5" />
            </Link>
            {user ? (
              <Link
                to="/notifications"
                aria-label="Notifications"
                className="relative grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/8 text-foreground/90 transition hover:bg-white/12 active:scale-95"
              >
                <Bell size={16} className="h-4.5 w-4.5" />
                {liveCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary))]" />}
              </Link>
            ) : (
              <Link
                to="/auth"
                aria-label="Sign in"
                className="grid h-8 w-8 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary transition hover:bg-primary/15 active:scale-95"
              >
                <LogIn size={16} className="h-4.5 w-4.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function HeroSlide({ liveMatches }: { liveMatches: Array<{ id: string; match_name: string }> }) {
  return (
    <section className="snap-start snap-always relative h-[calc(100dvh-5rem)] px-3 pb-4 pt-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(25,194,255,0.13),transparent_34%),linear-gradient(160deg,#020817,#06111f_54%,#03130f)]" />
      <div className="relative h-full overflow-hidden rounded-[32px] border border-[#1f314e] bg-[#07101f] shadow-[0_26px_80px_rgba(0,0,0,0.62),0_0_42px_rgba(16,215,181,0.12)]">
        <img
          src="/feedBg.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[62%_50%] opacity-90"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,9,20,0.96)_0%,rgba(3,9,20,0.86)_37%,rgba(3,9,20,0.42)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,11,24,0.42)_0%,rgba(4,11,24,0.08)_45%,rgba(4,11,24,0.95)_100%)]" />
        <div className="absolute -right-16 top-20 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute -bottom-12 left-8 h-40 w-40 rounded-full bg-primary/12 blur-3xl" />
        <img
          src="/logo.png"
          alt=""
          className="absolute right-6 top-8 h-20 w-20 rounded-[28px] border border-primary/30 object-cover opacity-80 shadow-[0_0_42px_rgba(16,215,181,0.24)]"
        />
        <div className="absolute right-2 top-2 h-36 w-36 rounded-full border border-primary/20 opacity-60" />
        <div className="absolute right-7 top-7 h-24 w-24 rounded-full border border-dashed border-cyan-300/30 opacity-70" />
        <div className="relative flex h-full flex-col justify-between p-6">
          <div className="flex flex-wrap items-center gap-2 pr-20">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-[#03150f]/70 px-3 py-1.5 text-[11px] font-black text-[#13f5bd] shadow-[0_0_22px_rgba(16,215,181,0.14)] backdrop-blur-md">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              Live cricket energy
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-300/35 bg-orange-400/10 px-3 py-1.5 text-[11px] font-black text-orange-200 shadow-[0_0_20px_rgba(251,146,60,0.1)] backdrop-blur-md">
              <Flame className="h-3.5 w-3.5" />
              Trending
            </span>
          </div>

          <div className="space-y-7 pb-12">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#13f5bd]">
                <span className="h-px w-8 bg-[#13f5bd]" />
                CrickPulse
              </div>
              <h2 className="max-w-[12ch] text-[40px] font-black leading-[0.98] text-white text-balance drop-shadow-[0_3px_18px_rgba(0,0,0,0.45)]">
                Your cricket deserves the{" "}
                <span className="bg-gradient-to-r from-[#12f7ba] via-[#1fc9ff] to-[#5577ff] bg-clip-text text-transparent">
                  big screen
                </span>
              </h2>
              <p className="max-w-[30ch] text-[15px] font-medium leading-7 text-[#aab6c9]">
                Upload local matches, watch community reels, and turn every boundary into a moment.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/upload"
                className="inline-flex h-[62px] min-w-0 flex-1 items-center justify-center gap-3 rounded-[20px] bg-white px-4 text-base font-black text-[#020817] shadow-[0_18px_36px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.8)] transition active:scale-[0.98]"
              >
                <Upload className="h-5 w-5 shrink-0" />
                <span className="truncate">Upload Match Video</span>
              </Link>
              <Link
                to="/upload"
                aria-label="Upload match video"
                className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#12f7ba] to-[#3b82ff] text-[#03101c] shadow-[0_0_36px_rgba(25,194,255,0.36)] transition active:scale-95"
              >
                <ArrowRight className="h-7 w-7" strokeWidth={2.4} />
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            {liveMatches.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {liveMatches.map((m) => (
                  <Link
                    key={m.id}
                    to={`/scoring/${m.id}`}
                    className="shrink-0 rounded-full border border-destructive/40 bg-destructive/15 px-4 py-2 text-sm font-bold text-destructive"
                  >
                    {m.match_name}
                  </Link>
                ))}
              </div>
            )}
            <div className="flex flex-col items-center gap-1 text-[#aab6c9] animate-bounce">
              <ChevronUp className="h-5 w-5" />
              <span className="text-[10px] font-bold">Swipe for match reels</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoadingSlide() {
  return (
    <section className="snap-start snap-always h-[calc(100dvh-5rem)] px-3 pb-4 pt-20">
      <div className="relative h-full overflow-hidden rounded-[32px] border border-white/10 bg-card">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-card to-muted/70" />
        <div className="absolute bottom-7 left-5 right-24 space-y-3">
          <div className="h-4 w-28 rounded-full bg-white/10" />
          <div className="h-8 w-56 rounded-full bg-white/10" />
          <div className="h-4 w-40 rounded-full bg-white/10" />
        </div>
        <div className="absolute bottom-24 right-4 space-y-5">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-12 w-12 rounded-full bg-white/10" />
          ))}
        </div>
      </div>
    </section>
  );
}

function ErrorSlide({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="snap-start snap-always h-[calc(100dvh-5rem)] px-6 pb-6 pt-24 grid place-items-center">
      <div className="max-w-sm rounded-[30px] border border-destructive/35 bg-destructive/10 p-7 text-center shadow-2xl shadow-black/30 backdrop-blur space-y-4">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/20 grid place-items-center text-destructive">
          <X className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-destructive">Feed did not load</h3>
          <p className="text-sm text-foreground/80">{message}</p>
        </div>
        <Button variant="hero" size="lg" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    </section>
  );
}

function EmptySlide() {
  return (
    <section className="snap-start snap-always h-[calc(100dvh-5rem)] px-3 pb-4 pt-20">
      <div className="relative h-full overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,hsl(222_32%_12%),hsl(222_44%_7%))] shadow-2xl shadow-black/40">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-cta opacity-70" />
        <div className="relative grid h-full place-items-center p-8 text-center">
          <div className="max-w-sm space-y-5">
            <div className="mx-auto h-20 w-20 rounded-[28px] border border-primary/25 bg-primary/12 grid place-items-center shadow-[0_0_34px_hsl(var(--primary)/0.22)]">
              <Trophy className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black">No matches uploaded yet</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Start the first reel in your cricket circle. Upload a match and it will appear here instantly.
              </p>
            </div>
            <Link to="/upload" className="block">
              <Button variant="hero" size="lg" className="w-full">
                <Upload className="h-4 w-4" />
                Upload your first match
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReelSlide({
  clip,
  index,
  liked,
  saved,
  onLike,
  onComment,
  onShare,
  onSave,
  onFollow,
}: {
  clip: FeedClip;
  index: number;
  liked: boolean;
  saved: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onFollow: () => void;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [heartBurst, setHeartBurst] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    const video = videoRef.current;
    if (!node || !video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.62) {
          document.querySelectorAll<HTMLVideoElement>("video[data-feed-clip]").forEach((v) => {
            if (v !== video) v.pause();
          });
          video.play().then(() => setPlaying(true)).catch(() => {
            video.muted = true;
            video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
          });
        } else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: [0, 0.62, 1] },
    );

    observer.observe(node);
    const onVis = () => { if (document.hidden) video.pause(); };
    const onTime = () => {
      if (!video.duration) return;
      setProgress((video.currentTime / video.duration) * 100);
    };
    document.addEventListener("visibilitychange", onVis);
    video.addEventListener("timeupdate", onTime);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      video.removeEventListener("timeupdate", onTime);
      video.pause();
    };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const doubleTapLike = () => {
    if (!liked) onLike();
    setHeartBurst(true);
    window.setTimeout(() => setHeartBurst(false), 650);
  };

  const ownerName = clip.user?.name || "Player";
  const ownerHandle = clip.user?.handle ? `@${clip.user.handle}` : ownerName ? `@${ownerName.toLowerCase().replace(/\s+/g, "")}` : "@crickpulse";
  const showFollow = Boolean(clip.owner_id && !clip.user?.is_self && !clip.user?.is_following);
  const teams = clip.team_a && clip.team_b ? `${clip.team_a} vs ${clip.team_b}` : "";
  const uploadedAt = formatUploadedTime(clip.created_at);
  const chips = getMatchChips(clip);

  return (
    <article
      ref={containerRef}
      className="relative snap-start snap-always h-[calc(100dvh-5rem)] px-2.5 pb-3 pt-16"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="relative h-full overflow-hidden rounded-[30px] border border-white/10 bg-black shadow-2xl shadow-black/50">
        <video
          ref={videoRef}
          data-feed-clip
          src={clip.video_url}
          poster={clip.thumbnail_url || undefined}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          loop
          muted={muted}
          preload={index < 2 ? "auto" : "metadata"}
          onClick={togglePlay}
          onDoubleClick={doubleTapLike}
        />

        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/80 via-background/20 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-background via-background/75 to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background/60 to-transparent pointer-events-none" />

        <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-background/45 px-3 py-1.5 text-xs font-black text-primary backdrop-blur-xl">
              <Flame className="h-3.5 w-3.5" />
              Trending
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-background/45 px-3 py-1.5 text-xs font-bold text-foreground/90 backdrop-blur-xl">
              <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
              Verified match
            </span>
          </div>
          <button
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
            className="h-9 w-9 shrink-0 rounded-full border border-white/10 bg-background/45 grid place-items-center text-foreground backdrop-blur-xl transition active:scale-95"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        {heartBurst && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Heart className="h-28 w-28 fill-destructive text-destructive animate-ping drop-shadow-[0_0_28px_hsl(var(--destructive)/0.8)]" />
          </div>
        )}

        {!playing && (
          <button
            aria-label="Play clip"
            onClick={togglePlay}
            className="absolute inset-0 grid place-items-center"
          >
            <span className="h-20 w-20 rounded-full border border-white/20 bg-foreground/95 text-background grid place-items-center shadow-[0_0_34px_hsl(var(--primary)/0.3)] backdrop-blur">
              <Play className="h-9 w-9 fill-current ml-1" />
            </span>
          </button>
        )}

        <div className="absolute inset-x-4 bottom-3 h-1 overflow-hidden rounded-full bg-white/12">
          <div className="h-full rounded-full bg-gradient-cta transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>

        <ActionRail
          clip={clip}
          liked={liked}
          saved={saved}
          onLike={onLike}
          onComment={onComment}
          onShare={onShare}
          onSave={onSave}
        />

        <div className="absolute bottom-8 left-4 right-24 space-y-2">
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-background/30 px-1.5 py-1 backdrop-blur-xl">
            <Link to={`/player/${clip.owner_id}`} className="flex min-w-0 items-center gap-1.5">
              <span className="h-7 w-7 overflow-hidden rounded-full border border-primary/30 bg-primary/12 grid place-items-center">
                {clip.user?.avatar ? (
                  <img src={clip.user.avatar} alt={ownerName} className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-4 w-4 text-primary" />
                )}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-xs font-black leading-tight">
                  <span className="truncate">{ownerName}</span>
                  <ShieldCheck className="h-3 w-3 shrink-0 text-secondary" />
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">{ownerHandle}</span>
              </span>
            </Link>
            {showFollow && (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onFollow();
                }}
                className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-black text-primary-foreground transition active:scale-95"
              >
                Follow
              </button>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-black leading-tight text-balance drop-shadow-lg">{clip.match_name}</h2>
            {teams && <p className="text-sm font-bold text-foreground/95">{teams}</p>}
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {clip.location && (
                <>
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>{clip.location}</span>
                </>
              )}
              {clip.location && uploadedAt && <span>•</span>}
              {uploadedAt && <span>{uploadedAt}</span>}
            </p>
          </div>

          <div className="flex max-w-full gap-1 overflow-hidden">
            {chips.map((chip) => (
              <span key={chip} className="shrink-0 rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] font-bold text-foreground/85 backdrop-blur">
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function ActionRail({
  clip,
  liked,
  saved,
  onLike,
  onComment,
  onShare,
  onSave,
}: {
  clip: FeedClip;
  liked: boolean;
  saved: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
}) {
  return (
    <div className="absolute bottom-24 right-3 flex flex-col items-center gap-2.5 text-foreground">
      <RailButton
        label="Like"
        count={formatCount(clip.likes_count)}
        active={liked}
        activeClassName="bg-destructive text-destructive-foreground border-destructive shadow-[0_0_22px_hsl(var(--destructive)/0.42)]"
        onClick={onLike}
      >
        <Heart className={cn("h-5 w-5", liked && "fill-current")} />
      </RailButton>

      <RailButton label="Comment" count={formatCount(clip.comments_count)} onClick={onComment}>
        <MessageCircle className="h-5 w-5 text-secondary" />
      </RailButton>

      <RailButton label="Share" count={formatCount(clip.shares_count)} onClick={onShare}>
        <Share2 className="h-5 w-5 text-primary" />
      </RailButton>

      <RailButton
        label="Save"
        active={saved}
        activeClassName="bg-primary text-primary-foreground border-primary shadow-[0_0_22px_hsl(var(--primary)/0.38)]"
        onClick={onSave}
      >
        <Bookmark className={cn("h-5 w-5", saved && "fill-current")} />
      </RailButton>
    </div>
  );
}

function RailButton({
  children,
  label,
  count,
  active,
  activeClassName,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  count?: string;
  active?: boolean;
  activeClassName?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="group flex flex-col items-center gap-1 active:scale-90 transition-transform">
      <span
        className={cn(
          "h-10 w-10 rounded-full border border-white/10 bg-transparent grid place-items-center text-foreground shadow-none backdrop-blur-sm transition-all group-hover:bg-white/10",
          active && activeClassName,
        )}
      >
        {children}
      </span>
      {count && <span className="text-[11px] font-black drop-shadow">{count}</span>}
    </button>
  );
}

function CommentDrawer({
  clip,
  currentUser,
  onOpenChange,
  onCountChange,
}: {
  clip: FeedClip | null;
  currentUser: AuthUser | null;
  onOpenChange: (open: boolean) => void;
  onCountChange: (matchId: string, count: number) => void;
}) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [comments],
  );

  const loadComments = useCallback(async () => {
    if (!clip) return;
    setLoading(true);
    setError("");
    try {
      const data = await getComments({ matchId: clip.id });
      const nextComments = data.comments || [];
      setComments(nextComments);
      onCountChange(clip.id, data.count ?? nextComments.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load comments");
    } finally {
      setLoading(false);
    }
  }, [clip, onCountChange]);

  useEffect(() => {
    if (!clip) {
      setComments([]);
      setDraft("");
      setError("");
      return;
    }

    loadComments();
    window.setTimeout(() => inputRef.current?.focus(), 250);
  }, [clip, loadComments]);

  const submitComment = async () => {
    if (!clip) return;
    const text = draft.trim();

    if (!currentUser) {
      toast.message("Sign in to comment");
      return;
    }

    if (!text) return;

    setPosting(true);
    const optimistic: CommentItem = {
      id: `temp-${Date.now()}`,
      match_id: clip.id,
      highlight_id: null,
      comment: text,
      likes_count: 0,
      liked: false,
      created_at: new Date().toISOString(),
      user: {
        id: currentUser.id,
        name: currentUser.name,
        handle: currentUser.handle || currentUser.name.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 18),
        avatar: currentUser.avatar || null,
        verified: Boolean(currentUser.is_verified),
      },
    };

    setComments((items) => [optimistic, ...items]);
    setDraft("");
    onCountChange(clip.id, comments.length + 1);

    try {
      const created = await createComment({ matchId: clip.id, comment: text });
      setComments((items) => items.map((item) => item.id === optimistic.id ? created : item));
      await loadComments();
    } catch (err) {
      setComments((items) => items.filter((item) => item.id !== optimistic.id));
      onCountChange(clip.id, comments.length);
      toast.error(err instanceof Error ? err.message : "Could not post comment");
    } finally {
      setPosting(false);
    }
  };

  const likeComment = async (commentId: string) => {
    if (!currentUser) {
      toast.message("Sign in to like comments");
      return;
    }

    const previous = comments;
    setComments((items) =>
      items.map((item) =>
        item.id === commentId
          ? { ...item, liked: !item.liked, likes_count: Math.max(0, item.likes_count + (item.liked ? -1 : 1)) }
          : item,
      ),
    );

    try {
      const updated = await toggleCommentLike(commentId);
      setComments((items) => items.map((item) => item.id === commentId ? updated : item));
    } catch (err) {
      setComments(previous);
      toast.error(err instanceof Error ? err.message : "Could not update like");
    }
  };

  const countLabel = sortedComments.length === 1 ? "1 comment" : `${sortedComments.length} comments`;

  return (
    <Drawer open={Boolean(clip)} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="mx-auto max-w-[440px] rounded-t-[32px] border-white/10 bg-[#0b111d]/96 px-0 pb-0 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        <DrawerHeader className="border-b border-white/10 px-4 pb-3 pt-1 text-center">
          <DrawerTitle className="text-lg font-black">Comments</DrawerTitle>
          <DrawerDescription className="text-xs">{countLabel}</DrawerDescription>
        </DrawerHeader>

        <div className="max-h-[58dvh] min-h-[320px] overflow-y-auto px-4 py-4 scrollbar-hide">
          {loading && (
            <div className="space-y-4">
              {[0, 1, 2, 3].map((item) => <CommentSkeleton key={item} />)}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-3xl border border-destructive/25 bg-destructive/10 p-5 text-center">
              <p className="text-sm font-bold">Could not load comments</p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
              <Button variant="soft" size="sm" className="mt-4" onClick={loadComments}>Retry</Button>
            </div>
          )}

          {!loading && !error && sortedComments.length === 0 && (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-base font-black">No comments yet</p>
              <p className="mt-1 max-w-[240px] text-sm text-muted-foreground">Be the first to comment.</p>
            </div>
          )}

          {!loading && !error && sortedComments.length > 0 && (
            <div className="space-y-4">
              {sortedComments.map((comment) => (
                <CommentRow key={comment.id} comment={comment} onLike={() => likeComment(comment.id)} />
              ))}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-white/10 bg-[#0b111d]/98 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Avatar
              name={currentUser?.name || "Player"}
              src={currentUser?.avatar || null}
              className="h-9 w-9"
            />
            <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/10 bg-white/6 px-3">
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 280))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitComment();
                  }
                }}
                placeholder={currentUser ? "Add a comment..." : "Sign in to comment..."}
                disabled={!currentUser || posting}
                className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={submitComment}
                disabled={!draft.trim() || !currentUser || posting}
                className="grid h-8 w-8 place-items-center rounded-full text-primary transition disabled:text-muted-foreground disabled:opacity-40"
                aria-label="Send comment"
              >
                {posting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function CommentRow({ comment, onLike }: { comment: CommentItem; onLike: () => void }) {
  const user = comment.user;

  return (
    <div className="flex gap-3">
      <Avatar name={user?.name || "Player"} src={user?.avatar || null} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-black">{user?.name || "CrickPulse user"}</p>
          {user?.verified && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-secondary" />}
          {user?.handle && <p className="truncate text-xs text-muted-foreground">@{user.handle}</p>}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-5 text-foreground/90">{comment.comment}</p>
        <div className="mt-1.5 flex items-center gap-4 text-[11px] font-bold text-muted-foreground">
          <span>{formatUploadedTime(comment.created_at)}</span>
          <button type="button" onClick={onLike} className={cn("transition", comment.liked && "text-primary")}>
            {comment.likes_count ? `${comment.likes_count} likes` : "Like"}
          </button>
          <button type="button" onClick={() => toast.message("Replies are coming soon")}>Reply</button>
        </div>
      </div>
      <button
        type="button"
        onClick={onLike}
        className={cn("mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition", comment.liked && "text-destructive")}
        aria-label="Like comment"
      >
        <Heart className={cn("h-4 w-4", comment.liked && "fill-current")} />
      </button>
    </div>
  );
}

function CommentSkeleton() {
  return (
    <div className="flex gap-3">
      <div className="h-9 w-9 animate-pulse rounded-full bg-white/8" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-white/8" />
        <div className="h-3 w-full animate-pulse rounded bg-white/8" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-white/8" />
      </div>
    </div>
  );
}

function Avatar({ name, src, className }: { name: string; src: string | null; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-cta text-xs font-black text-primary-foreground", className)}>
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ShareDrawer({
  clip,
  onOpenChange,
  onShare,
}: {
  clip: FeedClip | null;
  onOpenChange: (open: boolean) => void;
  onShare: (clip: FeedClip) => void;
}) {
  return (
    <Drawer open={Boolean(clip)} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-[440px] rounded-t-[30px] border-white/10 bg-card/95 px-4 pb-6 backdrop-blur-2xl">
        <DrawerHeader className="px-0 text-left">
          <DrawerTitle className="text-xl font-black">Share match</DrawerTitle>
          <DrawerDescription>{clip?.match_name || "CrickPulse match"}</DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-3">
          <Button
            variant="hero"
            size="lg"
            onClick={() => {
              if (clip) onShare(clip);
            }}
          >
            <Share2 className="h-4 w-4" />
            Share link
          </Button>
          <Link to={clip ? buildChatShareUrl(clip) : "/chat"}>
            <Button variant="soft" size="lg" className="w-full">
              <MessageCircle className="h-4 w-4" />
              Send chat
            </Button>
          </Link>
          <DrawerClose asChild>
            <Button variant="soft" size="lg">Close</Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function getMatchChips(clip: FeedClip) {
  const chips = ["#CrickPulse", "#MatchReel"];
  if (clip.team_a && clip.team_b) chips.push("#Rivalry");
  if (clip.location) chips.push(`#${clip.location.split(/\s+/)[0]}`);
  return chips.slice(0, 4);
}

function buildChatShareUrl(clip: FeedClip) {
  const params = new URLSearchParams({
    shareType: "match",
    shareId: clip.id,
    title: clip.match_name || "CrickPulse match",
    subtitle: [clip.team_a && clip.team_b ? `${clip.team_a} vs ${clip.team_b}` : "", clip.location || ""].filter(Boolean).join(" · ") || "Match reel",
  });
  if (clip.thumbnail_url) params.set("thumb", clip.thumbnail_url);
  return `/chat?${params.toString()}`;
}

function formatUploadedTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
