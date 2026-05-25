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
  User,
  X,
} from "lucide-react";

type ChatThread = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  unread?: number;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  time: string;
};

type AttachmentItem = {
  id: string;
  name: string;
  kind: "documents" | "photos" | "media" | "files";
};

const THREADS: ChatThread[] = [
  {
    id: "product-strategy",
    title: "Product Strategy Sprint",
    preview: "Summarize findings and define release goals",
    updatedAt: "2m",
    unread: 2,
  },
  {
    id: "ui-revamp",
    title: "UI Revamp",
    preview: "Create a floating support widget concept",
    updatedAt: "12m",
  },
  {
    id: "ops-handbook",
    title: "Ops Handbook",
    preview: "Draft the runbook for onboarding",
    updatedAt: "1h",
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

export default function FloatingAIChatWidget() {
  const [open, setOpen] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState(THREADS[0].id);
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
          className="group relative flex h-16 w-16 items-center justify-center rounded-3xl bg-linear-to-br from-sky-500 via-cyan-500 to-indigo-600 shadow-[0_24px_50px_rgba(6,182,212,0.4)] transition-all duration-300 hover:scale-110 cursor-pointer"
        >
          <Bot className="h-7 w-7 text-white" />
          <span className="absolute -right-1 -top-1 rounded-full border-2 border-white bg-rose-500 px-1.5 text-[10px] font-semibold leading-5 text-white">
            3
          </span>

          <div className="absolute inset-0 rounded-3xl bg-cyan-400/30 blur-2xl transition-all duration-300 group-hover:scale-150" />
        </button>
      )}

      {open && (
        <div className="relative flex h-[min(760px,90vh)] w-[min(96vw,980px)] overflow-hidden rounded-[34px] border border-white/35 bg-[#f2f7ff]/75 shadow-[0_28px_120px_rgba(15,23,42,0.28)] backdrop-blur-3xl">
          <div className="hidden w-70 flex-col border-r border-white/30 bg-white/40 p-4 lg:flex">
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/50 bg-white/70 px-3 py-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                placeholder="Search threads"
                className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>

            <button className="mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-sky-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-200/70">
              <Sparkles className="h-4 w-4" />
              New Conversation
            </button>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {THREADS.map((thread) => {
                const active = thread.id === activeThreadId;
                return (
                  <button
                    key={thread.id}
                    onClick={() => setActiveThreadId(thread.id)}
                    className={`w-full cursor-pointer rounded-2xl border p-3 text-left transition ${
                      active
                        ? "border-cyan-200 bg-white shadow-md"
                        : "border-transparent bg-white/55 hover:border-white hover:bg-white/80"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h3 className="line-clamp-1 text-sm font-semibold text-slate-800">
                        {thread.title}
                      </h3>
                      <span className="text-xs text-slate-500">{thread.updatedAt}</span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-5 text-slate-500">
                      {thread.preview}
                    </p>
                    {thread.unread ? (
                      <span className="mt-2 inline-flex rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">
                        {thread.unread} new
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-white/50 bg-white/70 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Bell className="h-4 w-4 text-cyan-600" />
                Smart Notices
              </div>
              <p className="text-xs leading-5 text-slate-500">
                Auto summarize long conversations every 10 messages.
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="relative border-b border-white/30 bg-white/35 px-4 py-4 backdrop-blur-3xl sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 to-indigo-600 shadow-lg shadow-cyan-200">
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
                </div>

                <div className="flex items-center gap-2">
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

            <div className="border-b border-white/30 bg-white/25 px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { icon: Command, label: "/summarize" },
                  { icon: TerminalSquare, label: "/generate-ui" },
                  { icon: LayoutPanelTop, label: "/draft-layout" },
                  { icon: History, label: "View history" },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/60 bg-white/65 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white"
                  >
                    <chip.icon className="h-3.5 w-3.5" />
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-linear-to-b from-[#f8fbff] via-[#f2f8ff] to-[#edf6ff] px-4 py-5 sm:px-6">
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
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-sky-500 to-indigo-600 shadow-md shadow-cyan-200">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      ) : null}

                      <div
                        className={`max-w-[84%] rounded-[22px] px-4 py-3 shadow-md ${
                          isUser
                            ? "rounded-br-md bg-linear-to-r from-cyan-500 to-blue-600 text-white"
                            : "rounded-tl-md border border-white/55 bg-white/75 text-slate-700 backdrop-blur-2xl"
                        }`}
                      >
                        <p className="text-sm leading-6 sm:text-[15px]">
                          {message.text}
                        </p>
                        <div
                          className={`mt-1 text-[11px] ${
                            isUser ? "text-cyan-50" : "text-slate-500"
                          }`}
                        >
                          {message.time}
                        </div>
                      </div>

                      {isUser ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800/90 text-white">
                          <User className="h-4 w-4" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {isTyping ? (
                  <div className="flex items-end gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-sky-500 to-indigo-600 shadow-md shadow-cyan-200">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="rounded-[22px] rounded-tl-md border border-white/55 bg-white/80 px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500 [animation-delay:-0.2s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500 [animation-delay:-0.1s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500" />
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
                        className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-slate-900 px-2 py-2 text-xs font-medium text-white transition hover:bg-slate-700"
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
                onClick={() => setShowCommands((prev) => !prev)}
                className="mb-2 inline-flex cursor-pointer items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-600"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Suggested prompts
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              {showCommands ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {[
                    "Design a floating support widget",
                    "Summarize this conversation",
                    "Generate React + Tailwind component",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="cursor-pointer rounded-xl border border-white/60 bg-white/70 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-white"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}

              <div
                ref={attachmentAreaRef}
                className="relative rounded-[28px] border border-white/40 bg-[#dce8ff]/75 p-2 shadow-[0_20px_60px_rgba(59,130,246,0.17)] backdrop-blur-3xl"
              >
                <div className="absolute inset-0 rounded-[28px] bg-linear-to-r from-sky-100/30 via-white/20 to-blue-100/30" />
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
                        className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                      >
                        <item.icon className="h-4 w-4 text-cyan-600" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="relative flex items-end gap-2">
                  <button
                    onClick={() => setAttachmentMenuOpen((prev) => !prev)}
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-white/55 transition hover:bg-white"
                  >
                    <Paperclip className="h-4 w-4 text-slate-600" />
                  </button>
                  <div className="flex min-h-11 flex-1 items-center rounded-2xl border border-white/40 bg-[#f9fcff]/85 px-3">
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
                      placeholder="Message Agent Copilot..."
                      className="max-h-28 w-full resize-none bg-transparent py-2 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 sm:text-[15px]"
                    />
                  </div>
                  <button className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-white/55 transition hover:bg-white">
                    <Mic className="h-4 w-4 text-slate-600" />
                  </button>
                  <button
                    onClick={sendMessage}
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 to-blue-600 shadow-[0_12px_25px_rgba(6,182,212,0.35)] transition hover:scale-105"
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

              <div className="mt-2 flex items-center justify-end px-1 text-[11px] text-slate-500">
                {/* <span>Model: gpt-5.3-codex</span> */}
                <span className="inline-flex items-center gap-1">
                  <Command className="h-3.5 w-3.5" />
                  Press Enter to send
                </span>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_90%_90%,rgba(59,130,246,0.22),transparent_45%)]" />
        </div>
      )}
    </div>
  );
}
