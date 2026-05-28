import { Bell, Lock, LogOut, Moon, ShieldCheck, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const settings = [
  { icon: UserRound, title: "Account profile", hint: "Name, role and player card" },
  { icon: Bell, title: "Notifications", hint: "Match alerts and community updates" },
  { icon: Lock, title: "Privacy", hint: "Profile visibility and account safety" },
  { icon: Moon, title: "Theme", hint: "Dark sports mode enabled" },
];

export default function Settings() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/auth", { replace: true });
  };

  return (
    <div className="px-4 pt-2 pb-8 space-y-4">
      <section className="rounded-[30px] border border-white/10 bg-card/70 p-5 shadow-xl shadow-black/25">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/12 border border-primary/25 grid place-items-center text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black">CrickPulse controls</h2>
            <p className="text-sm text-muted-foreground">Manage your player experience.</p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        {settings.map(({ icon: Icon, title, hint }) => (
          <button
            key={title}
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition active:scale-[0.99]"
          >
            <span className="h-10 w-10 rounded-xl bg-background/60 grid place-items-center text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black">{title}</span>
              <span className="block truncate text-xs text-muted-foreground">{hint}</span>
            </span>
          </button>
        ))}
      </section>

      <Button variant="soft" size="lg" className="w-full border-destructive/30 bg-destructive/10 text-destructive" onClick={handleSignOut}>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}
