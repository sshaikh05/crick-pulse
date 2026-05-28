import axios from "axios";

const TOKEN_KEY = "crickpulse_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const rawMessage = error.response?.data?.message || error.message || "Request failed";
    const message = rawMessage === "Network Error"
      ? "Auth service is offline. Start the API server and check MongoDB access."
      : rawMessage;
    return Promise.reject(new Error(message));
  },
);

const saveAuth = (data) => {
  if (data?.token) localStorage.setItem(TOKEN_KEY, data.token);
  return data;
};

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);

export const registerUser = async ({ name, email, password }) => {
  const { data } = await api.post("/auth/register", { name, email, password });
  return saveAuth(data);
};

export const loginUser = async ({ email, password }) => {
  const { data } = await api.post("/auth/login", { email, password });
  return saveAuth(data);
};

export const googleLogin = async ({ credential, accessToken }) => {
  const { data } = await api.post("/auth/google", { credential, accessToken });
  return saveAuth(data);
};

export const getCurrentUser = async () => {
  const { data } = await api.get("/auth/me");
  return data.user;
};

export const createMatch = async ({ matchName, location, teamA, teamB, video }, onUploadProgress) => {
  const formData = new FormData();
  formData.append("match_name", matchName);
  formData.append("location", location || "");
  formData.append("team_a", teamA || "");
  formData.append("team_b", teamB || "");
  formData.append("video", video);

  const { data } = await api.post("/matches", formData, { onUploadProgress });
  return data.match;
};

export const getMatches = async () => {
  const { data } = await api.get("/matches");
  return data.matches || [];
};

export const getMatch = async (id) => {
  const { data } = await api.get(`/matches/${id}`);
  return data.match;
};

export const getLeaderboard = async ({ period = "week", type = "runs" } = {}) => {
  const { data } = await api.get("/leaderboard", { params: { period, type } });
  return data.players || [];
};

export const getProfile = async (userId) => {
  const { data } = await api.get(`/profile/${userId}`);
  return data;
};

export const getProfileMatches = async (userId) => {
  const { data } = await api.get(`/profile/${userId}/matches`);
  return data.matches || [];
};

export const getProfileHighlights = async (userId) => {
  const { data } = await api.get(`/profile/${userId}/highlights`);
  return data.highlights || [];
};

export const getProfileScorecards = async (userId) => {
  const { data } = await api.get(`/profile/${userId}/scorecards`);
  return data.scorecards || [];
};

export const updateProfile = async (payload) => {
  const { data } = await api.patch("/profile", payload);
  return data;
};

export const generateHighlight = async (payload) => {
  const { data } = await api.post("/highlights/generate", payload);
  return data.highlight;
};

export const getHighlight = async (id) => {
  const { data } = await api.get(`/highlights/${id}`);
  return data.highlight;
};

export const exportHighlight = async (payload) => {
  const { data } = await api.post("/highlights/export", payload);
  return data.export;
};

export const trackHighlightShare = async (payload) => {
  const { data } = await api.post("/highlights/share", payload);
  return data;
};

export const getComments = async ({ matchId, highlightId }) => {
  const { data } = await api.get("/comments", {
    params: {
      ...(matchId ? { matchId } : {}),
      ...(highlightId ? { highlightId } : {}),
    },
  });
  return data;
};

export const createComment = async ({ matchId, highlightId, comment }) => {
  const { data } = await api.post("/comments", {
    match_id: matchId,
    highlight_id: highlightId,
    comment,
  });
  return data.comment;
};

export const toggleCommentLike = async (id) => {
  const { data } = await api.patch(`/comments/${id}/like`);
  return data.comment;
};

export const deleteComment = async (id) => {
  const { data } = await api.delete(`/comments/${id}`);
  return data;
};

export const getConversations = async () => {
  const { data } = await api.get("/conversations");
  return data.conversations || [];
};

export const openConversation = async ({ userId }) => {
  const { data } = await api.post("/conversations", { target_user_id: userId });
  return data.conversation;
};

export const searchChatUsers = async (q = "") => {
  const { data } = await api.get("/users", { params: { q } });
  return data.users || [];
};

export const searchUsers = async (q = "") => {
  const { data } = await api.get("/users/search", { params: { q } });
  return data.users || [];
};

export const followUser = async (id) => {
  const { data } = await api.post(`/users/${id}/follow`);
  return data;
};

export const unfollowUser = async (id) => {
  const { data } = await api.delete(`/users/${id}/follow`);
  return data;
};

export const getFollowers = async (id) => {
  const { data } = await api.get(`/users/${id}/followers`);
  return data.users || [];
};

export const getFollowing = async (id) => {
  const { data } = await api.get(`/users/${id}/following`);
  return data.users || [];
};

export const getMessages = async (conversationId) => {
  const { data } = await api.get(`/messages/${conversationId}`);
  return data.messages || [];
};

export const sendMessage = async (payload) => {
  const { data } = await api.post("/messages", payload);
  return data.message;
};

export const uploadMessageMedia = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append("media", file);
  const { data } = await api.post("/messages/upload", formData, { onUploadProgress });
  return data.media;
};

export const markMessageRead = async (id) => {
  const { data } = await api.patch(`/messages/${id}/read`);
  return data;
};

export const reactToMessage = async (id, reaction = "❤️") => {
  const { data } = await api.post(`/messages/${id}/reaction`, { reaction });
  return data.message;
};

export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
};
