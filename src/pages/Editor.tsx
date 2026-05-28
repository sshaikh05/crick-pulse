import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Play, Trash2, User as UserIcon, Wand2, Share2, Copy, Check, Lock, Plus, Pause, Scissors } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EventBadge } from "@/components/EventBadge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { timelineMarkers, type EventType } from "@/data/mock";
import clip2 from "@/assets/clip-2.jpg";
import { useAuth } from "@/hooks/useAuth";

interface MatchRow {
  id: string;
  match_name: string;
  team_a: string | null;
  team_b: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  owner_id: string;
  status: string;
}

interface Marker {
  type: EventType;
  player: string;
  /** Position on timeline as % (0-100) — also used as time when no real video */
  time: number;
}

const fmtTime = (sec: number) => {
  if (!Number.isFinite(sec)) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export default function Editor() {
  const [params] = useSearchParams();
  const matchId = params.get("match");
  const navigate = useNavigate();
  const { user } = useAuth();

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [loading, setLoading] = useState(!!matchId);
  const [markers, setMarkers] = useState<Marker[]>(timelineMarkers as Marker[]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Video / scrubbing state
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [trim, setTrim] = useState<{ start: number; end: number }>({ start: 0, end: 100 }); // %

  // Drag state
  const dragRef = useRef<{ kind: "marker" | "trim-start" | "trim-end" | null; idx?: number }>({
    kind: null,
  });

  useEffect(() => {
    if (!matchId) { setLoading(false); return; }
    // Backend migration: match editor API will replace the old Supabase read.
    setMatch(null);
    setLoading(false);
  }, [matchId]);

  const isOwner = !!user && !!match && user.id === match.owner_id;
  const canEdit = isOwner || !matchId;

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !matchId) return "";
    return `${window.location.origin}/editor?match=${matchId}`;
  }, [matchId]);

  const copyShare = async () => {
    if (!shareUrl) return toast.error("Save the match first");
    try {
      if (navigator.share) {
        await navigator.share({ title: match?.match_name || "Match highlights", url: shareUrl });
        return;
      }
    } catch { /* fall through */ }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Editor link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const colorFor = (t: EventType) =>
    t === "4" ? "bg-primary" : t === "6" ? "bg-accent" : "bg-destructive";

  const update = (idx: number, patch: Partial<Marker>) => {
    setMarkers((m) => m.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };

  const remove = (idx: number) => {
    setMarkers((m) => m.filter((_, i) => i !== idx));
    setActiveIdx(null);
  };

  const addMarkerAtCurrent = () => {
    if (!canEdit) return;
    const pct = duration > 0 ? (currentTime / duration) * 100 : 50;
    setMarkers((m) => [...m, { type: "4", player: "Unknown", time: Math.max(0, Math.min(100, pct)) }]);
    setActiveIdx(markers.length);
    toast.success("Marker added — tap to edit");
  };

  // ---- Pointer drag for trim handles + markers ----
  const pctFromEvent = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current.kind) return;
      const pct = pctFromEvent(e.clientX);
      if (dragRef.current.kind === "marker" && dragRef.current.idx != null) {
        update(dragRef.current.idx, { time: pct });
        if (duration > 0 && videoRef.current) videoRef.current.currentTime = (pct / 100) * duration;
      } else if (dragRef.current.kind === "trim-start") {
        setTrim((t) => ({ start: Math.min(pct, t.end - 2), end: t.end }));
      } else if (dragRef.current.kind === "trim-end") {
        setTrim((t) => ({ start: t.start, end: Math.max(pct, t.start + 2) }));
      }
    };
    const onUp = () => { dragRef.current = { kind: null }; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [duration]);

  // ---- Video lifecycle ----
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => setDuration(v.duration || 0);
    const onTime = () => {
      setCurrentTime(v.currentTime);
      // Snap back when leaving trim region
      if (duration > 0) {
        const startSec = (trim.start / 100) * duration;
        const endSec = (trim.end / 100) * duration;
        if (v.currentTime > endSec) { v.currentTime = startSec; }
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [duration, trim.start, trim.end, match?.video_url]);

  const seekTo = (pct: number) => {
    const v = videoRef.current;
    if (!v || duration <= 0) return;
    v.currentTime = (pct / 100) * duration;
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  const playFromMarker = (idx: number) => {
    const m = markers[idx];
    if (!m) return;
    seekTo(m.time);
    videoRef.current?.play();
  };

  if (loading) {
    return <div className="px-4 pt-10 text-center text-muted-foreground">Loading match…</div>;
  }
  if (matchId && !match) {
    return (
      <div className="px-4 pt-10 text-center space-y-3">
        <p className="font-bold">Match not found</p>
        <Link to="/" className="text-primary text-sm">Back to feed</Link>
      </div>
    );
  }

  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="px-4 pt-6 space-y-5">
      <header className="flex items-center justify-between">
        <Link to="/" className="h-10 w-10 rounded-full bg-card border border-border grid place-items-center">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-bold truncate max-w-[55%]">{match?.match_name || "Highlight Editor"}</h1>
        <button
          onClick={copyShare}
          aria-label="Share editor link"
          disabled={!matchId}
          className="h-10 w-10 rounded-full bg-card border border-border grid place-items-center disabled:opacity-40"
        >
          {copied ? <Check className="h-5 w-5 text-primary" /> : <Share2 className="h-5 w-5" />}
        </button>
      </header>

      {matchId && (
        <button
          onClick={copyShare}
          className="w-full flex items-center gap-2 rounded-2xl bg-card border border-border px-4 py-3 text-left hover:border-primary/60 transition-colors"
        >
          <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate flex-1">{shareUrl}</span>
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider">{copied ? "Copied" : "Share"}</span>
        </button>
      )}

      {!canEdit && (
        <div className="flex items-center gap-2 rounded-2xl bg-muted/60 border border-border px-4 py-2.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          <span>Read-only view — only the owner can edit highlights.</span>
        </div>
      )}

      {/* Video player */}
      <div className="relative rounded-3xl overflow-hidden aspect-video bg-card border border-border">
        {match?.video_url ? (
          <>
            <video
              ref={videoRef}
              src={match.video_url}
              poster={match.thumbnail_url || undefined}
              className="absolute inset-0 h-full w-full object-cover"
              playsInline
            />
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="absolute bottom-3 left-3 h-10 w-10 rounded-full bg-foreground/95 text-background grid place-items-center"
            >
              {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
            </button>
            <span className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-background/70 backdrop-blur text-[11px] font-mono">
              {fmtTime(currentTime)} / {fmtTime(duration)}
            </span>
          </>
        ) : (
          <>
            <img src={match?.thumbnail_url || clip2} alt="Match preview" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-background/30" />
            <button className="absolute inset-0 grid place-items-center">
              <span className="h-16 w-16 rounded-full bg-foreground/95 text-background grid place-items-center glow-primary">
                <Play className="h-7 w-7 fill-current ml-0.5" />
              </span>
            </button>
          </>
        )}
      </div>

      {/* Timeline + scrub + trim handles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Scissors className="h-4 w-4 text-primary" /> Timeline
          </p>
          <p className="text-xs text-muted-foreground">{markers.length} events</p>
        </div>

        <div
          ref={trackRef}
          className="relative h-20 rounded-2xl bg-card border border-border touch-none select-none"
          onClick={(e) => {
            // Click on empty area = seek to that position.
            if (!canEdit && !match?.video_url) return;
            const target = e.target as HTMLElement;
            if (target.dataset.handle || target.dataset.marker) return;
            const pct = pctFromEvent(e.clientX);
            seekTo(pct);
          }}
        >
          {/* Trim region */}
          <div
            className="absolute top-0 bottom-0 bg-primary/10 border-x-2 border-primary/60"
            style={{ left: `${trim.start}%`, right: `${100 - trim.end}%` }}
          />
          {/* Greyed out outside-trim regions (visual) */}
          <div className="absolute top-0 bottom-0 left-0 bg-background/60" style={{ width: `${trim.start}%` }} />
          <div className="absolute top-0 bottom-0 right-0 bg-background/60" style={{ width: `${100 - trim.end}%` }} />

          {/* Track line */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-muted" />

          {/* Playhead */}
          {duration > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary-foreground shadow-[0_0_8px_hsl(var(--primary))] pointer-events-none"
              style={{ left: `${playheadPct}%` }}
            />
          )}

          {/* Trim handles */}
          {canEdit && (
            <>
              <button
                data-handle="start"
                aria-label="Trim start"
                onPointerDown={(e) => { e.preventDefault(); dragRef.current = { kind: "trim-start" }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
                className="absolute top-0 bottom-0 w-3 -ml-1.5 bg-primary rounded-l-md cursor-ew-resize touch-none"
                style={{ left: `${trim.start}%` }}
              />
              <button
                data-handle="end"
                aria-label="Trim end"
                onPointerDown={(e) => { e.preventDefault(); dragRef.current = { kind: "trim-end" }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
                className="absolute top-0 bottom-0 w-3 -mr-1.5 bg-primary rounded-r-md cursor-ew-resize touch-none"
                style={{ left: `${trim.end}%` }}
              />
            </>
          )}

          {/* Markers */}
          {markers.map((m, i) => (
            <button
              key={i}
              data-marker
              onPointerDown={(e) => {
                if (!canEdit) return;
                e.stopPropagation();
                dragRef.current = { kind: "marker", idx: i };
                (e.target as Element).setPointerCapture?.(e.pointerId);
              }}
              onClick={(e) => { e.stopPropagation(); setActiveIdx(i); playFromMarker(i); }}
              disabled={!canEdit && !match?.video_url}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group touch-none"
              style={{ left: `${m.time}%` }}
            >
              <span className={`block h-7 w-7 rounded-full ${colorFor(m.type)} text-background font-extrabold text-xs grid place-items-center border-2 border-background shadow-lg group-hover:scale-110 transition pointer-events-none`}>
                {m.type}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>Trim: {fmtTime((trim.start / 100) * duration)} → {fmtTime((trim.end / 100) * duration)}</span>
          <span>{((trim.end - trim.start) / 100 * duration).toFixed(1)}s clip</span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Legend color="bg-primary" label="Four" />
          <Legend color="bg-accent" label="Six" />
          <Legend color="bg-destructive" label="Wicket" />
          {canEdit && (
            <button onClick={addMarkerAtCurrent} className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-primary">
              <Plus className="h-3.5 w-3.5" /> Add marker
            </button>
          )}
        </div>
      </div>

      {/* Event list */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Detected events</p>
        <div className="space-y-2">
          {markers.map((m, i) => (
            <button
              key={i}
              onClick={() => { setActiveIdx(i); playFromMarker(i); }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border hover:border-primary/40 transition text-left"
            >
              <EventBadge type={m.type} size="sm" />
              <div className="flex-1">
                <p className="text-sm font-semibold leading-tight">{m.player}</p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  at {fmtTime((m.time / 100) * (duration || 60))}
                </p>
              </div>
              {canEdit && <span className="text-xs text-muted-foreground">Edit</span>}
            </button>
          ))}
        </div>
      </div>

      {canEdit && (
        <Button variant="hero" size="xl" className="w-full" onClick={() => navigate(matchId ? `/share?match=${matchId}` : "/share")}>
          <Wand2 className="h-5 w-5" />
          Generate Highlights
        </Button>
      )}

      <Sheet open={activeIdx !== null} onOpenChange={(o) => !o && setActiveIdx(null)}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl">
          {activeIdx !== null && markers[activeIdx] && (
            <div className="space-y-5 pb-4">
              <SheetHeader>
                <SheetTitle>Edit event · {fmtTime((markers[activeIdx].time / 100) * (duration || 60))}</SheetTitle>
              </SheetHeader>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["4", "6", "W"] as EventType[]).map((t) => {
                    const active = markers[activeIdx].type === t;
                    return (
                      <button
                        key={t}
                        onClick={() => update(activeIdx, { type: t })}
                        disabled={!canEdit}
                        className={`h-12 rounded-2xl font-extrabold transition ${
                          active ? `${colorFor(t)} text-background` : "bg-muted text-foreground"
                        }`}
                      >
                        {t === "W" ? "WICKET" : t === "6" ? "SIX" : "FOUR"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scrub for fine-tuning */}
              {canEdit && duration > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Fine-tune position</p>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={markers[activeIdx].time}
                    onChange={(e) => {
                      const pct = Number(e.target.value);
                      update(activeIdx, { time: pct });
                      seekTo(pct);
                    }}
                    className="w-full accent-primary"
                  />
                  <p className="text-[11px] text-muted-foreground font-mono text-center">
                    {fmtTime((markers[activeIdx].time / 100) * duration)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Player</p>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted">
                  <div className="h-10 w-10 rounded-full bg-primary/20 grid place-items-center">
                    <UserIcon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-semibold flex-1">{markers[activeIdx].player}</p>
                  <button
                    className="text-xs text-primary font-semibold disabled:opacity-40"
                    disabled={!canEdit}
                    onClick={() => {
                      const name = window.prompt("Player name", markers[activeIdx].player);
                      if (name) update(activeIdx, { player: name });
                    }}
                  >
                    Change
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="soft" onClick={() => setActiveIdx(null)}>Done</Button>
                <Button variant="destructive" onClick={() => remove(activeIdx)} disabled={!canEdit}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

const Legend = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
    <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
    {label}
  </span>
);
