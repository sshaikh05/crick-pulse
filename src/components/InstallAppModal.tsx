import { useEffect, useState } from "react";
import { Box, Download, PlusSquare, Share, ShieldCheck, WifiOff, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "crickpulse-install-modal-dismissed";

const isStandaloneApp = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  ("standalone" in window.navigator && Boolean(window.navigator.standalone));

const isIosBrowser = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isTouchMac = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/.test(userAgent) || isTouchMac;
};

export const InstallAppModal = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (isStandaloneApp() || sessionStorage.getItem(DISMISS_KEY) === "true") return;

    const fallback = window.setTimeout(() => setOpen(true), 900);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setOpen(true);
    };

    const handleInstalled = () => {
      setOpen(false);
      sessionStorage.setItem(DISMISS_KEY, "true");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const close = () => {
    setOpen(false);
    sessionStorage.setItem(DISMISS_KEY, "true");
  };

  const install = async () => {
    if (!installPrompt) {
      close();
      return;
    }

    setIsInstalling(true);
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setIsInstalling(false);
    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      close();
    }
  };

  if (!open) return null;

  const showIosInstructions = isIosBrowser() && !installPrompt;

  const features = showIosInstructions
    ? [
        {
          icon: Share,
          title: "Tap Share",
          description: "Use the Share button in Safari's bottom toolbar",
        },
        {
          icon: PlusSquare,
          title: "Add to Home Screen",
          description: "Choose Add to Home Screen from the share sheet",
        },
        {
          icon: Zap,
          title: "Launch CrickPulse",
          description: "Open it like a regular app from your home screen",
        },
      ]
    : [
        {
          icon: Zap,
          title: "Quick Access",
          description: "Open the app fast from your home screen",
        },
        {
          icon: WifiOff,
          title: "Works Offline",
          description: "Use the app even without an internet connection",
        },
        {
          icon: ShieldCheck,
          title: "Secure & Reliable",
          description: "Safe, fast and reliable experience",
        },
      ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 px-4 py-5 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-app-title"
    >
      <div className="relative w-full max-w-[390px] overflow-hidden rounded-2xl border border-border bg-gradient-card px-5 pb-5 pt-4 text-foreground shadow-[0_24px_80px_hsl(222_35%_3%_/_0.75)] sm:max-w-[420px] sm:px-6">
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Close install app modal"
        >
          <X className="h-6 w-6 stroke-[2.5]" />
        </button>

        <div className="mx-auto mb-2 h-[142px] w-full max-w-[260px]">
          <div className="relative mx-auto h-full w-[220px]">
            <div className="absolute left-7 top-5 h-24 w-24 rounded-full bg-primary/10" />
            <div className="absolute left-[72px] top-4 h-[118px] w-[74px] rounded-[20px] border-[4px] border-foreground/85 bg-card shadow-xl">
              <div className="absolute left-1/2 top-[-1px] h-3 w-9 -translate-x-1/2 rounded-b-lg bg-foreground/85" />
              <div className="grid grid-cols-3 gap-1.5 px-3 pt-7">
                <span className="h-5 rounded-md bg-muted shadow-inner" />
                <span className="h-5 rounded-md bg-muted shadow-inner" />
                <span className="h-5 rounded-md bg-muted shadow-inner" />
                <span className="h-5 rounded-md bg-muted shadow-inner" />
                <span className="grid h-5 place-items-center rounded-md bg-gradient-cta text-primary-foreground shadow-md">
                  <Box className="h-3.5 w-3.5" />
                </span>
                <span className="h-5 rounded-md bg-muted shadow-inner" />
                <span className="h-5 rounded-md bg-muted shadow-inner" />
                <span className="h-5 rounded-md bg-muted shadow-inner" />
                <span />
                <span className="h-5 rounded-md bg-muted shadow-inner" />
              </div>
              <span className="absolute -right-[7px] top-[50px] h-8 w-[4px] rounded-r bg-foreground/70" />
            </div>
            <div className="absolute bottom-3 right-[54px] grid h-14 w-14 place-items-center rounded-full bg-gradient-cta text-primary-foreground shadow-[0_0_34px_hsl(159_100%_50%_/_0.35)]">
              <Download className="h-8 w-8 stroke-[2.8]" />
            </div>
            <span className="absolute left-2 top-16 text-2xl font-bold text-primary/55">+</span>
            <span className="absolute left-11 top-7 h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="absolute right-8 top-6 text-2xl font-bold text-secondary">+</span>
            <span className="absolute right-3 top-20 h-1.5 w-1.5 rounded-full bg-secondary" />
            <span className="absolute bottom-8 right-7 text-2xl font-bold text-primary/55">+</span>
          </div>
        </div>

        <div className="text-center">
          <h2 id="install-app-title" className="text-3xl font-black leading-tight text-foreground">
            {showIosInstructions ? "Install on iOS" : "Install App"}
          </h2>
          <p className="mx-auto mt-2 max-w-[300px] text-sm leading-6 text-muted-foreground">
            {showIosInstructions
              ? "iOS does not allow websites to install apps with one tap. Add it from Safari's share menu."
              : "Install this app on your device for quick access and a better experience."}
          </p>
        </div>

        <div className="mt-5 divide-y divide-border/80">
          {features.map((feature) => (
            <div key={feature.title} className="flex items-center gap-3 py-3 first:pt-0">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                <feature.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-extrabold text-foreground">{feature.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{feature.description}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="xl"
            className="h-11 rounded-lg border-border bg-card text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={close}
          >
            Close
          </Button>
          <Button
            type="button"
            size="xl"
            className="h-11 rounded-lg bg-gradient-cta text-sm font-bold text-primary-foreground shadow-[0_0_26px_hsl(159_100%_50%_/_0.28)] hover:opacity-95"
            onClick={showIosInstructions ? close : install}
            disabled={isInstalling}
          >
            {showIosInstructions ? "Got it" : isInstalling ? "Installing..." : "Install"}
          </Button>
        </div>
      </div>
    </div>
  );
};
