import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Crown,
  Download,
  Instagram,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import {
  exportHighlight,
  generateHighlight,
  getHighlight,
  getProfile,
  trackHighlightShare,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import clip2 from "@/assets/clip-2.jpg";

type Format = "reels" | "post" | "wide";
type ShareTarget = "instagram" | "whatsapp" | "download" | "copy";

interface ShareHighlight {
  id: string;
  video_url: string;
  thumbnail_url: string;
  title: string;
  caption: string;
  match_id: string;
  match: {
    id: string;
    match_name: string;
    team_a: string;
    team_b: string;
    location: string;
    video_url: string;
    thumbnail_url: string;
    match_result: string;
    user: { id: string; name: string; avatar: string | null; handle?: string | null } | null;
  } | null;
  scorecard: {
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    strike_rate: number;
    wickets: number;
    overs: number;
    economy: number;
  };
}

interface ExportResult {
  highlight_id: string;
  format: Format;
  watermark: boolean;
  video_url: string;
  caption: string;
  filename: string;
  cached: boolean;
}

const CAPTION_LIMIT = 220;

const FORMATS: Array<{ key: Format; label: string; ratio: string; cls: string; hint: string }> = [
  { key: "reels", label: "Reels", ratio: "9:16", cls: "aspect-[9/16] max-w-[280px]", hint: "Instagram, TikTok, Shorts" },
  { key: "post", label: "Post", ratio: "1:1", cls: "aspect-square max-w-[320px]", hint: "Instagram feed" },
  { key: "wide", label: "Wide", ratio: "16:9", cls: "aspect-video max-w-[400px]", hint: "WhatsApp, YouTube" },
];

const makeCaptions = (data: {
  title: string;
  teams: string;
  runs: number;
  balls: number;
  sr: number;
  wickets: number;
  player: string;
}) => [
  `${data.player} lit up ${data.title}: ${data.runs}(${data.balls}) at SR ${data.sr}. #CrickPulse #Cricket`,
  `Pure cricket energy. ${data.runs} runs, ${data.wickets} wickets, and a highlight worth sharing.`,
  `${data.teams} had a moment. Watch ${data.player}'s best cuts from ${data.title}.`,
  `Built for reels: ${data.runs} off ${data.balls}, SR ${data.sr}. Tap in for the highlight.`,
  `Another local cricket story goes big. ${data.title} on CrickPulse.`,
];

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export default function Share() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const matchParam = params.get("match");
  const highlightParam = params.get("highlight");
  const [highlight, setHighlight] = useState<ShareHighlight | null>(null);
  const [format, setFormat] = useState<Format>("reels");
  const [caption, setCaption] = useState("");
  const [captionIndex, setCaptionIndex] = useState(0);
  const [captionEdited, setCaptionEdited] = useState(false);
  const [removeWatermark, setRemoveWatermark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(true);
  const [busyTarget, setBusyTarget] = useState<ShareTarget | "prepare" | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [lastExport, setLastExport] = useState<ExportResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isPro = false;
  const selectedFormat = FORMATS.find((item) => item.key === format) || FORMATS[0];

  const stats = useMemo(() => {
    const runs = highlight?.scorecard?.runs || 0;
    const balls = highlight?.scorecard?.balls || 0;
    const sr = highlight?.scorecard?.strike_rate || (balls > 0 ? Math.round((runs / balls) * 100) : 0);
    return {
      runs,
      balls,
      sr,
      wickets: highlight?.scorecard?.wickets || 0,
      fours: highlight?.scorecard?.fours || 0,
      sixes: highlight?.scorecard?.sixes || 0,
    };
  }, [highlight]);

  const title = highlight?.match?.match_name || highlight?.title || "Share Highlight";
  const teams = highlight?.match?.team_a && highlight?.match?.team_b
    ? `${highlight.match.team_a} vs ${highlight.match.team_b}`
    : "CrickPulse Match";
  const player = highlight?.match?.user?.name || user?.name || "Player";
  const videoUrl = highlight?.video_url || highlight?.match?.video_url || "";
  const posterUrl = highlight?.thumbnail_url || highlight?.match?.thumbnail_url || clip2;
  const shareUrl = `${window.location.origin}/share${highlight ? `?highlight=${highlight.id}` : matchParam ? `?match=${matchParam}` : ""}`;
  const chatShareUrl = highlight
    ? `/chat?${new URLSearchParams({
        shareType: "highlight",
        shareId: highlight.id,
        title,
        subtitle: teams || "CrickPulse highlight",
        ...(posterUrl ? { thumb: posterUrl } : {}),
      }).toString()}`
    : "/chat";

  const captionPresets = useMemo(
    () => makeCaptions({ title, teams, player, runs: stats.runs, balls: stats.balls, sr: stats.sr, wickets: stats.wickets }),
    [player, stats.balls, stats.runs, stats.sr, stats.wickets, teams, title],
  );

  const loadHighlight = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");

    try {
      let data: ShareHighlight | null = null;

      if (highlightParam) {
        data = await getHighlight(highlightParam);
      } else {
        let matchId = matchParam;
        if (!matchId) {
          const profile = await getProfile(user.id);
          matchId = profile.matches?.[0]?.id || null;
        }

        if (!matchId) {
          setHighlight(null);
          setCaption("");
          return;
        }

        data = await generateHighlight({ match_id: matchId });
      }

      setHighlight(data);
      setCaptionEdited(false);
      setLastExport(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load highlight");
    } finally {
      setLoading(false);
    }
  }, [highlightParam, matchParam, user]);

  useEffect(() => {
    loadHighlight();
  }, [loadHighlight]);

  useEffect(() => {
    if (!highlight || captionEdited) return;
    const saved = window.localStorage.getItem(`crickpulse_caption_${highlight.id}`);
    setCaption((saved || highlight.caption || captionPresets[captionIndex] || "").slice(0, CAPTION_LIMIT));
  }, [captionIndex, captionEdited, captionPresets, highlight]);

  useEffect(() => {
    if (!highlight || !captionEdited) return;
    window.localStorage.setItem(`crickpulse_caption_${highlight.id}`, caption);
  }, [caption, captionEdited, highlight]);

  const prepareExport = async (target?: ShareTarget) => {
    if (!highlight) throw new Error("No highlight selected");

    setBusyTarget(target || "prepare");
    setExportProgress(12);
    await sleep(180);
    setExportProgress(44);

    const exported = await exportHighlight({
      highlight_id: highlight.id,
      format,
      caption,
      watermark: !removeWatermark,
    });

    setExportProgress(82);
    await sleep(160);
    setExportProgress(100);
    setLastExport(exported);
    return exported as ExportResult;
  };

  const fetchExportFile = async (exported: ExportResult) => {
    const response = await fetch(exported.video_url);
    if (!response.ok) throw new Error("Could not fetch exported video");
    const blob = await response.blob();
    return new File([blob], exported.filename || "CrickPulse_Highlight.mp4", { type: blob.type || "video/mp4" });
  };

  const finishBusy = () => {
    window.setTimeout(() => {
      setBusyTarget(null);
      setExportProgress(0);
    }, 500);
  };

  const handlePrepare = async () => {
    try {
      await prepareExport();
      toast.success("Highlight prepared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      finishBusy();
    }
  };

  const handleDownload = async () => {
    if (!highlight) return;
    try {
      const exported = await prepareExport("download");
      const file = await fetchExportFile(exported);
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = exported.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      await trackHighlightShare({ highlight_id: highlight.id, channel: "download" }).catch(() => {});
      toast.success("Highlight download started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      finishBusy();
    }
  };

  const shareNativeVideo = async (exported: ExportResult, text: string) => {
    if (!navigator.share) return false;
    const file = await fetchExportFile(exported);
    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };

    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, text });
      return true;
    }

    await navigator.share({ title, text, url: shareUrl });
    return true;
  };

  const handleInstagram = async () => {
    if (!highlight) return;
    try {
      const exported = await prepareExport("instagram");
      const shared = await shareNativeVideo(exported, caption).catch(() => false);
      await trackHighlightShare({ highlight_id: highlight.id, channel: "instagram" }).catch(() => {});

      if (shared) {
        toast.success("Opened share sheet for Instagram");
      } else {
        toast.message("Instagram web cannot accept direct video upload here", {
          description: "The video is prepared. Download it, then post it to Instagram Reels.",
        });
        window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Instagram sharing failed");
    } finally {
      finishBusy();
    }
  };

  const handleWhatsApp = async () => {
    if (!highlight) return;
    const text = [`*${title}*`, teams, "", caption, "", `Watch: ${shareUrl}`].join("\n");

    try {
      const exported = await prepareExport("whatsapp");
      const shared = await shareNativeVideo(exported, text).catch(() => false);
      await trackHighlightShare({ highlight_id: highlight.id, channel: "whatsapp" }).catch(() => {});

      if (!shared) {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      }
      toast.success("WhatsApp share ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "WhatsApp sharing failed");
    } finally {
      finishBusy();
    }
  };

  const copyCaption = async () => {
    await navigator.clipboard.writeText(caption);
    toast.success("Caption copied");
  };

  const resetCaption = () => {
    if (highlight) window.localStorage.removeItem(`crickpulse_caption_${highlight.id}`);
    setCaptionEdited(false);
    setCaption(captionPresets[0] || "");
    setCaptionIndex(0);
  };

  const nextCaption = () => {
    setCaptionEdited(false);
    setCaptionIndex((index) => (index + 1) % captionPresets.length);
  };

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await video.play().catch(() => {});
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const handleWatermarkToggle = (checked: boolean) => {
    if (checked && !isPro) {
      toast.message("Remove watermark is a Pro feature", {
        description: "Exports keep the CrickPulse watermark on this account.",
      });
      setRemoveWatermark(false);
      return;
    }
    setRemoveWatermark(checked);
  };

  if (loading) {
    return (
      <div className="px-4 pb-24 pt-6">
        <Header backTo="/editor" title="Share Highlight" />
        <div className="mt-6 h-[540px] animate-pulse rounded-[32px] border border-white/10 bg-card/70" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 pb-24 pt-6">
        <Header backTo="/editor" title="Share Highlight" />
        <div className="mt-6 rounded-[28px] border border-destructive/25 bg-destructive/10 p-5 text-center">
          <h2 className="text-lg font-black">Highlight unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button variant="hero" size="lg" className="mt-5 w-full" onClick={loadHighlight}>Try again</Button>
        </div>
      </div>
    );
  }

  if (!highlight) {
    return (
      <div className="px-4 pb-24 pt-6">
        <Header backTo="/" title="Share Highlight" />
        <div className="mt-6 rounded-[28px] border border-dashed border-white/15 bg-card/55 p-6 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 text-lg font-black">No highlight yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">Upload a match first, then prepare a shareable highlight.</p>
          <Link to="/upload" className="mt-5 block">
            <Button variant="hero" size="lg" className="w-full">Upload Match</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 pb-24 pt-6">
      <Header backTo={matchParam ? `/editor?match=${matchParam}` : "/profile"} title="Share Highlight" />

      <div className="grid grid-cols-3 gap-2">
        {FORMATS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFormat(item.key)}
            className={cn(
              "rounded-2xl border p-3 text-left transition",
              format === item.key
                ? "border-primary/45 bg-primary/12 text-primary shadow-[0_0_22px_hsl(var(--primary)/0.14)]"
                : "border-white/10 bg-card/70 text-muted-foreground",
            )}
          >
            <span className="block text-sm font-black">{item.label}</span>
            <span className="mt-0.5 block text-[10px] font-bold">{item.ratio}</span>
          </button>
        ))}
      </div>

      <div className="rounded-[30px] border border-white/10 bg-card/55 p-3 shadow-2xl shadow-black/30">
        <div className={cn("relative mx-auto w-full overflow-hidden rounded-[26px] border border-white/10 bg-background glow-primary", selectedFormat.cls)}>
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              poster={posterUrl}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              playsInline
              loop
              autoPlay
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          ) : (
            <img src={posterUrl} alt="Highlight preview" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-overlay" />
          <button type="button" onClick={togglePlayback} className="absolute inset-0 grid place-items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-foreground/92 text-background shadow-xl shadow-black/30">
              {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}
            </span>
          </button>
          <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-3">
            <span className="rounded-full bg-background/65 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider backdrop-blur">
              {selectedFormat.label} Export
            </span>
            {!removeWatermark && (
              <span className="rounded-md bg-foreground/90 px-2 py-0.5 text-[9px] font-black text-background">CRICKPULSE</span>
            )}
          </div>
          <div className="absolute bottom-4 left-3 right-3">
            <p className="text-balance text-lg font-black leading-tight">
              {stats.runs}({stats.balls}) · SR {stats.sr || "--"}
            </p>
            <p className="text-[11px] text-muted-foreground">{teams}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Runs" value={String(stats.runs)} />
        <Stat label="Balls" value={String(stats.balls)} />
        <Stat label="SR" value={stats.sr ? String(stats.sr) : "--"} />
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-black">Caption</label>
          <span className={cn("text-[11px] font-bold", caption.length > CAPTION_LIMIT - 20 ? "text-accent" : "text-muted-foreground")}>
            {caption.length}/{CAPTION_LIMIT}
          </span>
        </div>
        <textarea
          value={caption}
          maxLength={CAPTION_LIMIT}
          onChange={(event) => {
            setCaption(event.target.value);
            setCaptionEdited(true);
          }}
          rows={3}
          className="w-full resize-none rounded-2xl border border-white/10 bg-card/80 p-4 text-sm leading-6 outline-none transition focus:border-primary/50"
        />
        <div className="grid grid-cols-3 gap-2">
          <CaptionAction icon={<Wand2 />} label="Generate" onClick={nextCaption} />
          <CaptionAction icon={<Copy />} label="Copy" onClick={copyCaption} />
          <CaptionAction icon={<RefreshCw />} label="Reset" onClick={resetCaption} />
        </div>
      </section>

      {busyTarget && (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
          <div className="flex items-center justify-between text-xs font-black text-primary">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {busyTarget === "prepare" ? "Preparing highlight" : `Preparing ${busyTarget}`}
            </span>
            <span>{exportProgress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-cta transition-all" style={{ width: `${exportProgress}%` }} />
          </div>
        </div>
      )}

      {lastExport && (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-card/70 p-3 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span className="truncate">Ready: {lastExport.filename}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <ShareBtn
          color="from-pink-500 via-orange-500 to-yellow-400"
          icon={<Instagram />}
          label="Instagram"
          loading={busyTarget === "instagram"}
          onClick={handleInstagram}
        />
        <ShareBtn
          color="from-emerald-400 to-emerald-600"
          icon={<MessageCircle />}
          label="WhatsApp"
          loading={busyTarget === "whatsapp"}
          onClick={handleWhatsApp}
        />
        <ShareBtn
          color="from-secondary to-primary"
          icon={<Download />}
          label="Download"
          loading={busyTarget === "download"}
          onClick={handleDownload}
        />
      </div>

      <Link to={chatShareUrl}>
        <Button variant="soft" size="lg" className="w-full">
          <MessageCircle className="h-4 w-4" />
          Send highlight in chat
        </Button>
      </Link>

      <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-six grid place-items-center glow-orange">
          <Crown className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Remove watermark</p>
          <p className="text-[11px] text-muted-foreground">Pro feature · Cleaner shareable</p>
        </div>
        <Switch checked={removeWatermark} onCheckedChange={handleWatermarkToggle} />
      </div>

      <Button variant="hero" size="xl" className="w-full" onClick={handlePrepare} disabled={Boolean(busyTarget)}>
        {busyTarget === "prepare" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Prepare Highlight
      </Button>
    </div>
  );
}

function Header({ backTo, title }: { backTo: string; title: string }) {
  return (
    <header className="flex items-center justify-between">
      <Link to={backTo} className="h-10 w-10 rounded-full bg-card border border-border grid place-items-center">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <h1 className="font-bold">{title}</h1>
      <div className="w-10" />
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border py-3">
      <p className="text-xl font-black">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

function CaptionAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 text-xs font-black text-muted-foreground transition hover:text-foreground"
    >
      <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      {label}
    </button>
  );
}

function ShareBtn({
  color,
  icon,
  label,
  loading,
  onClick,
}: {
  color: string;
  icon: ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex flex-col items-center gap-2 rounded-2xl bg-card border border-border p-3 transition hover:border-primary/40 active:scale-[0.98] disabled:opacity-70"
    >
      <span className={cn("grid h-12 w-12 place-items-center rounded-2xl text-foreground bg-gradient-to-br", color)}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="[&_svg]:h-5 [&_svg]:w-5">{icon}</span>}
      </span>
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
