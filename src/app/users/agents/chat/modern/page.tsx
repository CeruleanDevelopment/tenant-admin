"use client";

import { useMemo, useRef, useState } from "react";
import {
  Archive,
  Bot,
  CheckCheck,
  Command,
  FileText,
  Headphones,
  Image,
  LayoutPanelLeft,
  Mic,
  Paperclip,
  SendHorizonal,
  Sparkles,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AttachmentKind = "documents" | "photos" | "media" | "files";
type MessageRole = "assistant" | "user" | "system";

type Message = {
  id: string;
  role: MessageRole;
  name: string;
  text: string;
  time: string;
  status?: string;
  attachments?: Attachment[];
};

type Thread = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  unread?: number;
};

type Attachment = {
  id: string;
  name: string;
  kind: AttachmentKind;
  mimeType?: string;
  previewUrl?: string;
  sizeLabel?: string;
};

type PromptAction = {
  icon: LucideIcon;
  label: string;
  value: string;
};

const THREADS: Thread[] = [
  {
    id: "widget-home",
    title: "Support Assistant",
    preview: "Ask anything about product, docs, or workflows.",
    updatedAt: "Live",
    unread: 1,
  },
  {
    id: "widget-followup",
    title: "Follow-up Drafts",
    preview: "Generate a polished response from the last message.",
    updatedAt: "Today",
  },
  {
    id: "widget-team",
    title: "Team Helper",
    preview: "Compact AI help for fast answers and summaries.",
    updatedAt: "2h",
  },
];

const INITIAL_MESSAGES: Record<string, Message[]> = {
  "widget-home": [
    {
      id: "m1",
      role: "assistant",
      name: "Agent Copilot",
      time: "Now",
      text:
        "I am ready to answer questions, summarize files, and draft responses in a compact widget experience.",
      status: "Online",
    },
    {
      id: "m2",
      role: "user",
      name: "You",
      time: "Now",
      text: "Show me a modern widget that feels polished, premium, and easy to use.",
    },
  ],
  "widget-followup": [
    {
      id: "m3",
      role: "assistant",
      name: "Agent Copilot",
      time: "Today",
      text: "Compose short follow-ups with tone controls, attachments, and fast actions.",
    },
  ],
  "widget-team": [
    {
      id: "m4",
      role: "system",
      name: "System",
      time: "2h",
      text: "3 members are active and 1 file is pending review.",
      status: "Activity",
    },
  ],
};

const ACTIONS: PromptAction[] = [
  { icon: FileText, label: "Summarize", value: "Summarize the latest conversation in 3 bullets." },
  { icon: LayoutPanelLeft, label: "Layout", value: "Suggest a cleaner widget layout hierarchy." },
  { icon: Headphones, label: "Voice", value: "Turn this into a short voice-friendly response." },
  { icon: Archive, label: "Archive", value: "Summarize and archive this thread." },
];

const SUPPORT_CARDS = [
  {
    title: "Fast reply",
    value: "0.9s",
    description: "Assistant response target",
  },
  {
    title: "Mode",
    value: "Widget",
    description: "Compact, polished support shell",
  },
  {
    title: "Brand",
    value: "Purple",
    description: "Uses your theme colors",
  },
];

const LABEL_BY_KIND: Record<AttachmentKind, string> = {
  documents: "Documents",
  photos: "Photos",
  media: "Media",
  files: "Files",
};

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".avif", ".svg"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(attachment: Attachment): boolean {
  const name = attachment.name.toLowerCase();
  return Boolean(
    attachment.previewUrl &&
      (attachment.mimeType?.startsWith("image/") || IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))),
  );
}

function isMediaAttachment(attachment: Attachment): boolean {
  return Boolean(
    attachment.mimeType?.startsWith("audio/") ||
      attachment.mimeType?.startsWith("video/") ||
      attachment.kind === "media",
  );
}

function AttachmentImageTile({ attachment, isUser }: { attachment: Attachment; isUser: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950/80">
      <img
        src={attachment.previewUrl}
        alt={attachment.name}
        className="h-44 w-full object-cover sm:h-52"
      />
      <div className={`flex items-center justify-between gap-3 px-3 py-2 ${isUser ? "bg-primary text-white" : "bg-white text-slate-700 dark:bg-slate-950/80 dark:text-slate-200"}`}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{attachment.name}</p>
          <p className={`text-[11px] ${isUser ? "text-white/75" : "text-slate-500 dark:text-slate-400"}`}>
            {attachment.sizeLabel ?? "Image"}
          </p>
        </div>
        <Image className="h-4 w-4 shrink-0" />
      </div>
    </div>
  );
}

function AttachmentCard({ attachment, isUser }: { attachment: Attachment; isUser: boolean }) {
  const MediaIcon = isMediaAttachment(attachment) ? Headphones : Archive;

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-3 py-3 shadow-sm ${isUser ? "border-white/20 bg-white/10 text-white" : "border-slate-200/70 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200"}`}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isUser ? "bg-white/15" : "bg-primary/10"}`}>
        <MediaIcon className={`h-5 w-5 ${isUser ? "text-white" : "text-primary"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.name}</p>
        <p className={`text-[11px] ${isUser ? "text-white/75" : "text-slate-500 dark:text-slate-400"}`}>
          {attachment.sizeLabel ?? (isMediaAttachment(attachment) ? "Media" : "File")}
        </p>
      </div>
    </div>
  );
}

function AttachmentGallery({ attachments, isUser }: { attachments: Attachment[]; isUser: boolean }) {
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

function timeStamp(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function buildUserMessage(input: string, attachments: Attachment[]): Message {
  return {
    id: `user-${Date.now()}`,
    role: "user",
    name: "You",
    time: timeStamp(),
    text: input.trim() || `Attached ${attachments.length} item${attachments.length > 1 ? "s" : ""}`,
    status: attachments.length ? `${attachments.length} files` : undefined,
    attachments: attachments.length ? attachments : undefined,
  };
}

function buildReply(threadTitle: string): Message {
  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    name: "Widget Copilot",
    time: timeStamp(),
    text:
      `I updated ${threadTitle} with a cleaner chat flow, premium spacing, quick actions, and a more elegant support-widget feel.`,
    status: "Ready",
  };
}

function Pill({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-black/5 dark:bg-slate-950/70 dark:text-slate-300 dark:ring-white/10">
      <Icon className="h-3.5 w-3.5 text-primary" />
      {text}
    </span>
  );
}

function Metric({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-white/10 dark:bg-slate-950/70">
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary-light text-white shadow-lg shadow-primary/20">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-[24px] rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

export default function ModernChatWidgetPage() {
  const [threadId, setThreadId] = useState(THREADS[0].id);
  const [input, setInput] = useState("");
  const [showPrompts, setShowPrompts] = useState(true);
  const [typing, setTyping] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>(INITIAL_MESSAGES);

  const documentsInputRef = useRef<HTMLInputElement | null>(null);
  const photosInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);

  const currentThread = useMemo(
    () => THREADS.find((item) => item.id === threadId) ?? THREADS[0],
    [threadId],
  );
  const currentMessages = messages[threadId] ?? [];

  const sendMessage = () => {
    if (!input.trim() && !attachments.length) return;

    const userMessage = buildUserMessage(input, attachments);
    setMessages((prev) => ({
      ...prev,
      [threadId]: [...(prev[threadId] ?? []), userMessage],
    }));
    setInput("");
    setAttachments([]);
    setAttachmentMenuOpen(false);
    setTyping(true);

    window.setTimeout(() => {
      setMessages((prev) => ({
        ...prev,
        [threadId]: [...(prev[threadId] ?? []), buildReply(currentThread.title)],
      }));
      setTyping(false);
    }, 900);
  };

  const applyQuickAction = (value: string) => {
    setInput(value);
  };

  const handleAttachmentPick = (kind: AttachmentKind, files: File[]) => {
    const picked = files.length
      ? files.map((file) => ({
          id: `${kind}-${file.name}-${Date.now()}`,
          name: file.name,
          kind,
          mimeType: file.type || undefined,
          previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
          sizeLabel: formatFileSize(file.size),
        }))
      : [
          {
            id: `${kind}-${Date.now()}`,
            name: LABEL_BY_KIND[kind],
            kind,
          },
        ];

    setAttachments((prev) => [...prev, ...picked]);
    setAttachmentMenuOpen(false);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-linear-to-b from-primary/10 via-white/95 to-white/90 dark:from-primary/12 dark:via-slate-900 dark:to-slate-950 px-4 py-6 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-8 rounded-4xl">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Modern widget chat
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                A Chatbot UI
              </h1>
              {/* <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400 sm:text-base">
                A simple, attractive chat widget with bubbles, prompts, typing state, and file support. No extra dashboard clutter.
              </p> */}
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-107.5">
              <StatPill label="Reply" value="0.9s" />
              <StatPill label="Style" value="Widget" />
              <StatPill label="Theme" value="Purple" />
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-[34px] border border-white/70 bg-white/86 shadow-[0_24px_80px_rgba(17,24,39,0.12)] backdrop-blur-3xl dark:border-white/10 dark:bg-slate-950/68">
          <div className="border-b border-slate-200/80 bg-linear-to-r from-primary/10 via-white to-primary-light/10 px-5 py-4 dark:border-white/10 dark:from-primary/15 dark:via-transparent dark:to-primary-light/10 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary-light text-white shadow-lg shadow-primary/20">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{currentThread.title}</h2>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Live
                    </span>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Clean bubbles, quick actions, and a compact composer dock.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Pill icon={CheckCheck} text="Encrypted" />
                <Pill icon={Sparkles} text="Purple theme" />
                <Pill icon={Command} text="Quick actions" />
              </div>
            </div>
          </div>

          {/* <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/10 sm:px-6">
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => applyQuickAction(action.value)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:border-primary/25 hover:bg-primary/10"
                >
                  <action.icon className="h-3.5 w-3.5" />
                  {action.label}
                </button>
              ))}
            </div>
          </div> */}

          <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex min-w-0 flex-col rounded-[30px] border border-slate-200/80 bg-slate-50/60 p-5 dark:border-white/10 dark:bg-white/5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">Conversation</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Assistant responses and your messages appear in a clean bubble flow.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrompts((prev) => !prev)}
                  className="cursor-pointer rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-black/5 transition hover:text-primary dark:bg-slate-950/70 dark:text-slate-300 dark:ring-white/10"
                >
                  {showPrompts ? "Hide prompts" : "Show prompts"}
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto pr-1 xl:pr-2 pb-10 max-h-[36vh] sm:max-h-[40vh] lg:max-h-[44vh]">
                {currentMessages.map((message) => {
                  const isUser = message.role === "user";
                  const isSystem = message.role === "system";

                  return (
                    <div key={message.id} className={`flex items-end gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                      {!isUser ? (
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isSystem ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : "bg-linear-to-br from-primary to-primary-light text-white"}`}>
                          {isSystem ? <Star className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </div>
                      ) : null}

                      <div
                        className={`max-w-[86%] rounded-[26px] px-4 py-3 shadow-[0_14px_30px_rgba(15,23,42,0.08)] ${
                          isUser
                            ? "rounded-br-md bg-linear-to-br from-primary to-primary-light text-white"
                            : isSystem
                              ? "rounded-tl-md border border-dashed border-slate-300 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300"
                              : "rounded-tl-md border border-white/80 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200"
                        }`}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] opacity-70">
                          <span>{message.name}</span>
                          {message.status ? <span>• {message.status}</span> : null}
                        </div>

                        {message.attachments && message.attachments.length ? (
                          <AttachmentGallery attachments={message.attachments} isUser={message.role === "user"} />
                        ) : null}

                        <p className="text-sm leading-6 sm:text-[15px]">{message.text}</p>
                        <div className={`mt-2 text-[11px] ${isUser ? "text-white/80" : "text-slate-400"}`}>
                          {message.time}
                        </div>
                      </div>

                      {isUser ? (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15 dark:bg-white dark:text-slate-950">
                          <Bot className="h-4 w-4 rotate-180" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {typing ? <TypingBubble /> : null}

                {showPrompts ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <HintCard title="Smart prompt" text="Generate a summary, a follow-up, or a task breakdown with one click." />
                    <HintCard title="File aware" text="Drop PDFs, images, or recordings without leaving the flow." />
                  </div>
                ) : null}
              </div>

              <div className="mt-5 rounded-[30px] border border-slate-200/80 bg-white p-3 shadow-[0_18px_35px_rgba(109,74,255,0.08)] dark:border-white/10 dark:bg-slate-950/70">
                {/* <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">Composer</span>
                  <button
                    type="button"
                    onClick={() => setAttachmentMenuOpen((prev) => !prev)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/15"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Attach
                  </button>
                </div> */}

                <div className="relative rounded-[26px] border border-slate-200/80 bg-linear-to-br from-white via-primary/4 to-primary-light/8 p-3 dark:border-white/10 dark:from-slate-950 dark:via-slate-950/80 dark:to-primary/10">
                  {attachmentMenuOpen ? (
                    <div className="absolute bottom-full left-3 mb-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                      {([
                        { kind: "documents", icon: FileText },
                        { kind: "photos", icon: Image },
                        { kind: "media", icon: Headphones },
                        { kind: "files", icon: Archive },
                      ] as Array<{ kind: AttachmentKind; icon: LucideIcon }>).map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.kind}
                            type="button"
                            onClick={() => handleAttachmentPick(item.kind, [])}
                            className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-primary/5 hover:text-primary dark:text-slate-300 dark:hover:bg-white/5"
                          >
                            <Icon className="h-4 w-4" />
                            {LABEL_BY_KIND[item.kind]}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAttachmentMenuOpen((prev) => !prev)}
                      className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white transition hover:border-primary/20 hover:bg-primary/5 dark:border-white/10 dark:bg-white/5"
                    >
                      <Paperclip className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    </button>

                    <div className="flex min-h-12 flex-1 items-center rounded-2xl border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-white/5">
                      <textarea
                        value={input}
                        rows={1}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            sendMessage();
                          }
                        }}
                        placeholder="Message your assistant..."
                        className="max-h-32 w-full resize-none bg-transparent py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
                      />
                    </div>

                    <button
                      type="button"
                      className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white transition hover:border-primary/20 hover:bg-primary/5 dark:border-white/10 dark:bg-white/5"
                    >
                      <Mic className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    </button>

                    <button
                      type="button"
                      onClick={sendMessage}
                      className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/25 transition hover:bg-primary-light"
                    >
                      <SendHorizonal className="h-4 w-4" />
                    </button>
                  </div>

                  {attachments.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {attachments.map((attachment) => (
                        <span key={attachment.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-700 dark:bg-white/8 dark:text-slate-300">
                          {attachment.name}
                          <button
                            type="button"
                            onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== attachment.id))}
                            className="cursor-pointer rounded-full p-0.5 transition hover:bg-slate-200 dark:hover:bg-white/10"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <input ref={documentsInputRef} type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx" onChange={(event) => handleAttachmentPick("documents", Array.from(event.target.files ?? []))} />
                  <input ref={photosInputRef} type="file" multiple className="hidden" accept="image/*" onChange={(event) => handleAttachmentPick("photos", Array.from(event.target.files ?? []))} />
                  <input ref={mediaInputRef} type="file" multiple className="hidden" accept="audio/*,video/*" onChange={(event) => handleAttachmentPick("media", Array.from(event.target.files ?? []))} />
                  <input ref={filesInputRef} type="file" multiple className="hidden" onChange={(event) => handleAttachmentPick("files", Array.from(event.target.files ?? []))} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function IconButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-primary/20 hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function SupportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="font-medium text-primary">{value}</span>
    </div>
  );
}

function PresenceRow({ name, status, dot }: { name: string; status: string; dot: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2 shadow-sm dark:bg-slate-950/70">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className="font-medium text-slate-800 dark:text-slate-200">{name}</span>
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400">{status}</span>
    </div>
  );
}

function HintCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
      <p className="text-sm font-semibold text-slate-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}

function PreviewRow({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
      <p className="font-semibold text-slate-950 dark:text-white">{title}</p>
      <p className="mt-1 leading-6">{text}</p>
    </div>
  );
}

