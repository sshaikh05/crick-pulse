import { useRef, useState } from "react";
import { Download, Share2, X, ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface PlayerCardProps {
  open: boolean;
  onClose: () => void;
  name: string;
  avatarUrl?: string | null;
  teamName?: string | null;
  role?: string;
  runs: number;
  wickets: number;
  matches: number;
  level: number;
  shareUrl?: string;
}

const fallbackAvatar =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23121826'/%3E%3Ccircle cx='40' cy='32' r='14' fill='%2300FFAB'/%3E%3Cpath d='M14 70c4-14 18-20 26-20s22 6 26 20' fill='%2300FFAB'/%3E%3C/svg%3E";

/**
 * Shareable player card. Renders to canvas for download/share so the user gets
 * a real PNG that works on social apps.
 */
export const PlayerCard = ({
  open, onClose, name, avatarUrl, teamName, role,
  runs, wickets, matches, level, shareUrl,
}: PlayerCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);

  // Compute card OVR rating – simple weighted formula from real stats.
  const overall = Math.min(99, Math.max(40, Math.round(40 + runs / 25 + wickets * 2 + matches * 1.5)));

  const stats = [
    { label: "RUN", value: Math.min(99, Math.round(40 + runs / 20)) },
    { label: "PWR", value: Math.min(99, Math.round(45 + runs / 30)) },
    { label: "BWL", value: Math.min(99, Math.round(35 + wickets * 4)) },
    { label: "FLD", value: Math.min(99, 50 + matches) },
    { label: "EXP", value: Math.min(99, 40 + matches * 3) },
    { label: "STR", value: Math.min(99, 50 + Math.round(runs / 40)) },
  ];

  // Render the React card to a PNG via SVG-foreignObject → canvas.
  // Canvas-from-DOM avoids extra deps; foreignObject preserves CSS visuals.
  const renderToBlob = async (): Promise<Blob | null> => {
    const node = cardRef.current;
    if (!node) return null;
    const w = node.offsetWidth || 360;
    const h = node.offsetHeight || 540;

    // Inline computed styles for fonts/colors so the SVG snapshot looks right.
    const xhtml = new XMLSerializer().serializeToString(node);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <foreignObject x="0" y="0" width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Inter,sans-serif;background:#0B0F1A;">
          ${xhtml}
        </div>
      </foreignObject>
    </svg>`;

    const img = new Image();
    img.crossOrigin = "anonymous";
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve) => {
      img.onload = () => {
        const scale = 2; // retina
        const canvas = document.createElement("canvas");
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(scale, scale);
        ctx.fillStyle = "#0B0F1A";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => resolve(b), "image/png");
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  };

  const downloadCard = async () => {
    setBusy("download");
    try {
      const blob = await renderToBlob();
      if (!blob) throw new Error("render failed");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${name.replace(/\s+/g, "_")}_card.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      toast.success("Card downloaded");
    } catch {
      toast.error("Couldn't render card. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const shareCard = async () => {
    setBusy("share");
    try {
      const blob = await renderToBlob();
      if (!blob) throw new Error("render failed");
      const file = new File([blob], `${name}_card.png`, { type: "image/png" });
      const text = `${name} · OVR ${overall} · ${runs} runs · ${wickets} wkts`;
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text, title: `${name} – CrickPulse`, url: shareUrl });
      } else if (navigator.share) {
        await navigator.share({ text, title: `${name} – CrickPulse`, url: shareUrl });
      } else {
        // Fallback to download.
        await downloadCard();
      }
    } catch {
      /* user cancelled */
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[410px] overflow-hidden border-white/10 bg-[#0b111d]/95 p-0 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/8 text-muted-foreground backdrop-blur transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-4 p-5">
          <DialogHeader className="pr-10 text-left">
            <DialogTitle className="text-base font-black">Player card</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Export a clean creator card for sharing.
            </DialogDescription>
          </DialogHeader>

          {/* The actual card - also exported to PNG */}
          <div
            ref={cardRef}
            className="relative mx-auto flex aspect-[3/4] w-full max-w-[340px] flex-col overflow-hidden rounded-[28px] border border-white/12 p-5"
            style={{
              background:
                "radial-gradient(circle at 50% 12%, rgba(0,255,171,0.28), transparent 30%), linear-gradient(145deg, #132235 0%, #0b1324 48%, #101827 100%)",
              boxShadow: "0 26px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)",
              color: "#fff",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.08), transparent 35%, rgba(0,255,171,0.08))",
              }}
            />
            <div className="absolute inset-x-5 top-5 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">CrickPulse</p>
                <div className="mt-2 flex items-end gap-2">
                  <p className="text-5xl font-black leading-none">{overall}</p>
                  <p className="pb-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/65">OVR</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide">
                  {role || "Player"}
                </span>
                <p className="mt-1 text-[10px] font-bold text-white/60">Level {level}</p>
              </div>
            </div>

            <div className="relative flex flex-1 items-center justify-center py-4">
              <div className="relative">
                <div
                  className="absolute inset-0 -m-4 rounded-full"
                  style={{
                    background:
                      "conic-gradient(from 20deg, rgba(0,255,171,0.9), rgba(46,147,255,0.75), rgba(255,255,255,0.38), rgba(0,255,171,0.9))",
                    filter: "blur(10px)",
                    opacity: 0.65,
                  }}
                />
                <img
                  src={avatarUrl || fallbackAvatar}
                  alt={name}
                  crossOrigin="anonymous"
                  className="relative h-32 w-32 rounded-full border-[5px] border-[#101827] object-cover ring-2 ring-white/35"
                />
              </div>
            </div>

            <div className="relative text-center">
              <h3 className="mx-auto max-w-[280px] truncate text-2xl font-black leading-tight tracking-tight uppercase">{name}</h3>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
                {teamName || "Free Agent"}
              </p>
            </div>

            <div className="relative mt-4 grid grid-cols-3 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2">
                  <p className="text-lg font-black leading-none">{s.value}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-white/55">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="relative mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[9px] font-black uppercase tracking-[0.2em] text-white/55">
              <span>Player card</span>
              <span>{runs}R / {wickets}W / {matches}M</span>
            </div>
          </div>

          <div className="action-buttons">
            <Button
              variant="soft"
              size="lg"
              disabled={busy !== null}
              onClick={downloadCard}
            >
              {busy === "download" ? <ImageDown className="h-4 w-4 animate-pulse" /> : <Download className="h-4 w-4" />}
              Download PNG
            </Button>
            <Button variant="hero" size="lg" disabled={busy !== null} onClick={shareCard}>
              <Share2 className="h-4 w-4" /> Share Card
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
