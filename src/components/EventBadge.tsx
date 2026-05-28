import { cn } from "@/lib/utils";
import type { EventType } from "@/data/mock";

const styles: Record<EventType, string> = {
  "4": "bg-primary text-primary-foreground glow-primary",
  "6": "bg-accent text-accent-foreground glow-orange",
  W: "bg-destructive text-destructive-foreground",
};

const labels: Record<EventType, string> = {
  "4": "FOUR",
  "6": "SIX",
  W: "WICKET",
};

export const EventBadge = ({
  type,
  size = "md",
  className,
}: {
  type: EventType;
  size?: "sm" | "md" | "lg";
  className?: string;
}) => {
  const sz =
    size === "sm"
      ? "h-6 px-2 text-[10px]"
      : size === "lg"
        ? "h-10 px-4 text-sm"
        : "h-7 px-2.5 text-xs";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-extrabold uppercase tracking-wider",
        sz,
        styles[type],
        className,
      )}
    >
      {labels[type]}
    </span>
  );
};
