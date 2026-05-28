import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Link2,
  Mail,
  MessageCircle,
  Send,
  Twitter,
  Facebook,
  Copy,
  QrCode,
  Bookmark,
  Flag,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title: string;
  subtitle?: string;
  preview?: React.ReactNode;
}

interface AppTile {
  key: string;
  label: string;
  icon: React.ReactNode;
  bg: string;
  fg: string;
  href?: (u: string, t: string) => string;
  action?: () => void;
}

export function ShareSheet({ open, onOpenChange, url, title, subtitle, preview }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: subtitle, url });
        onOpenChange(false);
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  };

  const apps: AppTile[] = [
    {
      key: "copy",
      label: copied ? "Copied" : "Copy Link",
      icon: copied ? <Check className="h-6 w-6" /> : <Link2 className="h-6 w-6" />,
      bg: "bg-primary/15 border-primary/40",
      fg: "text-primary",
      action: copy,
    },
    {
      key: "wa",
      label: "WhatsApp",
      icon: <MessageCircle className="h-6 w-6" />,
      bg: "bg-[#25D366]/15 border-[#25D366]/40",
      fg: "text-[#25D366]",
      href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}`,
    },
    {
      key: "tg",
      label: "Telegram",
      icon: <Send className="h-6 w-6" />,
      bg: "bg-[#229ED9]/15 border-[#229ED9]/40",
      fg: "text-[#229ED9]",
      href: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
    },
    {
      key: "x",
      label: "X / Twitter",
      icon: <Twitter className="h-6 w-6" />,
      bg: "bg-foreground/10 border-foreground/30",
      fg: "text-foreground",
      href: (u, t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}`,
    },
    {
      key: "fb",
      label: "Facebook",
      icon: <Facebook className="h-6 w-6" />,
      bg: "bg-[#1877F2]/15 border-[#1877F2]/40",
      fg: "text-[#1877F2]",
      href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
    },
    {
      key: "mail",
      label: "Email",
      icon: <Mail className="h-6 w-6" />,
      bg: "bg-secondary/15 border-secondary/40",
      fg: "text-secondary",
      href: (u, t) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(u)}`,
    },
  ];

  const actions = [
    { key: "copy2", label: "Copy Link", icon: <Copy className="h-4 w-4" />, onClick: copy },
    { key: "qr", label: "Show QR Code", icon: <QrCode className="h-4 w-4" />, onClick: () => toast.info("QR coming soon") },
    { key: "save", label: "Save Link", icon: <Bookmark className="h-4 w-4" />, onClick: () => toast.success("Saved") },
    { key: "report", label: "Report", icon: <Flag className="h-4 w-4" />, onClick: () => toast("Reported"), danger: true },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="p-0 border-0 bg-transparent shadow-none max-h-[90vh] overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-[440px] px-3 pb-4 space-y-2">
          {/* Preview card */}
          <div className="rounded-3xl bg-card/95 backdrop-blur-xl border border-border p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-cta grid place-items-center text-primary-foreground font-black shrink-0">
              {title[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{title}</p>
              <p className="text-xs text-muted-foreground truncate">{subtitle ?? url}</p>
            </div>
            <button
              onClick={nativeShare}
              className="text-xs font-bold text-primary px-2 py-1 rounded-full"
            >
              Share
            </button>
          </div>

          {preview}

          {/* App row */}
          <div className="rounded-3xl bg-card/95 backdrop-blur-xl border border-border p-4">
            <div className="grid grid-cols-4 gap-3">
              {apps.map((a) => {
                const tile = (
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        "h-14 w-14 rounded-2xl border grid place-items-center transition-transform active:scale-95",
                        a.bg,
                        a.fg,
                      )}
                    >
                      {a.icon}
                    </div>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      {a.label}
                    </span>
                  </div>
                );
                return a.href ? (
                  <a
                    key={a.key}
                    href={a.href(url, title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onOpenChange(false)}
                  >
                    {tile}
                  </a>
                ) : (
                  <button key={a.key} onClick={a.action} type="button">
                    {tile}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action list */}
          <div className="rounded-3xl bg-card/95 backdrop-blur-xl border border-border overflow-hidden">
            {actions.map((a, i) => (
              <button
                key={a.key}
                onClick={a.onClick}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted/40",
                  i !== actions.length - 1 && "border-b border-border/60",
                  a.danger ? "text-destructive" : "text-foreground",
                )}
              >
                <span className="font-semibold text-[15px]">{a.label}</span>
                <span className={cn(a.danger ? "text-destructive" : "text-muted-foreground")}>
                  {a.icon}
                </span>
              </button>
            ))}
          </div>

          {/* Cancel */}
          <button
            onClick={() => onOpenChange(false)}
            className="w-full rounded-3xl bg-card/95 backdrop-blur-xl border border-border py-3.5 font-bold text-primary"
          >
            Cancel
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
