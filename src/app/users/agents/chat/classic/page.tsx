"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
	Bot,
	FileText,
	FolderClosed,
	Globe,
	Image,
	Mic,
	MoreVertical,
	Paperclip,
	Phone,
	Search,
	SendHorizonal,
	Sparkles,
	User,
	Video,
	X,
} from "lucide-react";

type Thread = {
	id: string;
	title: string;
	preview: string;
	updatedAt: string;
	contactName: string;
	contactStatus: string;
};

type Message = {
	id: string;
	role: "assistant" | "user";
	text: string;
	time: string;
	attachments?: Attachment[];
};

type Attachment = {
	id: string;
	name: string;
	kind: "document" | "image" | "media" | "file";
	mimeType?: string;
	previewUrl?: string;
	sizeLabel?: string;
};

const THREADS: Thread[] = [
	{
		id: "ui-rework",
		title: "UI Rework",
		preview: "Plan attractive chat page redesign",
		updatedAt: "2m",
		contactName: "Aarav Sharma",
		contactStatus: "online",
	},
	{
		id: "support-flow",
		title: "Support Flow",
		preview: "Improve chatbot reply quality",
		updatedAt: "18m",
		contactName: "Nisha Patel",
		contactStatus: "last seen 5m ago",
	},
	{
		id: "agent-prompts",
		title: "Agent Prompts",
		preview: "Create prompt templates",
		updatedAt: "1h",
		contactName: "Rohan Mehta",
		contactStatus: "typing...",
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
		<div className="overflow-hidden rounded-2xl border border-white/55 bg-white/90 shadow-sm">
			<img
				src={attachment.previewUrl}
				alt={attachment.name}
				className="h-44 w-full object-cover sm:h-52"
			/>
			<div className={`flex items-center justify-between gap-3 px-3 py-2 ${isUser ? "bg-linear-to-r from-primary to-primary-light text-white" : "bg-white text-slate-700"}`}>
				<div className="min-w-0">
					<p className="truncate text-sm font-medium">{attachment.name}</p>
					<p className={`text-[11px] ${isUser ? "text-white/75" : "text-slate-500"}`}>{attachment.sizeLabel ?? "Image"}</p>
				</div>
				<Image className="h-4 w-4 shrink-0" />
			</div>
		</div>
	);
}

function AttachmentCard({ attachment, isUser }: { attachment: Attachment; isUser: boolean }) {
	const MediaIcon = isMediaAttachment(attachment) ? Video : FileText;

	return (
		<div className={`flex items-center gap-3 rounded-2xl border px-3 py-3 shadow-sm ${isUser ? "border-white/20 bg-white/10 text-white" : "border-white/60 bg-white/90 text-slate-700"}`}>
			<div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isUser ? "bg-white/15" : "bg-primary/10"}`}>
				<MediaIcon className={`h-5 w-5 ${isUser ? "text-white" : "text-primary"}`} />
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">{attachment.name}</p>
				<p className={`text-[11px] ${isUser ? "text-white/75" : "text-slate-500"}`}>{attachment.sizeLabel ?? (isMediaAttachment(attachment) ? "Media" : "File")}</p>
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

export default function ClassicChatPage() {
	const [activeThreadId, setActiveThreadId] = useState(THREADS[0].id);
	const [messages, setMessages] = useState<Record<string, Message[]>>(INITIAL_MESSAGES);
	const [input, setInput] = useState("");
	const [userSearchOpen, setUserSearchOpen] = useState(false);
	const [userSearchText, setUserSearchText] = useState("");
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

	const activeThread = useMemo(
		() => THREADS.find((thread) => thread.id === activeThreadId) ?? THREADS[0],
		[activeThreadId],
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
			attachments: attachments.length ? attachments : undefined,
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
			mimeType: file.type || undefined,
			previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
			sizeLabel: formatFileSize(file.size),
		}));

		setAttachments((prev) => [...prev, ...mapped]);
		setAttachmentMenuOpen(false);
		event.target.value = "";
	};

	return (
		<div className="box-border h-svh overflow-hidden bg-transparent rounded-3xl p-2 sm:p-3 lg:p-2 ">
			<div className="relative mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-[20px] border border-white/40 bg-white/65 shadow-[0_30px_120px_rgba(15,23,42,0.24)] backdrop-blur-3xl">

				<div className="relative grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)] overflow-hidden ">
					<aside className="flex h-full min-h-0 flex-col overflow-hidden border-r-2 border-slate-300/70 bg-white/35 px-0">
						<div className="mb-4 min-h-18 rounded-0 border border-white/60 bg-linear-to-r from-primary/10 via-white/70 to-primary-light/10 px-3 py-3">
							<div className="flex h-full items-center gap-3">
								<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary-light shadow-lg shadow-primary/20">
                                    <Bot className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Studio Sessions</h1>
                                    <p className="text-xs text-slate-500 sm:text-sm">Manage session-wise chats</p>
                                </div>
                            </div>
						</div>
                        <div className=" px-4">
							<div className="mb-3 flex items-center gap-2 rounded-2xl border border-primary/10 bg-linear-to-r from-primary/10 via-white/60 to-primary-light/10 px-3 py-2 shadow-sm">
                                <Search className="h-4 w-4 text-slate-500" />
                                <input
                                    placeholder="Search sessions"
                                    className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                                />
                            </div>

							<button className="mb-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-primary to-primary-light px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:scale-[1.02]">
                                <Sparkles className="h-4 w-4" />
                                New Chat
                            </button>

                            <div className="mb-3 text-xs font-semibold tracking-[0.16em] text-slate-600">CHAT SESSIONS</div>

                            <div className="flex-1 space-y-2 overflow-y-auto pr-1 pb-2">
                                {THREADS.map((thread) => {
                                    const active = thread.id === activeThreadId;
                                    return (
                                        <button
                                            key={thread.id}
                                            onClick={() => setActiveThreadId(thread.id)}
                                            className={`w-full cursor-pointer rounded-2xl border p-3 text-left transition ${
                                                active
													? "border-primary/20 bg-white/90 shadow"
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

                            <div className="mt-3 shrink-0 rounded-2xl border border-white/55 bg-white/85 p-3 shadow-sm">
								<p className="text-xs font-semibold text-primary">Creative Hint</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">Use screenshots + docs together for more contextual outputs.</p>
                            </div>
                        </div>
					</aside>

					<main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
						<div className="relative min-h-18 border-b border-white/40 bg-linear-to-r from-primary/10 via-white/75 to-primary-light/10 px-4 py-3 sm:px-6">
							<div className="flex h-full items-center justify-between gap-3">
								<div className="flex min-w-0 items-center gap-3">
									<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white shadow-sm">
										<User className="h-5 w-5" />
									</div>
									<div className="min-w-0">
										<h2 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{activeThread.contactName}</h2>
										<p className="text-xs font-medium text-emerald-600">{activeThread.contactStatus}</p>
									</div>
								</div>

								<div className="flex shrink-0 items-center gap-1">
									<button
										onClick={() => setUserSearchOpen((prev) => !prev)}
										className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white/80 text-slate-600 transition hover:bg-white"
									>
										<Search className="h-4 w-4" />
									</button>
									<button className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white/80 text-slate-600 transition hover:bg-white">
										<Phone className="h-4 w-4" />
									</button>
									<button className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white/80 text-slate-600 transition hover:bg-white">
										<Video className="h-4 w-4" />
									</button>
									<button className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white/80 text-slate-600 transition hover:bg-white">
										<MoreVertical className="h-4 w-4" />
									</button>
								</div>
							</div>

							{userSearchOpen ? (
								<div className="absolute left-4 right-4 top-full z-20 mt-2 flex items-center gap-2 rounded-xl border border-gray-300/70 bg-white/95 px-3 py-2 shadow-lg shadow-slate-200/70 sm:left-6 sm:right-6">
									<Search className="h-4 w-4 text-slate-500" />
									<input
										autoFocus
										value={userSearchText}
										onChange={(event) => setUserSearchText(event.target.value)}
										onKeyDown={(event) => {
											if (event.key === "Escape") {
												setUserSearchOpen(false);
											}
										}}
										placeholder="Search messages"
										className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
									/>
									<button
										onClick={() => {
											setUserSearchOpen(false);
											setUserSearchText("");
										}}
										className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
									>
										<X className="h-4 w-4" />
									</button>
								</div>
							) : null}
						</div>

						{/* <div className="border-b border-white/35 bg-white/20 px-4 py-2 sm:px-6">
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
						</div> */}

						<div className="min-h-0 flex-1 overflow-y-auto bg-transparent px-4 py-5 sm:px-6">
							<div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
								{activeMessages.map((message) => {
									const isUser = message.role === "user";

									return (
										<div
											key={message.id}
											className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
										>
											{!isUser ? (
												<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary-light text-white shadow-md shadow-primary/20">
													<Bot className="h-4 w-4" />
												</div>
											) : null}

											<div
												className={`max-w-[84%] rounded-[22px] px-4 py-3 shadow-md ${
													isUser
														? "rounded-br-md bg-linear-to-r from-primary to-primary-light text-white"
														: "rounded-tl-md border border-white/60 bg-white/85 text-slate-700"
												}`}
											>
												{message.attachments && message.attachments.length ? (
													<AttachmentGallery attachments={message.attachments} isUser={isUser} />
												) : null}
												<p className="text-sm leading-6 sm:text-[15px]">{message.text}</p>
												<div className={`mt-1 text-[11px] ${isUser ? "text-primary-foreground/80" : "text-slate-500"}`}>
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
								className="relative z-20 overflow-visible rounded-[22px] border border-white/50 bg-transparent p-2 shadow-[0_18px_46px_rgba(109,74,255,0.18)]"
							>
								<div className="absolute inset-0 rounded-[22px] bg-linear-to-r from-primary/10 via-white/20 to-primary-light/10" />

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
												className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-primary/5 hover:text-primary"
											>
												<item.icon className="h-4 w-4 text-primary" />
												{item.label}
											</button>
										))}
									</div>
								) : null}

								<div className="relative flex items-center gap-2">
									<button
										onClick={() => setAttachmentMenuOpen((prev) => !prev)}
										className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-white/60 transition hover:bg-primary/5"
									>
										<Paperclip className="h-4 w-4 text-slate-600" />
									</button>

									<div className="flex min-h-11 flex-1 items-center rounded-2xl border border-white/45 bg-white/90 px-3">
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
											placeholder="Type a message"
											className="max-h-28 w-full resize-none bg-transparent py-2 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 sm:text-[15px]"
										/>
									</div>

									<button className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-white/60 transition hover:bg-primary/5">
										<Mic className="h-4 w-4 text-slate-600" />
									</button>
									<button
										onClick={sendMessage}
										className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-primary text-white shadow-[0_10px_24px_rgba(109,74,255,0.35)] transition hover:scale-105"
									>
										<SendHorizonal className="h-4 w-4" />
									</button>
								</div>
							</div>

							{/* <div className="mt-2 text-[11px] text-slate-500">Model: gpt-5.3-codex</div> */}

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

