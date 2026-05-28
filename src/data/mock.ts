import clip1 from "@/assets/clip-1.jpg";
import clip2 from "@/assets/clip-2.jpg";
import clip3 from "@/assets/clip-3.jpg";
import avatar from "@/assets/player-avatar.jpg";

export type EventType = "4" | "6" | "W";

export interface Clip {
  id: string;
  thumb: string;
  player: string;
  team: string;
  caption: string;
  event: EventType;
  likes: number;
  shares: number;
  avatar: string;
}

export const clips: Clip[] = [
  {
    id: "1",
    thumb: clip2,
    player: "Shahnawaz",
    team: "Lions XI",
    caption: "🔥 45 runs in 12 balls",
    event: "6",
    likes: 12_400,
    shares: 820,
    avatar,
  },
  {
    id: "2",
    thumb: clip3,
    player: "Arjun K.",
    team: "Royal Strikers",
    caption: "💀 Stumps cartwheeling — clean bowled!",
    event: "W",
    likes: 8_900,
    shares: 410,
    avatar,
  },
  {
    id: "3",
    thumb: clip1,
    player: "Imran A.",
    team: "Night Hawks",
    caption: "⚡ Yorker on the money — 5 wickets!",
    event: "W",
    likes: 6_700,
    shares: 290,
    avatar,
  },
];

export const timelineMarkers = [
  { time: 8, type: "4" as EventType, player: "Shahnawaz" },
  { time: 22, type: "6" as EventType, player: "Shahnawaz" },
  { time: 38, type: "6" as EventType, player: "Shahnawaz" },
  { time: 54, type: "W" as EventType, player: "Arjun K." },
  { time: 71, type: "4" as EventType, player: "Imran A." },
  { time: 88, type: "6" as EventType, player: "Shahnawaz" },
];
