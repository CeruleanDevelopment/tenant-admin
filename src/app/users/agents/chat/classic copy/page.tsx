"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
	Bot,
	FileText,
	FolderClosed,
	Globe,
	Image,
	Mic,
	Paperclip,
	Search,
	SendHorizonal,
	Sparkles,
	User,
	X,
} from "lucide-react";

type Thread = {
	id: string;
	title: string;
	preview: string;
	updatedAt: string;
};

type Message = {
	id: string;
	role: "assistant" | "user";
	text: string;
	time: string;
};

type Attachment = {
	id: string;
	name: string;
	kind: "document" | "image" | "media" | "file";
};

const THREADS: Thread[] = [
	{
		id: "ui-rework",
		title: "UI Rework",
		preview: "Plan attractive chat page redesign",
		updatedAt: "2m",
	},
	{
		id: "support-flow",
		title: "Support Flow",
		preview: "Improve chatbot reply quality",
		updatedAt: "18m",
	},
	{
		id: "agent-prompts",
		title: "Agent Prompts",
		preview: "Create prompt templates",
		updatedAt: "1h",
	},
];

const INITIAL_MESSAGES: Record<string, Message[]> = {
	"ui-rework": [
		{
			id: "m1",
			role: "assistant",
			text: "Welcome back. I can help craft a clean, full-page chat UI with modern gradients and readable spacing.",
			time: "10:02",
		},
		{
			id: "m2",
			role: "user",
			text: "Great. I want this page to look premium but keep it simple and practical.",
			time: "10:03",
		},
		{
			id: "m3",
			role: "assistant",
			text: "Perfect. I will keep the layout minimalist, improve hierarchy, and add a polished composer with attachments.",
			time: "10:04",
		},
	],
	"support-flow": [
		{
			id: "m4",
			role: "assistant",
			text: "Need help drafting an escalation policy and response templates?",
			time: "09:27",
		},
	],
	"agent-prompts": [
		{
			id: "m5",
			role: "assistant",
			text: "I can generate reusable prompt snippets for onboarding, troubleshooting, and ticket triage.",
			time: "08:43",
		},
	],
};

export default function ClassicChatPage() {
	const [activeThreadId, setActiveThreadId] = useState(THREADS[0].id);
	const [messages, setMessages] = useState<Record<string, Message[]>>(INITIAL_MESSAGES);
	const [input, setInput] = useState("");
	const [attachments, setAttachments] = useState<Attachment[]>([]);
	const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
	const attachmentAreaRef = useRef<HTMLDivElement | null>(null);

	const docInputRef = useRef<HTMLInputElement | null>(null);
	const imageInputRef = useRef<HTMLInputElement | null>(null);
	const mediaInputRef = useRef<HTMLInputElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

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

	const nowTime = () => {
		const now = new Date();
		return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
	};

	const sendMessage = () => {
		const trimmed = input.trim();
		if (!trimmed && attachments.length === 0) {
			return;
		}

		const userText =
			trimmed || `Attached ${attachments.length} file${attachments.length > 1 ? "s" : ""}`;

		const userMessage: Message = {
			id: `u-${Date.now()}`,
			role: "user",
			text: userText,
			time: nowTime(),
		};

		setMessages((prev) => ({
			...prev,
			[activeThreadId]: [...(prev[activeThreadId] ?? []), userMessage],
		}));

		setInput("");
		setAttachments([]);

		window.setTimeout(() => {
			const reply: Message = {
				id: `a-${Date.now()}`,
				role: "assistant",
				text: "Nice direction. I can now generate a refined component structure, responsive breakpoints, and visual tokens for this page.",
				time: nowTime(),
			};

			setMessages((prev) => ({
				...prev,
				[activeThreadId]: [...(prev[activeThreadId] ?? []), reply],
			}));
		}, 700);
	};

	const pickFiles = (
		event: React.ChangeEvent<HTMLInputElement>,
		kind: Attachment["kind"],
	) => {
		const files = Array.from(event.target.files ?? []);
		if (!files.length) {
			return;
		}

		const mapped = files.map((file) => ({
			id: `${kind}-${Date.now()}-${file.name}`,
			name: file.name,
			kind,
		}));

		setAttachments((prev) => [...prev, ...mapped]);
		setAttachmentMenuOpen(false);
		event.target.value = "";
	};

	return (
		<div className="box-border h-svh overflow-hidden bg-[#ecf4ff] p-2 sm:p-3 lg:p-4">
			<div className="relative mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-[30px] border border-white/40 bg-white/65 shadow-[0_30px_120px_rgba(15,23,42,0.24)] backdrop-blur-3xl">
				<div className="pointer-events-none absolute -left-20 top-12 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.32),transparent_65%)]" />
				<div className="pointer-events-none absolute -right-16 bottom-0 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.28),transparent_62%)]" />

				<header className="relative border-b border-white/40 bg-white/45 px-4 py-4 sm:px-6">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-3">
							<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 via-sky-500 to-amber-400 shadow-lg shadow-cyan-200">
								<Bot className="h-5 w-5 text-white" />
							</div>
							<div>
								<h1 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Studio Chat</h1>
								<p className="text-xs text-slate-500 sm:text-sm">Full-page assistant workspace with premium layout</p>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<div className="hidden items-center gap-2 rounded-2xl border border-white/60 bg-white/80 px-3 py-2 md:flex">
								<Search className="h-4 w-4 text-slate-500" />
								<input
									placeholder="Search conversation"
									className="w-52 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
								/>
							</div>
							<button className="flex cursor-pointer items-center gap-2 rounded-2xl bg-linear-to-r from-cyan-500 via-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-200/70 transition hover:scale-[1.02]">
								<Sparkles className="h-4 w-4" />
								New Chat
							</button>
						</div>
					</div>
				</header>

				<div className="relative flex min-h-0 flex-1 overflow-hidden">
					<aside className="hidden min-h-0 w-80 border-r border-white/40 bg-white/35 p-4 lg:flex lg:flex-col">
						<div className="mb-3 text-xs font-semibold tracking-[0.16em] text-slate-600">THREADS</div>

						<button className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
							<Sparkles className="h-4 w-4" />
							Start New Session
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
												? "border-cyan-200 bg-white/90 shadow"
												: "border-transparent bg-white/55 hover:bg-white/85"
										}`}
									>
										<div className="mb-1 flex items-center justify-between gap-2">
											<p className="line-clamp-1 text-sm font-semibold text-slate-800">{thread.title}</p>
											<span className="text-xs text-slate-500">{thread.updatedAt}</span>
										</div>
										<p className="line-clamp-2 text-xs leading-5 text-slate-500">{thread.preview}</p>
									</button>
								);
							})}
						</div>

						<div className="mt-4 rounded-2xl border border-white/55 bg-white/80 p-3 shadow-sm">
							<p className="text-xs font-semibold text-slate-700">Creative Hint</p>
							<p className="mt-1 text-xs leading-5 text-slate-500">Use screenshots + docs together for more contextual outputs.</p>
						</div>
					</aside>

					<main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
						<div className="border-b border-white/40 bg-white/30 px-4 py-3 sm:px-6">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<h2 className="text-sm font-semibold text-slate-900 sm:text-base">
										{THREADS.find((thread) => thread.id === activeThreadId)?.title}
									</h2>
									<p className="text-xs text-slate-500">Live collaboration mode</p>
								</div>

								<div className="flex items-center gap-2">
									<button className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/60 bg-white/75 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-white">
										<Globe className="h-3.5 w-3.5" />
										Sources
									</button>
									<button className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/60 bg-white/75 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-white">
										<Sparkles className="h-3.5 w-3.5" />
										Suggestions
									</button>
								</div>
							</div>
						</div>

						<div className="border-b border-white/35 bg-white/20 px-4 py-2 sm:px-6">
							<div className="flex flex-wrap gap-2">
								{[
									"Summarize conversation",
									"Create UI steps",
									"Generate implementation plan",
								].map((chip) => (
									<button
										key={chip}
										onClick={() => setInput(chip)}
										className="cursor-pointer rounded-full border border-white/60 bg-white/80 px-3 py-1 text-xs text-slate-700 transition hover:bg-white"
									>
										{chip}
									</button>
								))}
							</div>
						</div>

						<div className="min-h-0 flex-1 overflow-y-auto bg-linear-to-b from-[#f7fbff] via-[#f0f7ff] to-[#edf6ff] px-4 py-5 sm:px-6">
							<div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
								{activeMessages.map((message) => {
									const isUser = message.role === "user";

									return (
										<div
											key={message.id}
											className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
										>
											{!isUser ? (
												<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-200">
													<Bot className="h-4 w-4" />
												</div>
											) : null}

											<div
												className={`max-w-[84%] rounded-[22px] px-4 py-3 shadow-md ${
													isUser
														? "rounded-br-md bg-linear-to-r from-cyan-500 via-sky-500 to-blue-600 text-white"
														: "rounded-tl-md border border-white/60 bg-white/85 text-slate-700"
												}`}
											>
												<p className="text-sm leading-6 sm:text-[15px]">{message.text}</p>
												<div className={`mt-1 text-[11px] ${isUser ? "text-cyan-50" : "text-slate-500"}`}>
													{message.time}
												</div>
											</div>

											{isUser ? (
												<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white">
													<User className="h-4 w-4" />
												</div>
											) : null}
										</div>
									);
								})}
							</div>
						</div>

						<div className="border-t border-white/35 bg-white/45 px-4 pb-4 pt-3 backdrop-blur-2xl sm:px-6">
							{attachments.length ? (
								<div className="mb-2 flex flex-wrap gap-1.5">
									{attachments.map((attachment) => (
										<span
											key={attachment.id}
											className="inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/85 px-2 py-1 text-[11px] text-slate-700"
										>
											{attachment.name}
											<button
												onClick={() =>
													setAttachments((prev) =>
														prev.filter((item) => item.id !== attachment.id),
													)
												}
												className="cursor-pointer rounded-full p-0.5 transition hover:bg-slate-200"
											>
												<X className="h-3 w-3" />
											</button>
										</span>
									))}
								</div>
							) : null}

							<div
								ref={attachmentAreaRef}
								className="relative z-20 overflow-visible rounded-[26px] border border-white/50 bg-[#d9e8ff]/75 p-2 shadow-[0_18px_46px_rgba(59,130,246,0.18)]"
							>
								<div className="absolute inset-0 bg-linear-to-r from-cyan-100/35 via-white/20 to-amber-100/35" />

								{attachmentMenuOpen ? (
									<div className="absolute bottom-full left-2 z-50 mb-2 w-52 rounded-2xl border border-white/60 bg-white/92 p-2 shadow-xl backdrop-blur-2xl">
										{[
											{
												label: "Documents",
												icon: FileText,
												onClick: () => docInputRef.current?.click(),
											},
											{
												label: "Photos",
												icon: Image,
												onClick: () => imageInputRef.current?.click(),
											},
											{
												label: "Media",
												icon: Globe,
												onClick: () => mediaInputRef.current?.click(),
											},
											{
												label: "All files",
												icon: FolderClosed,
												onClick: () => fileInputRef.current?.click(),
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
										className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-white/60 transition hover:bg-white"
									>
										<Paperclip className="h-4 w-4 text-slate-600" />
									</button>

									<div className="flex min-h-11 flex-1 items-center rounded-2xl border border-white/45 bg-white/85 px-3">
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
											placeholder="Message assistant..."
											className="max-h-28 w-full resize-none bg-transparent py-2 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 sm:text-[15px]"
										/>
									</div>

									<button className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-white/60 transition hover:bg-white">
										<Mic className="h-4 w-4 text-slate-600" />
									</button>
									<button
										onClick={sendMessage}
										className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 via-sky-500 to-blue-600 text-white shadow-[0_10px_24px_rgba(6,182,212,0.35)] transition hover:scale-105"
									>
										<SendHorizonal className="h-4 w-4" />
									</button>
								</div>
							</div>

							<div className="mt-2 text-[11px] text-slate-500">Model: gpt-5.3-codex</div>

							<input
								ref={docInputRef}
								type="file"
								multiple
								className="hidden"
								accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx"
								onChange={(event) => pickFiles(event, "document")}
							/>
							<input
								ref={imageInputRef}
								type="file"
								multiple
								className="hidden"
								accept="image/*"
								onChange={(event) => pickFiles(event, "image")}
							/>
							<input
								ref={mediaInputRef}
								type="file"
								multiple
								className="hidden"
								accept="audio/*,video/*"
								onChange={(event) => pickFiles(event, "media")}
							/>
							<input
								ref={fileInputRef}
								type="file"
								multiple
								className="hidden"
								onChange={(event) => pickFiles(event, "file")}
							/>
						</div>
					</main>
				</div>
			</div>
		</div>
	);
}
