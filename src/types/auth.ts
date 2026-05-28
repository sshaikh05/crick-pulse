export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  handle?: string | null;
  bio?: string;
  location?: string;
  player_role?: string;
  followers_count?: number;
  following_count?: number;
  is_verified?: boolean;
  authProvider?: "manual" | "google";
  createdAt?: string;
  updatedAt?: string;
}
