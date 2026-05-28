import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

type Role = "batter" | "bowler" | "all_rounder" | "wicket_keeper";
type BatStyle = "right_handed" | "left_handed";

const roles: { id: Role; label: string; emoji: string }[] = [
  { id: "batter", label: "Batter", emoji: "🏏" },
  { id: "bowler", label: "Bowler", emoji: "🎯" },
  { id: "all_rounder", label: "All-Rounder", emoji: "⚡" },
  { id: "wicket_keeper", label: "Wicket-Keeper", emoji: "🧤" },
];

export default function ProfileSetup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [team, setTeam] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [batting, setBatting] = useState<BatStyle | "">("");
  const [bowling, setBowling] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?redirect=/profile/setup");
  }, [user, authLoading, navigate]);

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5 MB");
    setUploading(true);
    try {
      const localUrl = URL.createObjectURL(file);
      setAvatarUrl(localUrl);
      toast.success("Avatar preview ready");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const finish = async () => {
    if (!user) return;
    setSaving(true);
    // Backend migration: profile persistence will move to a MongoDB profile endpoint.
    await new Promise((resolve) => setTimeout(resolve, 250));
    setSaving(false);
    toast.success("Profile ready! 🏏");
    navigate("/profile");
  };

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[440px] px-5 pt-8 pb-12 space-y-7">
        <header className="flex items-center justify-between">
          <button
            onClick={() => (step === 1 ? navigate("/") : setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s)))}
            className="h-10 w-10 rounded-full bg-card border border-border grid place-items-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xs text-muted-foreground font-semibold">Step {step} of 4</span>
          <button onClick={() => navigate("/")} className="text-xs text-muted-foreground">
            Skip
          </button>
        </header>

        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
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
            <div>
              <h1 className="text-2xl font-black">What's your team?</h1>
              <p className="text-sm text-muted-foreground mt-1">The squad you rep on weekends.</p>
            </div>
            <Input
              placeholder="e.g. Lions XI"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="h-12 rounded-2xl bg-card border-border"
              maxLength={60}
            />
            <Button variant="hero" size="xl" className="w-full" onClick={() => setStep(2)} disabled={!team.trim()}>
              Continue <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-float-up">
            <div>
              <h1 className="text-2xl font-black">Pick your role</h1>
              <p className="text-sm text-muted-foreground mt-1">What you live for on the pitch.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={`aspect-square rounded-3xl border-2 p-4 text-left transition-all ${
                    role === r.id
                      ? "border-primary bg-primary/10 glow-primary"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="text-3xl">{r.emoji}</div>
                  <p className="mt-3 font-bold">{r.label}</p>
                </button>
              ))}
            </div>
            <Button variant="hero" size="xl" className="w-full" onClick={() => setStep(3)} disabled={!role}>
              Continue <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 animate-float-up">
            <div>
              <h1 className="text-2xl font-black">Your style</h1>
              <p className="text-sm text-muted-foreground mt-1">Helps us tag your shots.</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Batting</p>
              <div className="grid grid-cols-2 gap-3">
                {(["right_handed", "left_handed"] as BatStyle[]).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBatting(b)}
                    className={`h-14 rounded-2xl border-2 font-semibold transition-all ${
                      batting === b
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground"
                    }`}
                  >
                    {b === "right_handed" ? "Right-Handed" : "Left-Handed"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                Bowling <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
              </p>
              <Input
                placeholder="e.g. Right-arm fast"
                value={bowling}
                onChange={(e) => setBowling(e.target.value)}
                className="h-12 rounded-2xl bg-card border-border"
                maxLength={60}
              />
            </div>
            <Button variant="hero" size="xl" className="w-full" onClick={() => setStep(4)} disabled={!batting}>
              Continue <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-float-up text-center">
            <div>
              <h1 className="text-2xl font-black">Add a profile photo</h1>
              <p className="text-sm text-muted-foreground mt-1">Optional — but it's a vibe.</p>
            </div>
            <label className="mx-auto h-32 w-32 rounded-full border-2 border-dashed border-primary/40 bg-card grid place-items-center cursor-pointer overflow-hidden relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="absolute inset-0 h-full w-full object-cover" />
              ) : uploading ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              ) : (
                <Camera className="h-8 w-8 text-primary" />
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatar} disabled={uploading} />
            </label>
            <Button variant="hero" size="xl" className="w-full" onClick={finish} disabled={saving}>
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              Finish setup
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
