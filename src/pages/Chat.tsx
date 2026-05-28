import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Mic,
  Paperclip,
  Play,
  RefreshCcw,
  Search,
  Send,
  Smile,
  Trophy,
  User as UserIcon,
  Video,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  getConversations,
  getMessages,
  markMessageRead,
  openConversation,
  reactToMessage,
  searchChatUsers,
  sendMessage,
  uploadMessageMedia,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface ChatUser {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  verified: boolean;
}

interface Conversation {
  id: string;
  type: "direct" | "group";
  last_message: string;
  last_message_type: string;
  last_message_at: string;
  unread_count: number;
  online: boolean;
  typing: boolean;
  peer: ChatUser;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender: ChatUser | null;
  message_type: "text" | "image" | "video" | "audio" | "feed" | "scorecard" | "profile" | "match" | "highlight";
  text: string;
  media_url: string;
  thumbnail_url: string;
  shared_ref_type: string;
  shared_ref_id: string;
  metadata: Record<string, string>;
  status: "sent" | "delivered" | "seen" | "failed";
  reactions: Array<{ id: string; user_id: string; reaction: string; mine: boolean }>;
  created_at: string;
}

type SharedType = ChatMessage["message_type"];
type ActionPanel = "emoji" | "attach" | "camera" | "audio" | null;

const quickEmojis = ["🔥", "🏏", "💚", "👏", "💪", "😎", "🙌", "⚡", "🎯", "🏆", "😂", "❤️"];

const timeAgo = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recording, setRecording] = useState(false);
  const [actionPanel, setActionPanel] = useState<ActionPanel>(null);
  const [fileAccept, setFileAccept] = useState("image/*,video/*,audio/*");
  const [cameraAccept, setCameraAccept] = useState("image/*");
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const shareType = params.get("shareType") || "";
  const shareId = params.get("shareId") || "";
  const shareTitle = params.get("title") || "";
  const shareSubtitle = params.get("subtitle") || "";
  const shareThumb = params.get("thumb") || "";
  const activeId = active?.id;
  const hasPendingShare = Boolean(shareType && shareId);
  const pendingShare = useMemo(() => {
    if (!hasPendingShare) return null;
    return {
      type: shareType as SharedType,
      id: shareId,
      title: shareTitle || `Shared ${shareType}`,
      subtitle: shareSubtitle || "CrickPulse item",
      thumbnail: shareThumb,
    };
  }, [hasPendingShare, shareId, shareSubtitle, shareThumb, shareTitle, shareType]);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConversations();
      setConversations(data);
      setActive((current) => current || (hasPendingShare ? null : data[0] || null));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load chats");
    } finally {
      setLoading(false);
    }
  }, [hasPendingShare]);

  const loadMessages = useCallback(async (conversationId: string, showLoader = true) => {
    if (showLoader) setMessagesLoading(true);
    try {
      setMessages(await getMessages(conversationId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load messages");
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        setUsers(await searchChatUsers(query));
      } catch {
        setUsers([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!activeId) return undefined;
    loadMessages(activeId, false);
    const timer = window.setInterval(() => loadMessages(activeId, false), 3500);
    return () => window.clearInterval(timer);
  }, [activeId, loadMessages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    const last = messages[messages.length - 1];
    if (last && last.sender_id !== user?.id) markMessageRead(last.id).catch(() => {});
  }, [messages, user?.id]);

  const startConversation = async (chatUser: ChatUser) => {
    try {
      const conversation = await openConversation({ userId: chatUser.id });
      setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)]);
      setActive(conversation);
      setQuery("");
      setUsers([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open chat");
    }
  };

  const sendCurrentMessage = async (override?: Partial<ChatMessage>) => {
    if (!active) return;
    const text = override?.text ?? draft.trim();
    const overrideShare = Boolean(override?.shared_ref_type && override?.shared_ref_id);
    const sendShare = overrideShare || hasPendingShare;
    if (!text && !override?.media_url && !sendShare) return;

    setSending(true);
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: active.id,
      sender_id: user?.id || "",
      sender: user ? {
        id: user.id,
        name: user.name,
        handle: user.handle || user.name.toLowerCase().replace(/[^a-z0-9_]+/g, ""),
        avatar: user.avatar || null,
        verified: Boolean(user.is_verified),
      } : null,
      message_type: override?.message_type || (sendShare ? (override?.shared_ref_type || shareType) as ChatMessage["message_type"] : "text"),
      text,
      media_url: override?.media_url || "",
      thumbnail_url: override?.thumbnail_url || "",
      shared_ref_type: sendShare ? override?.shared_ref_type || shareType : "",
      shared_ref_id: sendShare ? override?.shared_ref_id || shareId : "",
      metadata: sendShare ? {
        title: override?.metadata?.title || pendingShare?.title || `Shared ${shareType}`,
        subtitle: override?.metadata?.subtitle || pendingShare?.subtitle || "CrickPulse item",
        thumbnail: override?.metadata?.thumbnail || pendingShare?.thumbnail || "",
      } : {},
      status: "sent",
      reactions: [],
      created_at: new Date().toISOString(),
    };
    setMessages((items) => [...items, temp]);
    setDraft("");

    try {
      const created = await sendMessage({
        conversation_id: active.id,
        message_type: temp.message_type,
        text,
        media_url: temp.media_url,
        thumbnail_url: temp.thumbnail_url,
        shared_ref_type: temp.shared_ref_type,
        shared_ref_id: temp.shared_ref_id,
        metadata: temp.metadata,
      });
      setMessages((items) => items.map((item) => item.id === temp.id ? created : item));
      await loadConversations();
      if (sendShare) {
        toast.success("Sent to chat");
        navigate("/chat", { replace: true });
      }
    } catch (err) {
      setMessages((items) => items.map((item) => item.id === temp.id ? { ...item, status: "failed" } : item));
      toast.error(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSending(false);
    }
  };

  const attachFile = async (file: File) => {
    if (!active) return;
    if (!/^(image|video|audio)\//.test(file.type)) {
      toast.error("Choose an image, video, or audio file");
      return;
    }
    if (file.size > 150 * 1024 * 1024) {
      toast.error("File must be under 150 MB");
      return;
    }
    setUploadProgress(1);
    try {
      const media = await uploadMessageMedia(file, (event) => {
        const total = event.total || file.size;
        setUploadProgress(Math.round((event.loaded / total) * 100));
      });
      await sendCurrentMessage({
        message_type: media.message_type,
        media_url: media.media_url,
        thumbnail_url: media.thumbnail_url,
        text: file.name,
      });
      setActionPanel(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      window.setTimeout(() => setUploadProgress(0), 500);
    }
  };

  const openFilePicker = (accept: string) => {
    setFileAccept(accept);
    setActionPanel(null);
    window.setTimeout(() => fileRef.current?.click(), 0);
  };

  const openCameraPicker = (accept: string) => {
    setCameraAccept(accept);
    setActionPanel(null);
    window.setTimeout(() => cameraRef.current?.click(), 0);
  };

  const addEmoji = (emoji: string) => {
    setDraft((value) => `${value}${emoji}`);
  };

  const retryMessage = async (message: ChatMessage) => {
    setMessages((items) => items.filter((item) => item.id !== message.id));
    await sendCurrentMessage({
      message_type: message.message_type,
      text: message.text,
      media_url: message.media_url,
      thumbnail_url: message.thumbnail_url,
      shared_ref_type: message.shared_ref_type,
      shared_ref_id: message.shared_ref_id,
      metadata: message.metadata,
    });
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      setActionPanel(null);
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Voice recording is not supported on this device");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await attachFile(new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" }));
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Microphone permission denied");
    }
  };

  const react = async (message: ChatMessage) => {
    if (message.id.startsWith("temp-")) return;
    try {
      const updated = await reactToMessage(message.id, "❤️");
      setMessages((items) => items.map((item) => item.id === message.id ? updated : item));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not react");
    }
  };

  const activePeer = active?.peer;
  const empty = !loading && conversations.length === 0 && !query;

  return (
    <div className="min-h-[calc(100dvh-74px)] bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.10),transparent_34%),hsl(var(--background))]">
      {!active ? (
        <ChatList
          loading={loading}
          empty={empty}
          query={query}
          setQuery={setQuery}
          conversations={conversations}
          users={users}
          onOpen={setActive}
          onUser={startConversation}
          pendingShare={pendingShare}
        />
      ) : (
        <div className="flex h-[calc(100dvh-134px)] flex-col">
          <header className="flex items-center gap-3 border-b border-white/10 bg-background/70 px-4 py-3 backdrop-blur-xl">
            <button type="button" onClick={() => setActive(null)} className="grid h-10 w-10 place-items-center rounded-full bg-white/6">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Avatar user={activePeer} size="md" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-black">{activePeer?.name || "Chat"}</h1>
              <p className="text-xs text-primary">{active.online ? "Online" : "Active recently"}</p>
            </div>
            <Link to={`/player/${activePeer?.id || ""}`} className="grid h-10 w-10 place-items-center rounded-full bg-white/6 text-muted-foreground">
              <UserIcon className="h-5 w-5" />
            </Link>
          </header>

          {pendingShare && (
            <PendingShareBanner share={pendingShare} onClear={() => navigate("/chat", { replace: true })} />
          )}

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scrollbar-hide">
            {messagesLoading && <MessageSkeleton />}
            {!messagesLoading && messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <MessageEmptyIcon />
                <p className="mt-3 text-sm font-black text-foreground">Start the innings</p>
                <p className="mt-1 max-w-[240px] text-xs">Send a message, voice note, or share a cricket moment.</p>
              </div>
            )}
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                mine={message.sender_id === user?.id}
                onReact={() => react(message)}
                onRetry={() => retryMessage(message)}
              />
            ))}
            {active.typing && <p className="px-2 text-xs text-primary">{active.peer.name} is typing...</p>}
          </div>

          {uploadProgress > 0 && (
            <div className="mx-4 mb-2 rounded-full bg-white/10">
              <div className="h-1.5 rounded-full bg-gradient-cta" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}

          <div className="border-t border-white/10 bg-background/95 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 backdrop-blur-xl">
            <ChatActionPanel
              panel={actionPanel}
              recording={recording}
              onEmoji={addEmoji}
              onAttach={openFilePicker}
              onCamera={openCameraPicker}
              onRecord={toggleRecording}
              onClose={() => setActionPanel(null)}
            />
            <input
              ref={fileRef}
              type="file"
              accept={fileAccept}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) attachFile(file);
                event.target.value = "";
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept={cameraAccept}
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) attachFile(file);
                event.target.value = "";
              }}
            />
            <div className="flex items-end gap-2 rounded-[24px] border border-white/10 bg-white/6 p-2">
              <button
                type="button"
                onClick={() => setActionPanel((panel) => panel === "emoji" ? null : "emoji")}
                className={cn("grid h-10 w-10 place-items-center rounded-full text-muted-foreground", actionPanel === "emoji" && "bg-primary/15 text-primary")}
                aria-label="Open emojis"
              >
                <Smile className="h-5 w-5" />
              </button>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={1}
                placeholder="Message..."
                className="max-h-28 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setActionPanel((panel) => panel === "attach" ? null : "attach")}
                className={cn("grid h-10 w-10 place-items-center rounded-full text-muted-foreground", actionPanel === "attach" && "bg-primary/15 text-primary")}
                aria-label="Open attachments"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setActionPanel((panel) => panel === "camera" ? null : "camera")}
                className={cn("grid h-10 w-10 place-items-center rounded-full text-muted-foreground", actionPanel === "camera" && "bg-primary/15 text-primary")}
                aria-label="Open camera"
              >
                <Camera className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setActionPanel((panel) => panel === "audio" ? null : "audio")}
                className={cn("grid h-10 w-10 place-items-center rounded-full", recording ? "bg-destructive text-destructive-foreground" : actionPanel === "audio" ? "bg-primary/15 text-primary" : "text-muted-foreground")}
                aria-label="Record audio"
              >
                <Mic className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => sendCurrentMessage()}
                disabled={sending || (!draft.trim() && !hasPendingShare)}
                className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground disabled:bg-white/10 disabled:text-muted-foreground"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatActionPanel({
  panel,
  recording,
  onEmoji,
  onAttach,
  onCamera,
  onRecord,
  onClose,
}: {
  panel: ActionPanel;
  recording: boolean;
  onEmoji: (emoji: string) => void;
  onAttach: (accept: string) => void;
  onCamera: (accept: string) => void;
  onRecord: () => void;
  onClose: () => void;
}) {
  if (!panel) return null;

  return (
    <div className="mb-3 rounded-[24px] border border-white/10 bg-card/95 p-3 shadow-2xl shadow-black/30">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
          {panel === "emoji" ? "Emojis" : panel === "attach" ? "Attachment" : panel === "camera" ? "Camera" : "Voice note"}
        </p>
        <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/6 text-muted-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {panel === "emoji" && (
        <div className="grid grid-cols-6 gap-2">
          {quickEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onEmoji(emoji)}
              className="grid h-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-xl transition active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {panel === "attach" && (
        <div className="grid grid-cols-3 gap-2">
          <PanelButton icon={ImageIcon} label="Photo" onClick={() => onAttach("image/*")} />
          <PanelButton icon={Video} label="Video" onClick={() => onAttach("video/*")} />
          <PanelButton icon={Volume2} label="Audio" onClick={() => onAttach("audio/*")} />
          <PanelButton icon={Paperclip} label="Any media" onClick={() => onAttach("image/*,video/*,audio/*")} wide />
        </div>
      )}

      {panel === "camera" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <PanelButton icon={Camera} label="Take photo" onClick={() => onCamera("image/*")} />
            <PanelButton icon={Video} label="Record video" onClick={() => onCamera("video/*")} />
          </div>
          <p className="text-xs text-muted-foreground">On desktop this opens the file picker. On mobile it opens the camera when the browser supports it.</p>
        </div>
      )}

      {panel === "audio" && (
        <div className="rounded-2xl border border-white/10 bg-background/50 p-3">
          <div className="flex items-center gap-3">
            <span className={cn("grid h-12 w-12 place-items-center rounded-full", recording ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-primary/12 text-primary")}>
              <Mic className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">{recording ? "Recording voice note..." : "Record a voice note"}</p>
              <p className="text-xs text-muted-foreground">{recording ? "Tap stop to upload and send automatically." : "Uses your microphone permission."}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRecord}
            className={cn(
              "mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black transition active:scale-[0.98]",
              recording ? "bg-destructive text-destructive-foreground" : "bg-gradient-cta text-primary-foreground",
            )}
          >
            {recording ? "Stop and send" : "Start recording"}
          </button>
        </div>
      )}
    </div>
  );
}

function PanelButton({
  icon: Icon,
  label,
  onClick,
  wide,
}: {
  icon: typeof Camera;
  label: string;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-xs font-black text-foreground transition hover:border-primary/30 active:scale-[0.98]",
        wide && "col-span-3 h-12 flex-row",
      )}
    >
      <Icon className="h-5 w-5 text-primary" />
      {label}
    </button>
  );
}

function ChatList({
  loading,
  empty,
  query,
  setQuery,
  conversations,
  users,
  onOpen,
  onUser,
  pendingShare,
}: {
  loading: boolean;
  empty: boolean;
  query: string;
  setQuery: (value: string) => void;
  conversations: Conversation[];
  users: ChatUser[];
  onOpen: (conversation: Conversation) => void;
  onUser: (user: ChatUser) => void;
  pendingShare: { type: SharedType; id: string; title: string; subtitle: string; thumbnail: string } | null;
}) {
  return (
    <div className="space-y-4 px-4 pb-24 pt-4">
      {pendingShare && (
        <div className="rounded-[26px] border border-primary/25 bg-primary/10 p-4 shadow-xl shadow-primary/10">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Send to chat</p>
          <div className="mt-3 flex items-center gap-3">
            <SharePreviewIcon type={pendingShare.type} thumbnail={pendingShare.thumbnail} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-black">{pendingShare.title}</h2>
              <p className="truncate text-xs text-muted-foreground">{pendingShare.subtitle}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Choose a recent chat or search a player to send this cricket item.</p>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-card/70 px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search players..."
          className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && <button type="button" onClick={() => setQuery("")}><X className="h-4 w-4" /></button>}
      </div>

      {query && (
        <section className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Players</p>
          {users.length === 0 ? <EmptyLine text="No players found" /> : users.map((chatUser) => (
            <UserRow key={chatUser.id} user={chatUser} onClick={() => onUser(chatUser)} />
          ))}
        </section>
      )}

      {!query && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">Messages</h2>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary">Polling live</span>
          </div>
          {loading && <MessageSkeleton />}
          {empty && (
            <div className="rounded-[28px] border border-dashed border-white/15 bg-card/50 p-6 text-center">
              <MessageEmptyIcon />
              <h3 className="mt-3 text-base font-black">No chats yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Search a player and start talking cricket.</p>
            </div>
          )}
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onOpen(conversation)}
              className="flex w-full items-center gap-3 rounded-[24px] border border-white/10 bg-card/70 p-3 text-left transition hover:border-primary/30"
            >
              <Avatar user={conversation.peer} size="lg" online={conversation.online} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-black">{conversation.peer.name}</p>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(conversation.last_message_at)}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{conversation.typing ? "Typing..." : conversation.last_message || "Start chatting"}</p>
              </div>
              {conversation.unread_count > 0 && (
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-black text-primary-foreground">
                  {conversation.unread_count}
                </span>
              )}
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

function UserRow({ user, onClick }: { user: ChatUser; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-card/65 p-3 text-left">
      <Avatar user={user} size="md" />
      <div className="min-w-0">
        <p className="truncate text-sm font-black">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">@{user.handle}</p>
      </div>
    </button>
  );
}

function PendingShareBanner({
  share,
  onClear,
}: {
  share: { type: SharedType; title: string; subtitle: string; thumbnail: string };
  onClear: () => void;
}) {
  return (
    <div className="border-b border-primary/15 bg-primary/8 px-4 py-3">
      <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-background/50 p-2.5">
        <SharePreviewIcon type={share.type} thumbnail={share.thumbnail} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black text-primary">Ready to send</p>
          <p className="truncate text-sm font-black">{share.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">{share.subtitle}</p>
        </div>
        <button type="button" onClick={onClear} className="grid h-8 w-8 place-items-center rounded-full bg-white/6 text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  onReact,
  onRetry,
}: {
  message: ChatMessage;
  mine: boolean;
  onReact: () => void;
  onRetry: () => void;
}) {
  const reactionCount = message.reactions.length;
  return (
    <div className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && <Avatar user={message.sender} size="sm" />}
      <div className={cn("max-w-[76%]", mine && "items-end")}>
        <button
          type="button"
          onDoubleClick={onReact}
          className={cn(
            "overflow-hidden rounded-[22px] border px-3 py-2 text-left shadow-lg shadow-black/10",
            mine
              ? "rounded-br-md border-primary/20 bg-primary text-primary-foreground"
              : "rounded-bl-md border-white/10 bg-card/80 text-foreground",
          )}
        >
          <MessageContent message={message} mine={mine} />
        </button>
        <div className={cn("mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground", mine ? "justify-end" : "justify-start")}>
          {reactionCount > 0 && <span>❤️ {reactionCount}</span>}
          <span>{timeAgo(message.created_at)}</span>
          {mine && (message.status === "seen" ? <CheckCheck className="h-3.5 w-3.5 text-secondary" /> : <Check className="h-3.5 w-3.5" />)}
          {message.status === "failed" && (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-destructive">
              <RefreshCcw className="h-3 w-3" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageContent({ message, mine }: { message: ChatMessage; mine: boolean }) {
  if (message.message_type === "image") {
    return (
      <div className="space-y-2">
        <img src={message.media_url} alt={message.text || "Shared image"} className="max-h-64 rounded-2xl object-cover" />
        {message.text && <p className="text-sm">{message.text}</p>}
      </div>
    );
  }
  if (message.message_type === "video") {
    return (
      <div className="space-y-2">
        <video src={message.media_url} poster={message.thumbnail_url || undefined} controls playsInline className="max-h-64 rounded-2xl" />
        {message.text && <p className="text-sm">{message.text}</p>}
      </div>
    );
  }
  if (message.message_type === "audio") {
    return (
      <div className="flex min-w-[210px] items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-background/20">
          <Volume2 className="h-5 w-5" />
        </span>
        <audio src={message.media_url} controls className="max-w-[170px]" />
      </div>
    );
  }
  if (message.shared_ref_type) {
    return (
      <div className={cn("min-w-[230px] rounded-2xl border p-3", mine ? "border-background/20 bg-background/10" : "border-white/10 bg-white/5")}>
        <div className="flex items-center gap-2">
          <SharePreviewIcon type={message.shared_ref_type as SharedType} thumbnail={message.metadata?.thumbnail || message.thumbnail_url} />
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{message.metadata?.title || `Shared ${message.shared_ref_type}`}</p>
            <p className="truncate text-xs opacity-75">{message.metadata?.subtitle || "CrickPulse share"}</p>
          </div>
        </div>
        {message.text && <p className="mt-2 text-sm">{message.text}</p>}
      </div>
    );
  }
  return <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.text}</p>;
}

function SharePreviewIcon({ type, thumbnail }: { type: SharedType | string; thumbnail?: string }) {
  if (thumbnail) {
    return (
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-background/20">
        <img src={thumbnail} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 grid place-items-center bg-background/20">
          {type === "scorecard" ? <Trophy className="h-4 w-4" /> : type === "profile" ? <UserIcon className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
        </span>
      </span>
    );
  }

  const Icon = type === "scorecard"
    ? Trophy
    : type === "profile"
      ? UserIcon
      : type === "image"
        ? ImageIcon
        : type === "video" || type === "highlight" || type === "match" || type === "feed"
          ? Video
          : MessageCircle;

  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
      <Icon className="h-5 w-5" />
    </span>
  );
}

function Avatar({ user, size, online }: { user: ChatUser | null | undefined; size: "sm" | "md" | "lg"; online?: boolean }) {
  const sizeClass = size === "lg" ? "h-12 w-12" : size === "md" ? "h-10 w-10" : "h-8 w-8";
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-cta text-xs font-black text-primary-foreground", sizeClass)}>
      {user?.avatar ? <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" /> : (user?.name || "C").slice(0, 1).toUpperCase()}
      {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-primary" />}
    </span>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-2xl bg-white/8" />)}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-white/15 p-4 text-center text-sm text-muted-foreground">{text}</p>;
}

function MessageEmptyIcon() {
  return (
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
      <Camera className="h-7 w-7" />
    </div>
  );
}
