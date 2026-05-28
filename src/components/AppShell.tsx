import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import { ClipboardPlus, Film, Home, MessageCircle, Plus, Settings, Share2, Trophy, Upload, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/leaderboard", label: "Leaders", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User },
];

const createActions = [
  { to: "/upload", label: "Upload Match Video", description: "Post a full local match reel", icon: Upload },
  { to: "/share", label: "Upload Highlight", description: "Prepare a highlight for sharing", icon: Film },
  { to: "/upload", label: "Create Scorecard", description: "Start from a match upload", icon: ClipboardPlus },
  { to: "/share", label: "Share Reel", description: "Export a CrickPulse reel", icon: Share2 },
];

const pageHeaders: Record<string, { eyebrow: string; title: string }> = {
  "/upload": { eyebrow: "Create", title: "Upload Match" },
  "/leaderboard": { eyebrow: "Leaderboard", title: "Top Players" },
  "/profile": { eyebrow: "Player Hub", title: "Profile" },
  "/chat": { eyebrow: "Messages", title: "Chat" },
  "/settings": { eyebrow: "Account", title: "Setting" },
};

export const AppShell = () => {
  const location = useLocation();
  const pageHeader = pageHeaders[location.pathname];
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex justify-center">
      {/* Phone-frame container */}
      <div className="relative w-full max-w-[440px] min-h-screen bg-background border-x border-border/40 overflow-hidden shadow-2xl shadow-black/40">
        {pageHeader && <TopHeader header={pageHeader} pathname={location.pathname} />}

        {/* No `key={pathname}` here — remounting on every tab change wipes screen state
            (uploads in progress, scroll position, video refs). React Router swaps the
            matched <Outlet /> child automatically. */}
        <main className={cn("pb-24", pageHeader && "pt-[74px]")}>
          <Outlet />
        </main>

        <FloatingNav createOpen={createOpen} setCreateOpen={setCreateOpen} />
      </div>
    </div>
  );
};

function FloatingNav({
  createOpen,
  setCreateOpen,
}: {
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
}) {
  const leftTabs = tabs.slice(0, 2);
  const rightTabs = tabs.slice(2);

  return (
    <Drawer open={createOpen} onOpenChange={setCreateOpen}>
      <nav
        aria-label="Primary"
        className="fixed bottom-3 left-1/2 z-40 w-full max-w-[440px] -translate-x-1/2 px-5 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="relative mx-auto h-[66px] overflow-visible rounded-[30px] border border-[#1a263b] bg-[#030b18]/86 px-3 shadow-[0_14px_34px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent)]" />
          <ul className="relative grid h-full grid-cols-[1fr_1fr_70px_1fr_1fr] items-center">
            {leftTabs.map((tab) => <NavItem key={tab.to} {...tab} />)}
            <li className="relative flex justify-center">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                aria-label="Create"
                className="group absolute -top-[29px] grid h-[58px] w-[58px] place-items-center rounded-full border border-[#17f1c3] bg-[#07101f] text-foreground shadow-[0_0_0_1px_rgba(43,139,255,0.35),0_0_22px_rgba(16,215,181,0.2),0_12px_28px_rgba(0,0,0,0.48)] transition duration-300 active:scale-95"
              >
                <span className="absolute inset-[-3px] rounded-full bg-[conic-gradient(from_180deg,rgba(16,215,181,0.95),rgba(25,194,255,0.95),rgba(74,106,255,0.95),rgba(16,215,181,0.95))] opacity-90 blur-[1px]" />
                <span className="absolute inset-[2px] rounded-full bg-[#07101f]" />
                <span className="absolute inset-[8px] rounded-full bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.12),transparent_45%)]" />
                <Plus className={cn("relative h-6 w-6 transition duration-300", createOpen && "rotate-45")} strokeWidth={2.25} />
              </button>
            </li>
            {rightTabs.map((tab) => <NavItem key={tab.to} {...tab} />)}
          </ul>
        </div>
      </nav>

      <DrawerContent className="mx-auto max-w-[440px] rounded-t-[30px] border-white/10 bg-card/95 px-4 pb-6 backdrop-blur-2xl">
        <DrawerHeader className="px-0 text-left">
          <DrawerTitle className="text-xl font-black">Create</DrawerTitle>
          <DrawerDescription>Start a new cricket moment.</DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-2">
          {createActions.map(({ to, label, description, icon: Icon }) => (
            <DrawerClose key={label} asChild>
              <Link
                to={to}
                className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 p-3 transition hover:border-primary/35 active:scale-[0.99]"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/12 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black">{label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{description}</span>
                </span>
              </Link>
            </DrawerClose>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <li className="flex min-w-0 justify-center">
      <NavLink
        to={to}
        end={to === "/"}
        className={({ isActive }) =>
          cn(
            "group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[9px] font-semibold transition duration-300 active:scale-95",
            isActive ? "text-[#14f5bf]" : "text-[#a5aec0] hover:text-foreground",
          )
        }
      >
        {({ isActive }) => (
          <>
            <span className={cn(
              "grid h-6 w-6 place-items-center rounded-full transition duration-300",
              isActive && "text-[#14f5bf]",
            )}>
              <Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.45 : 2} />
            </span>
            <span className={cn("truncate leading-none", isActive ? "text-[#14f5bf]" : "text-[#a5aec0]")}>{label}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}

function TopHeader({ header, pathname }: { header: { eyebrow: string; title: string }; pathname: string }) {
  return (
    <header className="absolute inset-x-0 top-0 z-40 px-3 pt-3">
      <div className="flex h-14 items-center justify-between rounded-[24px] border border-white/10 bg-background/70 px-3 shadow-2xl shadow-black/35 backdrop-blur-2xl">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="CrickPulse"
            className="h-8 w-8 rounded-xl border border-primary/30 object-cover shadow-[0_0_18px_hsl(var(--primary)/0.28)]"
          />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{header.eyebrow}</p>
            <h1 className="text-sm font-black leading-tight">{header.title}</h1>
          </div>
        </div>
        {pathname === "/profile" ? (
          <Link
            to="/settings"
            aria-label="Open settings"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/6 text-muted-foreground transition hover:border-primary/30 hover:text-primary active:scale-95"
          >
            <Settings className="h-[18px] w-[18px]" />
          </Link>
        ) : (
          <div className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary">
            CrickPulse
          </div>
        )}
      </div>
    </header>
  );
}
