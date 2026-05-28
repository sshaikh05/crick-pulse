import { useEffect, useRef, useState } from "react";
import { UploadCloud, Video, Sparkles, MapPin, Loader2, AlertTriangle, RefreshCw, CheckCircle2, FileVideo, Wand2, WifiOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { createMatch } from "@/lib/api";

type Step = 1 | 2 | 3;
type UploadPhase =
  | "idle"
  | "creating_match"
  | "uploading_video"
  | "saving_metadata"
  | "processing_highlights"
  | "complete"
  | "error";

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB hard cap
const WARN_BYTES = 100 * 1024 * 1024;     // soft warn at 100 MB
const MAX_RETRIES = 3;
const DRAFT_KEY = "crickplay:upload-draft";

interface PhaseInfo {
  label: string;
  hint: string;
  pct: number;
}

const PHASES: Record<Exclude<UploadPhase, "idle" | "error">, PhaseInfo> = {
  creating_match: { label: "Creating match…", hint: "📝 Saving match info", pct: 8 },
  uploading_video: { label: "Uploading video…", hint: "🎥 Streaming bytes to Cloud", pct: 50 },
  saving_metadata: { label: "Linking media…", hint: "🔗 Attaching video to match", pct: 80 },
  processing_highlights: { label: "Preparing editor…", hint: "✨ Highlight detection queue will run after upload", pct: 95 },
  complete: { label: "All done!", hint: "🚀 Opening editor…", pct: 100 },
};

const hasPhaseInfo = (phase: UploadPhase): phase is keyof typeof PHASES => phase in PHASES;

export const uploadPhaseLabel = (phase: UploadPhase) => (
  hasPhaseInfo(phase) ? PHASES[phase].label : "Working..."
);

export const uploadPhaseHint = (phase: UploadPhase) => (
  hasPhaseInfo(phase) ? PHASES[phase].hint : "Please wait"
);

interface DraftState {
  step: Step;
  matchName: string;
  location: string;
  teamA: string;
  teamB: string;
  matchId: string | null;
  videoPath: string | null;
}

interface FormErrors {
  matchName?: string;
  video?: string;
}

const isTransientError = (msg?: string | null) => {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes("network") || m.includes("fetch") || m.includes("timeout") || m.includes("aborted") || m.includes("offline");
};

export default function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Hydrate draft (so back button / tab switch / app re-open doesn't lose progress)
  const initialDraft: DraftState = (() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) return JSON.parse(raw) as DraftState;
    } catch { /* ignore */ }
    return { step: 1, matchName: "Sunday Showdown", location: "", teamA: "", teamB: "", matchId: null, videoPath: null };
  })();

  const [step, setStep] = useState<Step>(initialDraft.step);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorPhase, setErrorPhase] = useState<UploadPhase | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [retryCount, setRetryCount] = useState(0);
  const [matchId, setMatchId] = useState<string | null>(initialDraft.matchId);
  const [videoPath, setVideoPath] = useState<string | null>(initialDraft.videoPath);
  const [busy, setBusy] = useState(false);                // disables CTA while async work runs
  const [online, setOnline] = useState(navigator.onLine);

  // File can NOT be persisted to storage; if user returns to step 2/3 without a file
  // we drop them back to step 1 with their text fields preserved.
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [matchName, setMatchName] = useState(initialDraft.matchName);
  const [location, setLocation] = useState(initialDraft.location);
  const [teamA, setTeamA] = useState(initialDraft.teamA);
  const [teamB, setTeamB] = useState(initialDraft.teamB);
  const inputRef = useRef<HTMLInputElement>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<UploadPhase>("idle");
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Build / revoke an object URL whenever `file` changes — instant preview.
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // If draft says step 2/3 but the file is gone (after refresh), reset to step 1.
  useEffect(() => {
    if (initialDraft.step !== 1 && !file) {
      setStep(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist text + ids
  useEffect(() => {
    const draft: DraftState = { step, matchName, location, teamA, teamB, matchId, videoPath };
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
  }, [step, matchName, location, teamA, teamB, matchId, videoPath]);

  // Online / offline awareness
  useEffect(() => {
    const on = () => { setOnline(true); toast.success("Back online"); };
    const off = () => { setOnline(false); toast.error("You're offline. Upload paused — we'll retry when you're back."); };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Warn before unload while uploading
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (busy && phaseRef.current !== "complete") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [busy]);

  const handleFile = (f: File | undefined | null) => {
    // Native cancel returns undefined/null — DO NOT throw, just bail silently.
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      toast.error("That file isn't a video. Pick an MP4 or MOV.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error(`File is ${(f.size / (1024 * 1024 * 1024)).toFixed(2)} GB — max is 2 GB.`);
      return;
    }
    if (f.size > WARN_BYTES) {
      toast.message("Large file detected", {
        description: `${(f.size / (1024 * 1024)).toFixed(0)} MB — upload may take a few minutes on slow networks.`,
      });
    }
    setFile(f);
    setFormErrors((current) => ({ ...current, video: undefined }));
    setStep(2);
  };

  const setPhaseAndProgress = (p: UploadPhase, extra = 0) => {
    setPhase(p);
    if (hasPhaseInfo(p)) {
      const base = PHASES[p].pct;
      setProgress(Math.min(100, base + extra));
    }
  };

  const startTicker = (from: number, to: number) => {
    stopTicker();
    setProgress(from);
    tickerRef.current = setInterval(() => {
      setProgress((p) => (p < to ? p + 1 : p));
    }, 200);
  };

  const stopTicker = () => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  };

  const failWith = (p: UploadPhase, msg: string) => {
    stopTicker();
    setErrorPhase(p);
    setErrorMsg(msg);
    setPhase("error");
    setBusy(false);
  };

  const startUpload = async () => {
    if (busy) return;
    const nextErrors: FormErrors = {};
    if (!matchName.trim()) nextErrors.matchName = "Match name is required";
    if (!file) nextErrors.video = "Video file is required";
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;
    if (!user) { toast.error("Please sign in to upload"); return; }
    if (!online) { toast.error("You're offline — connect and try again."); return; }
    setStep(3);
    setRetryCount(0);
    setErrorMsg(null);
    setErrorPhase(null);
    setBusy(true);
    await runPipeline({ resumeFrom: "creating_match" });
  };

  const runPipeline = async (opts: { resumeFrom: UploadPhase }) => {
    try {
      setPhaseAndProgress(opts.resumeFrom === "uploading_video" ? "uploading_video" : "creating_match");
      setProgress(8);
      setPhaseAndProgress("uploading_video");

      const uploadedMatch = await createMatch(
        {
          matchName: matchName.trim(),
          location: location.trim(),
          teamA: teamA.trim(),
          teamB: teamB.trim(),
          video: file!,
        },
        (event: ProgressEvent) => {
          if (!event.total) return;
          const pct = Math.round((event.loaded / event.total) * 100);
          setProgress(10 + Math.round(pct * 0.65));
        },
      );

      setMatchId(uploadedMatch.id);
      setVideoPath(uploadedMatch.video_url);
      setPhaseAndProgress("saving_metadata", 10);

      setPhaseAndProgress("processing_highlights");
      await new Promise((r) => setTimeout(r, 350));

      setPhaseAndProgress("complete");
      setBusy(false);
      toast.success("Match uploaded!");
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setTimeout(() => navigate("/"), 600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      const failedPhase = phaseRef.current === "idle" ? "creating_match" : phaseRef.current;
      // Auto-retry transient network errors silently (up to MAX_RETRIES)
      if (isTransientError(msg) && retryCount < MAX_RETRIES) {
        setRetryCount((n) => n + 1);
        toast.message("Network hiccup — retrying…", { description: msg });
        await new Promise((r) => setTimeout(r, 1500));
        return runPipeline({ resumeFrom: failedPhase });
      }
      failWith(failedPhase, msg);
    }
  };

  const retry = async () => {
    if (busy) return;
    if (retryCount >= MAX_RETRIES) {
      toast.error("Max retries reached. Please start over.");
      return;
    }
    if (!online) { toast.error("Still offline — connect and try again."); return; }
    setRetryCount((n) => n + 1);
    setErrorMsg(null);
    setBusy(true);
    const resumeFrom = errorPhase || "creating_match";
    setErrorPhase(null);
    await runPipeline({ resumeFrom });
  };

  const startOver = () => {
    stopTicker();
    setStep(1);
    setPhase("idle");
    setProgress(0);
    setErrorMsg(null);
    setErrorPhase(null);
    setRetryCount(0);
    setMatchId(null);
    setVideoPath(null);
    setFile(null);
    setFormErrors({});
    setBusy(false);
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  };

  return (
    <div className="px-4 pt-2 space-y-6">
      {!online && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 flex items-center gap-2 text-sm text-destructive">
          <WifiOff className="h-4 w-4" /> You're offline — uploads are paused.
        </div>
      )}

      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              s <= step ? "bg-primary glow-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-5 animate-float-up">
          {/* Resume / draft banner — appears when a previous upload is in flight */}
          {(matchId || matchName !== "Sunday Showdown" || teamA || teamB || location) && (
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/20 grid place-items-center shrink-0">
                  <RefreshCw className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">
                    {videoPath ? "Resume your upload" : "Continue your draft"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {matchName}{teamA && teamB ? ` · ${teamA} vs ${teamB}` : ""}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {videoPath ? (
                  <Button
                    variant="hero"
                    size="sm"
                    onClick={() => { setStep(3); runPipeline({ resumeFrom: "saving_metadata" }); }}
                    disabled={busy || !online}
                  >
                    Resume
                  </Button>
                ) : (
                  <Button variant="hero" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
                    Pick video
                  </Button>
                )}
                <Button variant="soft" size="sm" onClick={startOver} disabled={busy}>
                  Discard
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <h2 className="text-2xl font-black">Drop your match video</h2>
            <p className="text-sm text-muted-foreground">MP4, MOV up to 2 GB.</p>
          </div>

          <label className="block aspect-[4/3] rounded-3xl border-2 border-dashed border-primary/40 bg-card/60 grid place-items-center cursor-pointer hover:border-primary transition-colors">
            <div className="text-center px-6 space-y-3">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/15 grid place-items-center glow-primary">
                <UploadCloud className="h-8 w-8 text-primary" />
              </div>
              <p className="font-semibold">Tap to choose a video</p>
              <p className="text-xs text-muted-foreground">or record one with your camera</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                // Reset so picking the same file twice still fires onChange.
                e.target.value = "";
              }}
            />
          </label>
          {formErrors.video && <p className="text-xs font-medium text-destructive px-1">{formErrors.video}</p>}

          <Button
            variant="hero"
            size="xl"
            className="w-full"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Video className="h-5 w-5" />
            Choose Video
          </Button>
        </div>
      )}

      {step === 2 && file && (
        <div className="space-y-5 animate-float-up">
          {/* Instant preview — appears the moment the file is selected. */}
          {previewUrl && (
            <div className="relative rounded-3xl overflow-hidden border border-primary/40 aspect-video bg-black glow-primary">
              <video
                src={previewUrl}
                className="absolute inset-0 h-full w-full object-cover"
                controls
                playsInline
                preload="metadata"
              />
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/70 backdrop-blur text-[10px] font-extrabold uppercase tracking-wider">
                Preview
              </span>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="absolute top-3 right-3 h-9 px-3 rounded-full bg-background/70 backdrop-blur border border-border/60 text-[11px] font-bold"
              >
                Change
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <h2 className="text-2xl font-black">Add a few details</h2>
            <p className="text-sm text-muted-foreground">
              {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          </div>

          <div className="space-y-4">
            <Field label="Match Name">
              <Input
                value={matchName}
                onChange={(e) => {
                  setMatchName(e.target.value);
                  if (formErrors.matchName) setFormErrors((current) => ({ ...current, matchName: undefined }));
                }}
                placeholder="Sunday Showdown"
                className={`h-12 rounded-2xl bg-card ${
                  formErrors.matchName
                    ? "border-destructive/70 shadow-[0_0_0_1px_hsl(var(--destructive)/0.25)]"
                    : "border-border"
                }`}
                maxLength={80}
              />
              {formErrors.matchName && <p className="text-xs font-medium text-destructive px-1">{formErrors.matchName}</p>}
            </Field>
            <Field label="Location" optional>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Mumbai Maidan" className="h-12 pl-11 rounded-2xl bg-card border-border" maxLength={80} />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Team A" optional>
                <Input value={teamA} onChange={(e) => setTeamA(e.target.value)} placeholder="Lions" className="h-12 rounded-2xl bg-card border-border" maxLength={40} />
              </Field>
              <Field label="Team B" optional>
                <Input value={teamB} onChange={(e) => setTeamB(e.target.value)} placeholder="Hawks" className="h-12 rounded-2xl bg-card border-border" maxLength={40} />
              </Field>
            </div>
          </div>

          <Button
            variant="hero"
            size="xl"
            className="w-full"
            onClick={startUpload}
            disabled={busy || !online}
          >
            {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Uploading...</> : <>Upload &amp; Continue</>}
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-float-up pt-2">
          {/* Phase timeline */}
          <PhaseTimeline phase={phase} errorPhase={errorPhase} />

          {phase !== "error" && (
            <div className="text-center space-y-3">
              <div className="mx-auto h-24 w-24 rounded-3xl bg-gradient-cta grid place-items-center animate-pulse-glow">
                {phase === "complete" ? (
                  <Sparkles className="h-12 w-12 text-primary-foreground" />
                ) : (
                  <Loader2 className="h-12 w-12 text-primary-foreground animate-spin" />
                )}
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black">
                  {uploadPhaseLabel(phase)}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {uploadPhaseHint(phase)}
                </p>
              </div>
              <div className="space-y-2">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-cta transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{progress}% • Safe to switch tabs — we'll keep going</p>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-4 rounded-3xl border border-destructive/40 bg-destructive/10 p-5">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-2xl bg-destructive/20 grid place-items-center shrink-0">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-destructive">
                    {errorPhase === "uploading_video" && "Video upload failed"}
                    {errorPhase === "creating_match" && "Couldn't create match"}
                    {errorPhase === "saving_metadata" && "Couldn't link the video"}
                    {errorPhase === "processing_highlights" && "Highlight processing failed"}
                    {!errorPhase && "Something went wrong"}
                  </h3>
                  <p className="text-sm text-foreground/80 break-words">{errorMsg}</p>
                  {retryCount > 0 && (
                    <p className="text-xs text-muted-foreground">Attempt {retryCount} of {MAX_RETRIES}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="hero" size="lg" onClick={retry} disabled={busy || retryCount >= MAX_RETRIES || !online}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Retry {errorPhase === "uploading_video" ? "upload" : "step"}
                </Button>
                <Button variant="soft" size="lg" onClick={startOver} disabled={busy}>
                  Start over
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                We resume from where it failed — no need to re-upload if the file already made it.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const Field = ({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-sm font-semibold flex items-center gap-2">
      {label}
      {optional && <span className="text-[10px] text-muted-foreground font-normal">Optional</span>}
    </span>
    {children}
  </label>
);

const TIMELINE: { key: UploadPhase; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "creating_match", label: "Match", icon: FileVideo },
  { key: "uploading_video", label: "Upload", icon: UploadCloud },
  { key: "saving_metadata", label: "Link", icon: CheckCircle2 },
  { key: "processing_highlights", label: "AI", icon: Wand2 },
];

function PhaseTimeline({ phase, errorPhase }: { phase: UploadPhase; errorPhase: UploadPhase | null }) {
  const order = TIMELINE.map((t) => t.key);
  const currentIdx = order.indexOf(phase === "complete" ? "processing_highlights" : phase);
  const errIdx = errorPhase ? order.indexOf(errorPhase) : -1;

  return (
    <div className="flex items-center justify-between gap-1">
      {TIMELINE.map((t, i) => {
        const Icon = t.icon;
        const done = phase === "complete" || (currentIdx > i && errIdx !== i);
        const active = currentIdx === i && phase !== "error";
        const failed = errIdx === i;
        return (
          <div key={t.key} className="flex-1 flex flex-col items-center gap-1.5">
            <div className={`h-9 w-9 rounded-full grid place-items-center border-2 transition-colors ${
              failed ? "bg-destructive/20 border-destructive text-destructive"
              : done ? "bg-primary/20 border-primary text-primary"
              : active ? "bg-primary border-primary text-primary-foreground animate-pulse"
              : "bg-card border-border text-muted-foreground"
            }`}>
              {failed ? <AlertTriangle className="h-4 w-4" /> : done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              failed ? "text-destructive" : active || done ? "text-foreground" : "text-muted-foreground"
            }`}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}
