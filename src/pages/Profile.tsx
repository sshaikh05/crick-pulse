import {
  Activity,
  Award,
  BarChart3,
  Calendar,
  Camera,
  Crown,
  Edit3,
  Flame,
  IdCard,
  ImageDown,
  LogOut,
  MessageCircle,
  MapPin,
  Play,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Upload,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { PlayerCard } from "@/components/PlayerCard";
import { getFollowers, getFollowing, getProfile, openConversation, updateProfile } from "@/lib/api";
import { cn } from "@/lib/utils";
import avatar from "@/assets/player-avatar.jpg";

interface ProfileRow {
  id: string;
  username: string;
  handle: string;
  email: string;
  avatar_url: string | null;
  bio: string;
  location: string;
  player_role: string;
  followers_count: number;
  following_count: number;
  verified: boolean;
  total_runs: number;
  total_wickets: number;
  strike_rate: number;
  batting_average: number;
  matches_played: number;
  highlights_count: number;
  created_at: string;
}

interface MatchHistoryRow {
  id: string;
  match_name: string;
  team_a: string | null;
  team_b: string | null;
  location?: string | null;
  thumbnail_url: string | null;
  video_url?: string | null;
  match_result?: string;
  runs_scored?: number;
  wickets_taken?: number;
  strike_rate?: number;
  created_at: string;
  status: string;
  scorecard?: ScorecardRow | null;
}

interface ClipRow {
  id: string;
  thumbnail_url: string | null;
  video_url: string;
  title: string;
  created_at: string;
  match_id: string | null;
}

interface ScorecardRow {
  id: string;
  match_id: string;
  player_id: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strike_rate: number;
  wickets: number;
  overs: number;
  economy: number;
  catches: number;
  run_outs: number;
  created_at: string;
  match?: MatchHistoryRow | null;
}

interface ProfileBundle {
  profile: ProfileRow;
  stats: {
    total_runs: number;
    total_wickets: number;
    strike_rate: number;
    batting_average: number;
    matches_played: number;
    highlights_count: number;
  };
  matches: MatchHistoryRow[];
  scorecards: ScorecardRow[];
  highlights: ClipRow[];
}

interface SocialUser {
  id: string;
  name?: string;
  username?: string;
  handle?: string;
  avatar?: string | null;
  avatar_url?: string | null;
  player_role?: string;
  location?: string;
  followers_count?: number;
  is_following?: boolean;
  is_self?: boolean;
  verified?: boolean;
  is_verified?: boolean;
}

type SocialListType = "followers" | "following";

type Badge = {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: string;
  earned: boolean;
  hint: string;
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Today";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const resizeProfileImage = (file: File) =>
  new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        const maxSize = 720;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not prepare image"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });

const buildChatShareUrl = ({
  type,
  id,
  title,
  subtitle,
  thumb,
}: {
  type: "profile" | "scorecard" | "match" | "highlight";
  id: string;
  title: string;
  subtitle?: string;
  thumb?: string | null;
}) => {
  const params = new URLSearchParams({
    shareType: type,
    shareId: id,
    title,
    subtitle: subtitle || "CrickPulse item",
  });
  if (thumb) params.set("thumb", thumb);
  return `/chat?${params.toString()}`;
};

export default function Profile() {
  const navigate = useNavigate();
  const { user, signOut, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [matches, setMatches] = useState<MatchHistoryRow[]>([]);
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [scorecards, setScorecards] = useState<ScorecardRow[]>([]);
  const [cardOpen, setCardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socialListOpen, setSocialListOpen] = useState(false);
  const [socialListType, setSocialListType] = useState<SocialListType>("followers");
  const [socialUsers, setSocialUsers] = useState<SocialUser[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState("");
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const applyBundle = useCallback((bundle: ProfileBundle) => {
    setProfile(bundle.profile);
    setMatches(bundle.matches || []);
    setClips(bundle.highlights || []);
    setScorecards(bundle.scorecards || []);
  }, []);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const bundle = await getProfile(user.id);
      applyBundle(bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load profile");
      setProfile(null);
      setMatches([]);
      setClips([]);
      setScorecards([]);
    } finally {
      setLoading(false);
    }
  }, [user, applyBundle]);

  useEffect(() => {
    if (!user) return;

    loadProfile();
  }, [user, loadProfile]);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/auth", { replace: true });
  };

  const loadSocialList = useCallback(async (type: SocialListType) => {
    if (!user) return;
    setSocialLoading(true);
    setSocialError("");
    try {
      const users = type === "followers"
        ? await getFollowers(user.id)
        : await getFollowing(user.id);
      setSocialUsers(users);
    } catch (err) {
      setSocialUsers([]);
      setSocialError(err instanceof Error ? err.message : "Could not load players");
    } finally {
      setSocialLoading(false);
    }
  }, [user]);

  const openSocialList = (type: SocialListType) => {
    setSocialListType(type);
    setSocialListOpen(true);
    void loadSocialList(type);
  };

  const messageUser = async (targetUserId: string) => {
    try {
      await openConversation({ userId: targetUserId });
      setSocialListOpen(false);
      navigate("/chat");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open chat");
    }
  };

  const saveAvatarFile = async (file?: File | null) => {
    if (!file || !profile) return;
    setAvatarSaving(true);
    try {
      const avatar_url = await resizeProfileImage(file);
      const bundle = await updateProfile({
        username: profile.username,
        handle: profile.handle,
        bio: profile.bio || "",
        location: profile.location || "",
        player_role: profile.player_role || "All-Rounder",
        avatar_url,
      });
      applyBundle(bundle);
      await refreshUser();
      setPhotoPickerOpen(false);
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update photo");
    } finally {
      setAvatarSaving(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const roleLabel = profile?.player_role
    ? profile.player_role.replace("_", "-").replace(/\b\w/g, (c) => c.toUpperCase())
    : "All-Rounder";

  const totals = useMemo(() => ({
    runs: profile?.total_runs || 0,
    wickets: profile?.total_wickets || 0,
    matchCount: profile?.matches_played || matches.length,
  }), [profile, matches.length]);

  const trend = useMemo(() => {
    const recent = [...scorecards].reverse().slice(-7);
    return recent.map((scorecard) => ({
      id: scorecard.match_id,
      runs: scorecard.runs || 0,
      label: fmtDate(scorecard.created_at),
    }));
  }, [scorecards]);

  const badges = useMemo(() => {
    const list: Badge[] = [
      { key: "first", label: "First Match", icon: Sparkles, tone: "primary", earned: totals.matchCount >= 1, hint: "Play 1 match" },
      { key: "hitter", label: "Power Hitter", icon: Zap, tone: "accent", earned: totals.runs >= 100, hint: "100+ career runs" },
      { key: "century", label: "Century Club", icon: Crown, tone: "accent", earned: totals.runs >= 500, hint: "500+ career runs" },
      { key: "finisher", label: "Finisher", icon: Target, tone: "secondary", earned: totals.matchCount >= 5, hint: "5+ matches played" },
      { key: "wicket", label: "Sharp Shooter", icon: Shield, tone: "secondary", earned: totals.wickets >= 5, hint: "5+ wickets" },
      { key: "mvp", label: "MVP", icon: Trophy, tone: "primary", earned: totals.runs >= 1000 && totals.wickets >= 10, hint: "1k runs · 10 wkts" },
    ];
    return list;
  }, [totals]);

  const earnedCount = badges.filter((b) => b.earned).length;
  const level = Math.max(1, Math.floor(totals.runs / 50) + 1);
  const avgRuns = profile?.batting_average || 0;
  const strikeRate = profile?.strike_rate || 0;
  const bestMatch = useMemo(() => {
    if (!matches.length) return null;
    return [...matches].sort((a, b) => (b.runs_scored || 0) - (a.runs_scored || 0))[0] || matches[0];
  }, [matches]);
  const profileStrength = Math.min(
    100,
    25 +
      (profile?.avatar_url ? 15 : 0) +
      (profile?.bio ? 12 : 0) +
      (profile?.location ? 10 : 0) +
      (totals.matchCount > 0 ? 25 : 0) +
      earnedCount * 5,
  );

  if (loading) {
    return <ProfileLoading />;
  }

  if (error) {
    return <ProfileError message={error} onRetry={loadProfile} />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.10),transparent_34%),hsl(var(--background))] pb-8">
      <ProfileHero
        profile={profile}
        roleLabel={roleLabel}
        totals={totals}
        level={level}
        profileStrength={profileStrength}
        onSignOut={handleSignOut}
        onEdit={() => setEditOpen(true)}
        onEditPhoto={() => setPhotoPickerOpen(true)}
        onOpenSocialList={openSocialList}
      />

      <div className="space-y-5 px-4 -mt-3">
        <ActionButtons
          onPlayerCard={() => setCardOpen(true)}
          onShareProfile={() => navigate(buildChatShareUrl({
            type: "profile",
            id: user.id,
            title: profile?.username || user.name,
            subtitle: `@${profile?.handle || user.handle || "player"} · ${profile?.player_role || "Player"}`,
            thumb: profile?.avatar_url || user.avatar || "",
          }))}
          onEdit={() => setEditOpen(true)}
        />

        <PerformancePanel
          totals={totals}
          avgRuns={avgRuns}
          strikeRate={strikeRate}
          trend={trend}
        />

        <Achievements badges={badges} earnedCount={earnedCount} />

        <MatchHistory matches={matches} />

        <ScoreCards scorecards={scorecards} />

        <Highlights clips={clips} />

        <CareerSnapshot
          totals={totals}
          avgRuns={avgRuns}
          strikeRate={strikeRate}
          bestMatch={bestMatch}
        />
      </div>

      <PlayerCard
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        name={profile?.username || "Player"}
        avatarUrl={profile?.avatar_url}
        teamName={profile?.location}
        role={roleLabel}
        runs={totals.runs}
        wickets={totals.wickets}
        matches={totals.matchCount}
        level={level}
        shareUrl={typeof window !== "undefined" && user ? `${window.location.origin}/player/${user.id}` : undefined}
      />

      <EditProfileDialog
        open={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onSaved={async (bundle) => {
          applyBundle(bundle);
          await refreshUser();
          setEditOpen(false);
        }}
      />

      <SocialListDialog
        open={socialListOpen}
        type={socialListType}
        users={socialUsers}
        loading={socialLoading}
        error={socialError}
        onClose={() => setSocialListOpen(false)}
        onRetry={() => loadSocialList(socialListType)}
        onViewProfile={(id) => {
          setSocialListOpen(false);
          navigate(`/player/${id}`);
        }}
        onMessage={messageUser}
      />

      <PhotoPickerDialog
        open={photoPickerOpen}
        saving={avatarSaving}
        onClose={() => setPhotoPickerOpen(false)}
        onGallery={() => galleryInputRef.current?.click()}
        onCamera={() => cameraInputRef.current?.click()}
      />

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => saveAvatarFile(event.target.files?.[0])}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(event) => saveAvatarFile(event.target.files?.[0])}
      />
    </div>
  );
}

function ProfileLoading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.10),transparent_34%),hsl(var(--background))] px-4 pb-24 pt-5">
      <div className="h-64 animate-pulse rounded-[32px] border border-white/10 bg-card/60" />
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="h-12 animate-pulse rounded-2xl bg-white/8" />
        <div className="h-12 animate-pulse rounded-2xl bg-white/8" />
        <div className="h-12 animate-pulse rounded-2xl bg-white/8" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-[24px] bg-card/70" />
        ))}
      </div>
    </div>
  );
}

function ProfileError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-28">
      <div className="rounded-[28px] border border-destructive/25 bg-destructive/10 p-5 text-center">
        <h2 className="text-lg font-black">Profile unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button variant="hero" size="lg" className="mt-5 w-full" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

function EditProfileDialog({
  open,
  profile,
  onClose,
  onSaved,
}: {
  open: boolean;
  profile: ProfileRow | null;
  onClose: () => void;
  onSaved: (bundle: ProfileBundle) => void | Promise<void>;
}) {
  const [values, setValues] = useState({
    username: "",
    handle: "",
    bio: "",
    location: "",
    player_role: "All-Rounder",
    avatar_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile || !open) return;
    setValues({
      username: profile.username || "",
      handle: profile.handle || "",
      bio: profile.bio || "",
      location: profile.location || "",
      player_role: profile.player_role || "All-Rounder",
      avatar_url: profile.avatar_url || "",
    });
    setError("");
  }, [profile, open]);

  const setField = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const save = async () => {
    const username = values.username.trim();
    const handle = values.handle.trim().replace(/^@/, "");

    if (username.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    if (handle && !/^[a-zA-Z0-9_]{3,28}$/.test(handle)) {
      setError("Handle must be 3-28 letters, numbers or underscores");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const bundle = await updateProfile({
        username,
        handle,
        bio: values.bio.trim(),
        location: values.location.trim(),
        player_role: values.player_role.trim() || "All-Rounder",
        avatar_url: values.avatar_url.trim(),
      });
      await onSaved(bundle);
      toast.success("Profile updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-[410px] border-white/10 bg-[#0b111d]/95 p-5 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update your player identity and creator details.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Username</Label>
            <Input id="profile-name" value={values.username} onChange={(event) => setField("username", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-handle">Handle</Label>
            <Input id="profile-handle" value={values.handle} onChange={(event) => setField("handle", event.target.value)} placeholder="shahnawazshanu" />
          </div>
          {/* <div className="space-y-1.5">
            <Label>Profile photo</Label>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-muted-foreground">
              Use the camera button on your avatar to choose a photo from gallery or camera.
            </div>
          </div> */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-role">Role</Label>
              <Input id="profile-role" value={values.player_role} onChange={(event) => setField("player_role", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-location">Location</Label>
              <Input id="profile-location" value={values.location} onChange={(event) => setField("location", event.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-bio">Bio</Label>
            <Textarea id="profile-bio" value={values.bio} onChange={(event) => setField("bio", event.target.value)} maxLength={180} className="min-h-20 resize-none" />
          </div>
          {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
        </div>

        <div className="action-buttons">
          <Button variant="soft" size="lg" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="hero" size="lg" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProfileHero({
  profile,
  roleLabel,
  totals,
  level,
  profileStrength,
  onSignOut,
  onEdit,
  onEditPhoto,
  onOpenSocialList,
}: {
  profile: ProfileRow | null;
  roleLabel: string;
  totals: { runs: number; wickets: number; matchCount: number };
  level: number;
  profileStrength: number;
  onSignOut: () => void;
  onEdit: () => void;
  onEditPhoto: () => void;
  onOpenSocialList: (type: SocialListType) => void;
}) {
  const name = profile?.username || "Loading...";
  const handle = `@${profile?.handle || name.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 18) || "crickpulse"}`;

  return (
    <section className="relative overflow-hidden px-4 pb-8 pt-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-hero" />
      <div className="pointer-events-none absolute right-8 top-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 top-20 h-36 w-36 rounded-full bg-secondary/10 blur-3xl" />

      <div className="relative z-10 rounded-[32px] border border-white/10 bg-card/55 p-4 shadow-2xl shadow-black/35 backdrop-blur-xl">
        <div className="flex items-start justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[11px] font-black text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified player
          </div>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            className="h-9 w-9 rounded-full border border-white/10 bg-background/50 grid place-items-center text-muted-foreground backdrop-blur active:scale-95"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="absolute -inset-2 rounded-full bg-gradient-cta opacity-60 blur-lg" />
            <img
              src={profile?.avatar_url || avatar}
              alt={name}
              className="relative h-24 w-24 rounded-[30px] border-4 border-background object-cover shadow-2xl shadow-black/40"
            />
            <button
              type="button"
              onClick={onEditPhoto}
              aria-label="Edit profile photo"
              className="absolute -bottom-1 -left-1 h-8 w-8 rounded-full border-2 border-background bg-primary text-primary-foreground grid place-items-center"
            >
              <Camera className="h-4 w-4" />
            </button>
            <span className="absolute -bottom-2 -right-2 rounded-full border-2 border-background bg-accent px-2.5 py-1 text-[11px] font-black text-accent-foreground">
              LVL {level}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black leading-tight">{name}</h1>
            <p className="truncate text-sm font-semibold text-primary">{handle}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-bold text-foreground/90">
                {roleLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                {profile?.location || "Local arena"}
              </span>
            </div>
            {profile?.bio && <p className="mt-2 max-h-10 overflow-hidden text-xs leading-5 text-muted-foreground">{profile.bio}</p>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-2">
          <SocialStat label="Followers" value={String(profile?.followers_count || 0)} onClick={() => onOpenSocialList("followers")} />
          <SocialStat label="Following" value={String(profile?.following_count || 0)} onClick={() => onOpenSocialList("following")} />
          <SocialStat label="Matches" value={String(totals.matchCount)} />
          <SocialStat label="Reels" value={String(profile?.highlights_count || 0)} />
          <SocialStat label="Runs" value={totals.runs.toLocaleString()} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-background/35 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground">Profile strength</span>
            <span className="font-black text-primary">{profileStrength}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-cta shadow-[0_0_18px_hsl(var(--primary)/0.35)]" style={{ width: `${profileStrength}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function PhotoPickerDialog({
  open,
  saving,
  onClose,
  onGallery,
  onCamera,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onGallery: () => void;
  onCamera: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-[390px] border-white/10 bg-[#0b111d]/95 p-5 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle>Update profile photo</DialogTitle>
          <DialogDescription>Choose a new player photo from your gallery or camera.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Button variant="hero" size="lg" onClick={onGallery} disabled={saving} className="w-full">
            <Upload className="h-4 w-4" />
            {saving ? "Saving..." : "Choose from gallery"}
          </Button>
          <Button variant="soft" size="lg" onClick={onCamera} disabled={saving} className="w-full">
            <Camera className="h-4 w-4" />
            Open camera
          </Button>
          <Button variant="soft" size="lg" onClick={onClose} disabled={saving} className="w-full">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SocialStat({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const content = (
    <>
      <p className="text-sm font-black text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={`${value} ${label}`}
        onClick={onClick}
        className="rounded-2xl border border-white/10 bg-background/40 px-2 py-2 text-center transition hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98]"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-background/40 px-2 py-2 text-center">
      {content}
    </div>
  );
}

function SocialListDialog({
  open,
  type,
  users,
  loading,
  error,
  onClose,
  onRetry,
  onViewProfile,
  onMessage,
}: {
  open: boolean;
  type: SocialListType;
  users: SocialUser[];
  loading: boolean;
  error: string;
  onClose: () => void;
  onRetry: () => void;
  onViewProfile: (id: string) => void;
  onMessage: (id: string) => void;
}) {
  const title = type === "followers" ? "Followers" : "Following";
  const emptyText = type === "followers" ? "No followers yet" : "Not following anyone yet";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-[410px] overflow-hidden border-white/10 bg-[#0b111d]/95 p-0 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        <DialogHeader className="border-b border-white/10 px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <Users className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{users.length ? `${users.length} player${users.length === 1 ? "" : "s"}` : "CrickPulse players"}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] overflow-y-auto px-3 py-3">
          {loading && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="flex animate-pulse items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="h-11 w-11 rounded-full bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-28 rounded-full bg-white/10" />
                    <div className="h-2.5 w-20 rounded-full bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-5 text-center">
              <p className="text-sm font-semibold text-red-200">{error}</p>
              <Button variant="soft" size="sm" className="mt-3" onClick={onRetry}>Retry</Button>
            </div>
          )}

          {!loading && !error && users.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/12 bg-white/5 p-6 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-black">{emptyText}</p>
              <p className="mt-1 text-xs text-muted-foreground">Players will appear here when connections are made.</p>
            </div>
          )}

          {!loading && !error && users.length > 0 && (
            <div className="space-y-2">
              {users.map((item) => {
                const name = item.username || item.name || "CrickPulse Player";
                const handle = item.handle ? `@${item.handle}` : "@player";
                const photo = item.avatar_url || item.avatar || avatar;
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                    <img src={photo} alt={name} className="h-12 w-12 rounded-full border border-white/10 object-cover" />
                    <button type="button" onClick={() => onViewProfile(item.id)} className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-1">
                        <span className="truncate text-sm font-black">{name}</span>
                        {(item.verified || item.is_verified) && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" />}
                      </span>
                      <span className="block truncate text-xs font-semibold text-muted-foreground">{handle}</span>
                      <span className="block truncate text-[11px] text-muted-foreground/80">
                        {item.player_role || "Player"}{item.location ? ` · ${item.location}` : ""}
                      </span>
                    </button>
                    <Button variant="soft" size="sm" onClick={() => onMessage(item.id)} disabled={Boolean(item.is_self)}>
                      <MessageCircle className="h-3.5 w-3.5" />
                      Message
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActionButtons({
  onPlayerCard,
  onShareProfile,
  onEdit,
}: {
  onPlayerCard: () => void;
  onShareProfile: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="action-buttons">
      <Button variant="hero" size="lg" onClick={onPlayerCard}>
        <IdCard className="h-4 w-4" />
        Card
      </Button>
      <Button variant="soft" size="lg" onClick={onShareProfile}>
        <MessageCircle className="h-4 w-4" />
        Share
      </Button>
      <Button variant="soft" size="lg" onClick={onEdit}>
        <Edit3 className="h-4 w-4" />
        Edit
      </Button>
    </div>
  );
}

function PerformancePanel({
  totals,
  avgRuns,
  strikeRate,
  trend,
}: {
  totals: { runs: number; wickets: number; matchCount: number };
  avgRuns: number;
  strikeRate: number;
  trend: { id: string; runs: number; label: string }[];
}) {
  return (
    <section className="space-y-3">
      <SectionTitle icon={Activity} title="Performance lab" meta="Live analytics" />
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={Flame} label="Runs" value={totals.runs.toLocaleString()} tone="primary" />
        <MetricCard icon={Target} label="Wickets" value={String(totals.wickets)} tone="secondary" />
        <MetricCard icon={BarChart3} label="Strike rate" value={strikeRate ? String(strikeRate) : "--"} tone="accent" />
        <MetricCard icon={Trophy} label="Average" value={avgRuns ? avgRuns.toFixed(1) : "--"} tone="primary" />
      </div>

      <div className="rounded-[28px] border border-white/10 bg-card/70 p-4 shadow-xl shadow-black/25">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black">Runs trend</p>
          <p className="text-[11px] font-bold text-muted-foreground">Last {trend.length || 0} matches</p>
        </div>
        {trend.length > 0 ? (
          <Sparkline data={trend.map((t) => t.runs)} labels={trend.map((t) => t.label)} />
        ) : (
          <div className="py-6">
            <MiniBars />
            <p className="mt-4 text-center text-xs text-muted-foreground">Upload and score your first match to unlock your live trend.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: "primary" | "secondary" | "accent" }) {
  const toneClass = {
    primary: "text-primary bg-primary/12 border-primary/25",
    secondary: "text-secondary bg-secondary/12 border-secondary/25",
    accent: "text-accent bg-accent/12 border-accent/25",
  }[tone];

  return (
    <div className="rounded-[24px] border border-white/10 bg-card/70 p-4 shadow-xl shadow-black/20">
      <div className={cn("mb-4 h-10 w-10 rounded-2xl border grid place-items-center", toneClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Achievements({ badges, earnedCount }: { badges: Badge[]; earnedCount: number }) {
  return (
    <section className="space-y-3">
      <SectionTitle icon={Award} title="Achievement vault" meta={`${earnedCount}/${badges.length} unlocked`} />
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {badges.map((badge) => {
          const Icon = badge.icon;
          return (
            <div
              key={badge.key}
              className={cn(
                "shrink-0 w-[96px] rounded-[24px] border p-3 text-center shadow-lg shadow-black/15",
                badge.earned
                  ? "border-primary/35 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/5 text-muted-foreground opacity-75",
              )}
            >
              <div className={cn("mx-auto mb-2 h-11 w-11 rounded-2xl grid place-items-center", badge.earned ? "bg-primary/18" : "bg-white/6")}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-[10px] font-black leading-tight">{badge.label}</p>
              <p className="mt-1 text-[9px] leading-tight text-muted-foreground">{badge.hint}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MatchHistory({ matches }: { matches: MatchHistoryRow[] }) {
  return (
    <section className="space-y-3">
      <SectionTitle icon={Calendar} title="Match history" meta={matches.length ? `${matches.length} total` : "Start timeline"} />
      {matches.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No matches yet"
          body="Upload your first match and your cricket timeline will start here."
          action="Upload Your First Match"
          to="/upload"
        />
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
          {matches.map((match) => (
            <Link
              key={match.id}
              to={`/editor?match=${match.id}`}
              className="relative block h-48 w-64 shrink-0 overflow-hidden rounded-[28px] border border-white/10 bg-card shadow-xl shadow-black/25"
            >
              {match.thumbnail_url ? (
                <img src={match.thumbnail_url} alt={match.match_name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.24),transparent_46%),linear-gradient(145deg,hsl(222_32%_14%),hsl(222_35%_7%))]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
              <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
                <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-black text-primary-foreground">ACTIVE</span>
                <Play className="h-5 w-5 fill-current text-foreground" />
              </div>
              <div className="absolute bottom-4 left-4 right-4 space-y-1">
                <p className="truncate text-lg font-black">{match.match_name}</p>
                <p className="truncate text-xs font-bold text-foreground/85">
                  {match.team_a && match.team_b ? `${match.team_a} vs ${match.team_b}` : "Match upload"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {[match.location, fmtDate(match.created_at)].filter(Boolean).join(" · ")}
                </p>
                {(match.runs_scored || match.wickets_taken || match.match_result) && (
                  <p className="truncate text-[11px] font-bold text-primary">
                    {match.runs_scored || 0} runs · {match.wickets_taken || 0} wickets{match.match_result ? ` · ${match.match_result}` : ""}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function ScoreCards({ scorecards }: { scorecards: ScorecardRow[] }) {
  return (
    <section className="space-y-3">
      <SectionTitle icon={BarChart3} title="Score cards" meta={scorecards.length ? `${scorecards.length} cards` : "Live data"} />
      {scorecards.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No score cards yet"
          body="Upload or score a match and your player cards will appear here automatically."
          action="Upload Match"
          to="/upload"
        />
      ) : (
        <div className="space-y-3">
          {scorecards.map((scorecard) => {
            const match = scorecard.match;
            return (
              <div
                key={scorecard.id}
                className="rounded-[26px] border border-white/10 bg-card/70 p-3 shadow-xl shadow-black/20 transition hover:border-primary/30"
              >
                <Link to={match?.id ? `/editor?match=${match.id}` : "/profile"} className="flex gap-3">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[22px] bg-background">
                    {match?.thumbnail_url ? (
                      <img src={match.thumbnail_url} alt={match.match_name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-full w-full bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.25),transparent_55%),hsl(var(--muted))]" />
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-black text-primary-foreground">
                      SCORE
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black">{match?.match_name || "Score card"}</h3>
                        <p className="truncate text-xs font-semibold text-muted-foreground">
                          {match?.team_a && match?.team_b ? `${match.team_a} vs ${match.team_b}` : match?.location || "CrickPulse match"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold text-muted-foreground">{fmtDate(scorecard.created_at)}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1.5">
                      <ScoreMini label="Runs" value={String(scorecard.runs)} />
                      <ScoreMini label="SR" value={scorecard.strike_rate ? String(scorecard.strike_rate) : "--"} />
                      <ScoreMini label="Wkts" value={String(scorecard.wickets)} />
                      <ScoreMini label="4s/6s" value={`${scorecard.fours}/${scorecard.sixes}`} />
                    </div>
                    <p className="mt-2 truncate text-[11px] text-muted-foreground">
                      {scorecard.balls} balls · {scorecard.overs} overs · Economy {scorecard.economy || "--"}
                      {match?.match_result ? ` · ${match.match_result}` : ""}
                    </p>
                  </div>
                </Link>
                <Link
                  to={buildChatShareUrl({
                    type: "scorecard",
                    id: scorecard.id,
                    title: match?.match_name || "Score card",
                    subtitle: `${scorecard.runs} runs · ${scorecard.wickets} wickets · SR ${scorecard.strike_rate || "--"}`,
                    thumb: match?.thumbnail_url || "",
                  })}
                  className="mt-3 flex h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-xs font-black text-muted-foreground transition hover:border-primary/30 hover:text-primary"
                >
                  <MessageCircle className="h-4 w-4" />
                  Send scorecard
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ScoreMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-background/40 px-2 py-1.5 text-center">
      <p className="truncate text-sm font-black">{value}</p>
      <p className="mt-0.5 text-[8px] font-black uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Highlights({ clips }: { clips: ClipRow[] }) {
  return (
    <section className="space-y-3">
      <SectionTitle icon={Play} title="Pinned highlights" meta={clips.length ? "Latest reels" : "Awaiting clips"} />
      {clips.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No highlights yet"
          body="Your best shots and wickets will appear here once clips are created."
          action="Upload Match"
          to="/upload"
        />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {clips.map((clip) => (
            <div key={clip.id} className="space-y-1.5">
              <Link
                to={clip.match_id ? `/editor?match=${clip.match_id}` : "/profile"}
                className="relative block aspect-[3/4] overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-lg shadow-black/20"
              >
                {clip.thumbnail_url ? (
                  <img src={clip.thumbnail_url} alt={clip.title || "Clip"} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-cta opacity-30" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                <Play className="absolute right-2 top-2 h-4 w-4 fill-current text-foreground" />
                <p className="absolute bottom-2 left-2 right-2 truncate text-[10px] font-black">{clip.title}</p>
              </Link>
              <Link
                to={buildChatShareUrl({
                  type: "highlight",
                  id: clip.id,
                  title: clip.title || "Highlight",
                  subtitle: "CrickPulse highlight",
                  thumb: clip.thumbnail_url || "",
                })}
                className="grid h-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-primary"
                aria-label="Send highlight to chat"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CareerSnapshot({
  totals,
  avgRuns,
  strikeRate,
  bestMatch,
}: {
  totals: { runs: number; wickets: number; matchCount: number };
  avgRuns: number;
  strikeRate: number;
  bestMatch: MatchHistoryRow | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/10 bg-card/75 p-4 shadow-xl shadow-black/25 backdrop-blur">
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-primary/55 to-transparent" />
      <div className="relative space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Career snapshot</p>
            <h2 className="mt-1 text-lg font-black leading-tight">Creator card stats</h2>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-primary/20 bg-primary/8 text-primary">
            <Crown className="h-5 w-5" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <SnapshotMetric label="Matches" value={String(totals.matchCount)} />
          <SnapshotMetric label="Avg runs" value={avgRuns ? avgRuns.toFixed(1) : "--"} />
          <SnapshotMetric label="Strike rate" value={strikeRate ? String(strikeRate) : "--"} />
          <SnapshotMetric label="Best" value={bestMatch ? bestMatch.match_name : "Coming"} />
        </div>

        <Button variant="soft" size="lg" className="w-full">
          <ImageDown className="h-4 w-4" />
          Share as Image
        </Button>
      </div>
    </section>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/40 p-3 shadow-inner shadow-white/[0.02]">
      <p className="truncate text-xl font-black leading-none">{value}</p>
      <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, meta }: { icon: LucideIcon; title: string; meta?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-base font-black">
        <span className="h-8 w-8 rounded-xl bg-primary/12 grid place-items-center text-primary">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      {meta && <span className="text-[11px] font-bold text-muted-foreground">{meta}</span>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action, to }: { icon: LucideIcon; title: string; body: string; action: string; to: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/15 bg-card/45 p-5 text-center shadow-xl shadow-black/15">
      <div className="mx-auto h-14 w-14 rounded-2xl border border-primary/25 bg-primary/10 grid place-items-center text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-3 text-base font-black">{title}</h3>
      <p className="mx-auto mt-1 max-w-[250px] text-sm leading-5 text-muted-foreground">{body}</p>
      <Link to={to} className="mt-4 inline-flex">
        <Button variant="hero" size="sm">
          <Upload className="h-4 w-4" />
          {action}
        </Button>
      </Link>
    </div>
  );
}

function MiniBars() {
  return (
    <div className="flex h-16 items-end justify-center gap-2">
      {[28, 46, 34, 58, 42, 70, 52].map((height, index) => (
        <div key={index} className="w-6 rounded-t-xl bg-gradient-cta opacity-70" style={{ height: `${height}%` }} />
      ))}
    </div>
  );
}

function Sparkline({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(1, ...data);
  const W = 320;
  const H = 80;
  const step = data.length > 1 ? W / (data.length - 1) : 0;
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(H - (v / max) * H).toFixed(1)}`).join(" ");
  const area = `0,${H} ${pts} ${W},${H}`;

  return (
    <div className="mt-4 space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full" preserveAspectRatio="none" aria-label="Runs trend">
        <polygon points={area} fill="hsl(var(--primary) / 0.18)" />
        <polyline points={pts} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((v, i) => (
          <circle key={i} cx={i * step} cy={H - (v / max) * H} r="3.5" fill="hsl(var(--primary))" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
        {labels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  );
}
