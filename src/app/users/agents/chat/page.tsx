"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Bot,
  ChevronDown,
  Command,
  FileText,
  FolderClosed,
  Globe,
  History,
  Image,
  LayoutPanelTop,
  Maximize2,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Paperclip,
  Search,
  SendHorizonal,
  Sparkles,
  TerminalSquare,
  Video,
  User,
  X,
} from "lucide-react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../../../../../redux/store";

type ChatThread = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  unread?: number;
  contactName?: string;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  time: string;
  attachments?: AttachmentItem[];
};

type AttachmentItem = {
  id: string;
  name: string;
  kind: "documents" | "photos" | "media" | "files";
  mimeType?: string;
  previewUrl?: string;
  sizeLabel?: string;
};

const THREADS: ChatThread[] = [
  {
    id: "product-strategy",
    title: "Product Strategy Sprint",
    preview: "Summarize findings and define release goals",
    updatedAt: "2m",
    unread: 2,
    contactName: "Ashvin Parmar",
  },
  {
    id: "ui-revamp",
    title: "UI Revamp",
    preview: "Create a floating support widget concept",
    updatedAt: "12m",
    contactName: "Rohan Mehta",
  },
  {
    id: "ops-handbook",
    title: "Ops Handbook",
    preview: "Draft the runbook for onboarding",
    updatedAt: "1h",
    contactName: "Nisha Patel",
  },
];

const MESSAGES_BY_THREAD: Record<string, ChatMessage[]> = {
  "product-strategy": [
    {
      id: "m-1",
      role: "assistant",
      time: "10:20",
      text:
        "I can run this as a full copilot-style chat flow: thread history, slash commands, files, voice, and follow-up suggestions in one floating panel.",
    },
    {
      id: "m-2",
      role: "user",
      time: "10:21",
      text:
        "Great. Build an attractive floating chatbot UI with all core chat-app features and responsive behavior.",
    },
    {
      id: "m-3",
      role: "assistant",
      time: "10:22",
      text:
        "Done. I am preparing a bold glass-and-neon interface with compact thread navigation, smart composer controls, and quick command chips.",
    },
  ],
  "ui-revamp": [
    {
      id: "m-4",
      role: "assistant",
      time: "09:50",
      text:
        "For UI revamp: use layered cards, dynamic gradients, and a visible state hierarchy between assistant, user, and system actions.",
    },
  ],
  "ops-handbook": [
    {
      id: "m-5",
      role: "assistant",
      time: "08:15",
      text:
        "Need me to generate a deployment checklist and incident runbook in this thread?",
    },
  ],
};

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".avif", ".svg"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(attachment: AttachmentItem): boolean {
  const name = attachment.name.toLowerCase();
  return Boolean(
    attachment.previewUrl &&
      (attachment.mimeType?.startsWith("image/") || IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))),
  );
}

function isMediaAttachment(attachment: AttachmentItem): boolean {
  return Boolean(
    attachment.mimeType?.startsWith("audio/") ||
      attachment.mimeType?.startsWith("video/") ||
      attachment.kind === "media",
  );
}

function AttachmentImageTile({ attachment, isUser }: { attachment: AttachmentItem; isUser: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/55 bg-white/80 shadow-sm">
      <img
        src={attachment.previewUrl}
        alt={attachment.name}
        className="h-44 w-full object-cover sm:h-52"
      />
      <div className={`flex items-center justify-between gap-3 px-3 py-2 ${isUser ? "bg-primary/95 text-white" : "bg-white text-slate-700"}`}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{attachment.name}</p>
          <p className={`text-[11px] ${isUser ? "text-white/75" : "text-slate-500"}`}>
            {attachment.sizeLabel ?? "Image"}
          </p>
        </div>
        <Image className="h-4 w-4 shrink-0" />
      </div>
    </div>
  );
}

function AttachmentCard({ attachment, isUser }: { attachment: AttachmentItem; isUser: boolean }) {
  const MediaIcon = isMediaAttachment(attachment) ? Video : FileText;

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-3 py-3 shadow-sm ${isUser ? "border-white/20 bg-white/10 text-white" : "border-white/60 bg-white/90 text-slate-700"}`}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isUser ? "bg-white/15" : "bg-primary/10"}`}>
        <MediaIcon className={`h-5 w-5 ${isUser ? "text-white" : "text-primary"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.name}</p>
        <p className={`text-[11px] ${isUser ? "text-white/75" : "text-slate-500"}`}>
          {attachment.sizeLabel ?? (isMediaAttachment(attachment) ? "Media" : "File")}
        </p>
      </div>
    </div>
  );
}

function AttachmentGallery({ attachments, isUser }: { attachments: AttachmentItem[]; isUser: boolean }) {
  const images = attachments.filter(isImageAttachment);
  const media = attachments.filter((attachment) => !isImageAttachment(attachment) && isMediaAttachment(attachment));
  const files = attachments.filter((attachment) => !isImageAttachment(attachment) && !isMediaAttachment(attachment));

  const imageGridClass = images.length === 1 ? "grid-cols-1" : "grid-cols-2";
  const mediaGridClass = media.length > 1 ? "sm:grid-cols-2" : "grid-cols-1";
  const fileGridClass = files.length > 1 ? "sm:grid-cols-2" : "grid-cols-1";

  return (
    <div className="mb-2 grid gap-2">
      {images.length ? (
        <div className={`grid gap-2 ${imageGridClass}`}>
          {images.map((attachment, index) => (
            <div key={attachment.id} className={images.length > 1 && images.length % 2 === 1 && index === 0 ? "sm:col-span-2" : ""}>
              <AttachmentImageTile attachment={attachment} isUser={isUser} />
            </div>
          ))}
        </div>
      ) : null}

      {media.length ? (
        <div className={`grid gap-2 ${mediaGridClass}`}>
          {media.map((attachment, index) => (
            <div key={attachment.id} className={media.length > 1 && media.length % 2 === 1 && index === media.length - 1 ? "sm:col-span-2" : ""}>
              <AttachmentCard attachment={attachment} isUser={isUser} />
            </div>
          ))}
        </div>
      ) : null}

      {files.length ? (
        <div className={`grid gap-2 ${fileGridClass}`}>
          {files.map((attachment, index) => (
            <div key={attachment.id} className={files.length > 1 && files.length % 2 === 1 && index === files.length - 1 ? "sm:col-span-2" : ""}>
              <AttachmentCard attachment={attachment} isUser={isUser} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function FloatingAIChatWidget() {

  const dispatch = useDispatch<AppDispatch>();
  const [open, setOpen] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState(THREADS[0].id);
  const [groupName, setGroupName] = useState("Any name");
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(true);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(
    MESSAGES_BY_THREAD,
  );
  const typingTimeoutRef = useRef<number | null>(null);
  const attachmentAreaRef = useRef<HTMLDivElement | null>(null);
  const documentsInputRef = useRef<HTMLInputElement | null>(null);
  const photosInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const [displayedUserName, setDisplayedUserName] = useState<string | undefined>(
    THREADS[0].contactName,
  );

  // Header search state and refs
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState("");
  const headerSearchRef = useRef<HTMLDivElement | null>(null);
  const headerSearchInputRef = useRef<HTMLInputElement | null>(null);

  const getInitials = (name?: string) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const activeThread = useMemo(
    () => THREADS.find((t) => t.id === activeThreadId) ?? THREADS[0],
    [activeThreadId],
  );

  useEffect(() => {
    if (!attachmentMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (attachmentAreaRef.current && !attachmentAreaRef.current.contains(target)) {
        setAttachmentMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [attachmentMenuOpen]);

    useEffect(() => {
      if (!headerSearchOpen) {
        return;
      }

      const handleClickOutside = (event: MouseEvent | TouchEvent) => {
        const target = event.target as Node;
        if (headerSearchRef.current && !headerSearchRef.current.contains(target)) {
          setHeaderSearchOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);

      // autofocus the input when opened
      setTimeout(() => headerSearchInputRef.current?.focus(), 50);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
      };
    }, [headerSearchOpen]);

  const activeMessages = useMemo(
    () => messages[activeThreadId] ?? [],
    [activeThreadId, messages],
  );

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) {
      return;
    }

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;

    const newUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text:
        trimmed ||
        `Attached ${attachments.length} file${attachments.length > 1 ? "s" : ""}`,
      time,
      attachments: attachments.length ? attachments : undefined,
    };

    setMessages((prev) => ({
      ...prev,
      [activeThreadId]: [...(prev[activeThreadId] ?? []), newUserMessage],
    }));
    setInput("");
    setAttachments([]);
    setIsTyping(true);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      const reply: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text:
          "I can help with that. Choose one quick action below or continue typing for a detailed response with files, steps, and UI snippets.",
        time,
      };

      setMessages((prev) => ({
        ...prev,
        [activeThreadId]: [...(prev[activeThreadId] ?? []), reply],
      }));
      setIsTyping(false);
    }, 1200);
  };

  const handlePickAttachment = (
    event: React.ChangeEvent<HTMLInputElement>,
    kind: AttachmentItem["kind"],
  ) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (!selectedFiles.length) {
      return;
    }

    const pickedItems = selectedFiles.map((file) => ({
      id: `att-${Date.now()}-${file.name}`,
      name: file.name,
      kind,
      mimeType: file.type || undefined,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      sizeLabel: formatFileSize(file.size),
    }));

    setAttachments((prev) => [...prev, ...pickedItems]);
    setAttachmentMenuOpen(false);
    event.target.value = "";
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-15 sm:right-6">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="group relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-3xl bg-linear-to-br from-primary via-primary-light to-primary/90 shadow-[0_24px_50px_rgba(109,74,255,0.34)] transition-all duration-300 hover:scale-110"
        >
          <Bot className="h-7 w-7 text-white" />
          <span className="absolute -right-1 -top-1 rounded-full border-2 border-white bg-rose-500 px-1.5 text-[10px] font-semibold leading-5 text-white">
            3
          </span>

          <div className="absolute inset-0 rounded-3xl bg-primary/30 blur-2xl transition-all duration-300 group-hover:scale-150" />
        </button>
      )}

      {open && (
        <div className="relative flex h-[min(760px,90vh)] w-[min(96vw,980px)] overflow-hidden rounded-[34px] border border-white/35 bg-transparent shadow-[0_28px_120px_rgba(15,23,42,0.28)] backdrop-blur-3xl">
          <div className="hidden w-70 flex-col border-r-2 border-slate-200/20 bg-white/40 p-4 lg:flex">
            <div className="flex items-center gap-3 sm:gap-4 mb-4 w-full">
              <div className="relative shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
                <Sparkles className="h-5 w-5 text-white" />
                <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
              </div>

              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 sm:text-base truncate">
                  Agent Copilot
                </h2>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 sm:text-sm">
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Web + Files enabled</span>
                </p>
              </div>
            </div>

            <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 w-full">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                placeholder="Search threads"
                className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-500"
              />
            </div>

            <button className="mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20">
              <Sparkles className="h-4 w-4" />
              New Conversation
            </button>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {THREADS.map((thread) => {
                const active = thread.id === activeThreadId;
                return (
                  <button
                    key={thread.id}
                    onClick={() => {
                      setActiveThreadId(thread.id);
                      setDisplayedUserName(thread.contactName);
                    }}
                    className={`w-full cursor-pointer rounded-2xl border p-3 text-left transition ${
                      active
                        ? "border-primary/20 bg-white shadow-md"
                        : "border-transparent bg-white/55 hover:border-white hover:bg-white/80"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="line-clamp-1 text-sm font-semibold text-slate-800">
                          {thread.title}
                        </h3>
                        <div className="text-xs text-slate-500">{thread.contactName}</div>
                      </div>
                      <span className="text-xs text-slate-500">{thread.updatedAt}</span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-5 text-slate-500">{thread.preview}</p>
                    {thread.unread ? (
                      <span className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {thread.unread} new
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* <div className="mt-4 rounded-2xl border border-white/50 bg-white/70 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Bell className="h-4 w-4 text-primary" />
                Smart Notices
              </div>
              <p className="text-xs leading-5 text-slate-500">
                Auto summarize long conversations every 10 messages.
              </p>
            </div> */}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="relative border-b border-white/30 bg-white/35 px-4 py-4 backdrop-blur-3xl sm:px-6">
              <div className="flex items-center justify-between">
                {/* <div className="flex items-center gap-3 sm:gap-4">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary-light shadow-lg shadow-primary/20">
                    <Sparkles className="h-5 w-5 text-white" />
                    <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
                  </div>

                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
                      Agent Copilot
                    </h2>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 sm:text-sm">
                      <Globe className="h-3.5 w-3.5" />
                      Web + Docs + Files enabled
                    </p>
                  </div>
                </div> */}

                <div className="hidden sm:flex items-center gap-3 mr-3">
                  <div className="inline-flex items-center gap-3 rounded-full bg-white/5 px-3 py-1">
                    <div className="h-9 w-9 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold">
                      {getInitials(displayedUserName)}
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="text-sm font-semibold text-slate-900">{displayedUserName ?? "—"}</div>
                      <div className="text-[11px] text-slate-500">Selected user</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setHeaderSearchOpen((p) => !p)}
                      aria-label="Search"
                      className="hidden h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-white/55 transition hover:bg-white sm:flex"
                    >
                      <Search className="h-4 w-4 text-slate-600" />
                    </button>

                    {headerSearchOpen ? (
                      <div
                        ref={headerSearchRef}
                        className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-xl"
                      >
                        <input
                          ref={headerSearchInputRef}
                          value={headerSearchQuery}
                          onChange={(e) => setHeaderSearchQuery(e.target.value)}
                          placeholder="Search messages"
                          className="w-full rounded-xl bg-transparent px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-500"
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setHeaderSearchOpen(false);
                          }}
                        />
                      </div>
                    ) : null}
                  </div>

                  <button className="hidden h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-white/55 transition hover:bg-white sm:flex">
                    <Maximize2 className="h-4 w-4 text-slate-600" />
                  </button>
                  <button className="hidden h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-white/55 transition hover:bg-white sm:flex">
                    <MoreHorizontal className="h-4 w-4 text-slate-600" />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-white/55 transition hover:bg-white"
                  >
                    <X className="h-4 w-4 text-slate-700" />
                  </button>
                </div>
              </div>
            </div>

            <div className="border-b border-white/30 bg-transparent px-4 py-3 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-600">Suggestions</div>
                <div className="text-xs text-slate-400">Quick commands</div>
              </div>

              <div className="mt-3 overflow-x-auto pb-2">
                <div className="flex items-center gap-2 px-1 min-w-max">
                  {[
                    { icon: Command, label: "/summarize" },
                    { icon: TerminalSquare, label: "/generate-ui" },
                    { icon: LayoutPanelTop, label: "/draft-layout" },
                    { icon: History, label: "View history" },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      aria-label={chip.label}
                      onClick={() => setInput((prev) => (prev ? prev + " " + chip.label : chip.label))}
                      className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/65 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <chip.icon className="h-4 w-4 text-slate-700" />
                      <span className="whitespace-nowrap">{chip.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-transparent px-4 py-5 sm:px-6">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                {activeMessages.map((message) => {
                  const isUser = message.role === "user";

                  return (
                    <div
                      key={message.id}
                      className={`flex items-end gap-2 ${
                        isUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!isUser ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/20">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      ) : null}

                      <div
                        className={`max-w-[84%] rounded-[22px] px-4 py-3 shadow-md ${
                          isUser
                            ? "rounded-br-md bg-primary text-white"
                            : "rounded-tl-md border border-white/55 bg-white/75 text-slate-700 backdrop-blur-2xl"
                        }`}
                      >
                        {message.attachments && message.attachments.length ? (
                          <AttachmentGallery attachments={message.attachments} isUser={isUser} />
                        ) : null}

                        <p className="text-sm leading-6 sm:text-[15px]">
                          {message.text}
                        </p>
                        <div
                          className={`mt-1 text-[11px] ${
                            isUser ? "text-primary-foreground/80" : "text-slate-500"
                          }`}
                        >
                          {message.time}
                        </div>
                      </div>

                      {isUser ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                          <User className="h-4 w-4" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {isTyping ? (
                  <div className="flex items-end gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary-light shadow-md shadow-primary/20">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="rounded-[22px] rounded-tl-md border border-white/55 bg-white/80 px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-white/55 bg-white/75 p-3 shadow-md backdrop-blur-2xl">
                  <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500">
                    QUICK ACTIONS
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { icon: FileText, label: "Generate PRD" },
                      { icon: FolderClosed, label: "Attach Docs" },
                      { icon: Image, label: "Create UI Mock" },
                      { icon: Globe, label: "Web Research" },
                    ].map((action) => (
                      <button
                        key={action.label}
                        className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-primary px-2 py-2 text-xs font-medium text-white transition hover:bg-primary-light"
                      >
                        <action.icon className="h-3.5 w-3.5" />
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/35 bg-white/40 px-4 pb-4 pt-3 backdrop-blur-3xl sm:px-6 sm:pb-5">
              <button
                type="button"
                aria-expanded={showCommands}
                onClick={() => setShowCommands((prev) => !prev)}
                className="mb-2 inline-flex cursor-pointer items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 transition hover:text-primary"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Suggested prompts</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showCommands ? "rotate-180" : ""}`} />
              </button>

              {showCommands ? (
                <div className="mt-2 overflow-x-auto pb-2">
                  <div className="flex items-center gap-2 px-1 min-w-max">
                    {[
                      "Design a floating support widget",
                      "Summarize this conversation",
                      "Generate React + Tailwind component",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setInput(prompt)}
                        className="inline-flex items-center cursor-pointer gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-xs text-slate-700 transition hover:border-primary/20 hover:bg-primary/5 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div
                ref={attachmentAreaRef}
                className="relative rounded-[28px] border border-white/40 bg-transparent p-2 shadow-[0_20px_60px_rgba(109,74,255,0.17)] backdrop-blur-3xl"
              >
                <div className="absolute inset-0 rounded-[28px] bg-linear-to-r from-primary/10 via-white/20 to-primary-light/10" />
                {attachmentMenuOpen ? (
                  <div className="absolute bottom-full left-2 mb-2 w-52 rounded-2xl border border-white/60 bg-white/90 p-2 shadow-xl backdrop-blur-2xl">
                    {[
                      {
                        label: "Documents",
                        icon: FileText,
                        onClick: () => documentsInputRef.current?.click(),
                      },
                      {
                        label: "Photos",
                        icon: Image,
                        onClick: () => photosInputRef.current?.click(),
                      },
                      {
                        label: "Media",
                        icon: Globe,
                        onClick: () => mediaInputRef.current?.click(),
                      },
                      {
                        label: "All files",
                        icon: FolderClosed,
                        onClick: () => filesInputRef.current?.click(),
                      },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={item.onClick}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-primary/5 hover:text-primary"
                      >
                        <item.icon className="h-4 w-4 text-primary" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="relative flex items-end gap-2">
                  <button
                    onClick={() => setAttachmentMenuOpen((prev) => !prev)}
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-white/55 transition hover:bg-primary/5 border"
                  >
                    <Paperclip className="h-4 w-4 text-slate-600" />
                  </button>
                  <div className="flex min-h-11 flex-1 items-center rounded-2xl border border-gray-200 bg-transparent px-3">
                    <textarea
                      rows={1}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onFocus={() => setAttachmentMenuOpen(false)}
                      onClick={() => setAttachmentMenuOpen(false)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Message Your Assistant..."
                      className="max-h-28 w-full resize-none bg-transparent py-2 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 sm:text-[15px]"
                    />
                  </div>
                  <button className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-white/55 transition hover:bg-primary/5 border">
                    <Mic className="h-4 w-4 text-slate-600" />
                  </button>
                  <button
                    onClick={sendMessage}
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-primary shadow-[0_12px_25px_rgba(109,74,255,0.35)] transition hover:scale-105"
                  >
                    <SendHorizonal className="h-4 w-4 text-white" />
                  </button>
                </div>

                {attachments.length ? (
                  <div className="relative mt-2 flex flex-wrap gap-1.5 px-1">
                    {attachments.map((attachment) => (
                      <span
                        key={attachment.id}
                        className="inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/75 px-2 py-1 text-[11px] text-slate-700"
                      >
                        {attachment.name}
                        <button
                          onClick={() =>
                            setAttachments((prev) =>
                              prev.filter((item) => item.id !== attachment.id),
                            )
                          }
                          className="cursor-pointer rounded-full p-0.5 hover:bg-slate-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

                <input
                  ref={documentsInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx"
                  onChange={(event) => handlePickAttachment(event, "documents")}
                />
                <input
                  ref={photosInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*"
                  onChange={(event) => handlePickAttachment(event, "photos")}
                />
                <input
                  ref={mediaInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept="audio/*,video/*"
                  onChange={(event) => handlePickAttachment(event, "media")}
                />
                <input
                  ref={filesInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => handlePickAttachment(event, "files")}
                />
              </div>

              {/* <div className="mt-2 flex items-center justify-end px-1 text-[11px] text-slate-500">
                <span>Model: gpt-5.3-codex</span>
                <span className="inline-flex items-center gap-1">
                  <Command className="h-3.5 w-3.5" />
                  Press Enter to send
                </span>
              </div> */}
            </div>
          </div>
          {/* page background and decorative gradients removed for a cleaner UI */}
        </div>
      )}
    </div>
  );
}
