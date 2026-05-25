// "use client";

// import { Bot, Menu, Mic, Paperclip, Plus, SendHorizonal, Sparkles,} from "lucide-react";

// export default function ChatUI() {
//   return (
//     <div className="flex h-screen overflow-hidden bg-gradient-to-br from-[#f4f7ff] via-[#f8fbff] to-[#eef5ff]">
//       <aside className="hidden w-[300px] flex-col border-r border-white/40 bg-white/40 backdrop-blur-3xl lg:flex">
//         <div className="flex items-center justify-between border-b border-white/30 px-6 py-5">
//           <div className="flex items-center gap-3">
//             <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-200">
//               <Bot className="h-6 w-6 text-white" />
//             </div>

//             <div>
//               <h2 className="text-base font-semibold text-slate-900">
//                 AI Assistant
//               </h2>
//               <p className="text-sm text-slate-500">
//                 Glassmorphism UI
//               </p>
//             </div>
//           </div>

//           <button className="rounded-xl p-2 transition hover:bg-white/60">
//             <Menu className="h-5 w-5 text-slate-600" />
//           </button>
//         </div>

//         <div className="p-5">
//           <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 font-medium text-white shadow-xl shadow-cyan-100 transition hover:scale-[1.02]">
//             <Plus className="h-5 w-5" />
//             New Chat
//           </button>
//         </div>

//         <div className="flex-1 overflow-y-auto px-4 pb-5">
//           {[
//             "Modern Dashboard UI",
//             "AI Landing Page",
//             "Chat Widget Design",
//             "Next.js Chatbot",
//             "Glass UI Concept",
//           ].map((chat, i) => (
//             <button
//               key={i}
//               className={`mb-3 flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left transition ${
//                 i === 0
//                   ? "bg-white/70 shadow-md backdrop-blur-xl"
//                   : "hover:bg-white/50"
//               }`}
//             >
//               <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
//                 <Sparkles className="h-4 w-4 text-cyan-600" />
//               </div>

//               <div>
//                 <h3 className="text-sm font-medium text-slate-800">
//                   {chat}
//                 </h3>

//                 <p className="text-xs text-slate-500">
//                   AI conversation
//                 </p>
//               </div>
//             </button>
//           ))}
//         </div>

//         <div className="border-t border-white/30 p-4">
//           <div className="flex items-center gap-3 rounded-2xl bg-white/60 p-3 backdrop-blur-2xl">
//             <img
//               src="https://i.pravatar.cc/100?img=12"
//               alt="User"
//               className="h-12 w-12 rounded-2xl object-cover"
//             />

//             <div className="flex-1">
//               <h4 className="text-sm font-semibold text-slate-800">
//                 Ashvin
//               </h4>

//               <p className="text-xs text-slate-500">
//                 Premium Account
//               </p>
//             </div>
//           </div>
//         </div>
//       </aside>

//       <main className="flex flex-1 flex-col">
//         <header className="border-b border-white/30 bg-white/30 px-8 py-5 backdrop-blur-3xl">
//           <div className="flex items-center justify-between">
//             <div>
//               <h1 className="text-xl font-semibold text-slate-900">
//                 Futuristic AI Chat
//               </h1>

//               <p className="mt-1 text-sm text-slate-500">
//                 Clean minimal glassmorphism design
//               </p>
//             </div>

//             <button className="rounded-2xl border border-white/40 bg-white/50 px-5 py-2 text-sm font-medium text-slate-700 backdrop-blur-xl transition hover:bg-white">
//               Upgrade
//             </button>
//           </div>
//         </header>

//         <div className="flex-1 overflow-y-auto px-6 py-10">
//           <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">

//             <div className="flex w-full items-start gap-4">
//               <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-200">
//                 <Bot className="h-5 w-5 text-white" />
//               </div>

//               <div className="max-w-[75%] rounded-[28px] rounded-tl-md border border-white/40 bg-white/60 px-6 py-5 shadow-xl backdrop-blur-3xl">
//                 <div className="mb-2 text-sm font-semibold text-slate-900">
//                   AI Assistant
//                 </div>

//                 <p className="text-[15px] leading-8 text-slate-700">
//                   Hello Ashvin 👋
//                   <br />
//                   This futuristic chatbot interface uses modern
//                   glassmorphism, balanced spacing, clean UI boxes,
//                   soft shadows, and premium light gradients.
//                 </p>
//               </div>
//             </div>

//             <div className="flex w-full justify-end">
//               <div className="flex max-w-[75%] items-end gap-4">

//                 <div className="rounded-[28px] rounded-br-md bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-5 text-white shadow-2xl shadow-cyan-200">
//                   <div className="mb-2 text-sm font-semibold">
//                     You
//                   </div>

//                   <p className="text-[15px] leading-8">
//                     Can you create a premium modern chatbot UI
//                     with proper message alignment and glass effects?
//                   </p>
//                 </div>

//                 <img
//                   src="https://i.pravatar.cc/100?img=12"
//                   alt="User"
//                   className="h-12 w-12 shrink-0 rounded-2xl object-cover shadow-md"
//                 />
//               </div>
//             </div>

//             <div className="flex w-full items-start gap-4">
//               <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-200">
//                 <Sparkles className="h-5 w-5 text-white" />
//               </div>

//               <div className="max-w-[75%] rounded-[28px] rounded-tl-md border border-white/40 bg-white/60 px-6 py-5 shadow-xl backdrop-blur-3xl">
//                 <div className="mb-3 text-sm font-semibold text-slate-900">
//                   AI Assistant
//                 </div>

//                 <div className="space-y-3 text-[15px] leading-8 text-slate-700">
//                   <p>
//                     Modern UI improvements included:
//                   </p>

//                   <ul className="space-y-2 pl-5">
//                     <li>• Proper left-right message layout</li>
//                     <li>• Better responsive structure</li>
//                     <li>• Premium glassmorphism effect</li>
//                     <li>• Cleaner spacing between messages</li>
//                     <li>• Modern futuristic shadows</li>
//                     <li>• Balanced chat bubble sizing</li>
//                   </ul>
//                 </div>
//               </div>
//             </div>

//           </div>
//         </div>

//         <div className="border-t border-white/30 bg-white/30 px-6 py-5 backdrop-blur-3xl">
//           <div className="mx-auto flex max-w-6xl items-end gap-3 rounded-[32px] border border-white/40 bg-white/60 p-3 shadow-2xl backdrop-blur-3xl">

//             <button className="flex h-12 w-12 items-center justify-center rounded-2xl transition hover:bg-white/60">
//               <Paperclip className="h-5 w-5 text-slate-500" />
//             </button>

//             <textarea
//               rows={1}
//               placeholder="Ask anything..."
//               className="max-h-40 flex-1 resize-none bg-transparent px-2 py-3 text-[15px] text-slate-700 outline-none placeholder:text-slate-400"
//             />

//             <button className="flex h-12 w-12 items-center justify-center rounded-2xl transition hover:bg-white/60">
//               <Mic className="h-5 w-5 text-slate-500" />
//             </button>

//             <button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-xl shadow-cyan-200 transition hover:scale-105">
//               <SendHorizonal className="h-5 w-5" />
//             </button>
//           </div>

//           <p className="mt-3 text-center text-xs text-slate-500">
//             AI Assistant can make mistakes. Verify important information.
//           </p>
//         </div>
//       </main>
//     </div>
//   );
// }
"use client";

import { useState } from "react";
import {
  Bot,
  MessageSquare,
  Mic,
  Paperclip,
  SendHorizonal,
  Sparkles,
  X,
} from "lucide-react";

export default function FloatingAIChatWidget() {
  const [open, setOpen] = useState(true);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="cursor-pointer group flex h-16 w-16 items-center justify-center rounded-3xl bg-linear-to-br from-cyan-500 to-blue-600 shadow-2xl shadow-cyan-200 transition-all duration-300 hover:scale-110"
        >
          <Bot className="h-7 w-7 text-white" />

          <div className="absolute inset-0 rounded-3xl bg-cyan-400/30 blur-2xl transition-all duration-300 group-hover:scale-150" />
        </button>
      )}

      {open && (
        <div className="flex h-[min(720px,85vh)] w-130 max-w-[95vw] flex-col overflow-hidden rounded-[34px] border border-white/40 bg-white/50 shadow-[0_20px_80px_rgba(15,23,42,0.12)] backdrop-blur-3xl">
          <div className="relative border-b border-white/30 bg-white/30 px-6 py-5 backdrop-blur-3xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 to-blue-600 shadow-xl shadow-cyan-200">
                  <Sparkles className="h-6 w-6 text-white" />

                  <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-400" />
                </div>

                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    AI Assistant
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Online • Glassmorphism UI
                  </p>
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl transition hover:bg-white/60"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-linear-to-b from-[#f7fbff] to-[#f3f8ff] px-5 py-6">
            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-100">
                  <Bot className="h-5 w-5 text-white" />
                </div>

                <div className="max-w-[82%] rounded-[24px] rounded-tl-md border border-white/50 bg-white/70 px-5 py-4 shadow-lg backdrop-blur-2xl">
                  <div className="mb-2 text-sm font-semibold text-slate-900">
                    AI Assistant
                  </div>

                  <p className="text-[15px] leading-7 text-slate-700">
                    Hello Ashvin 👋
                    <br />
                    This floating AI widget uses a modern light
                    glassmorphism design with premium spacing,
                    gradients, shadows, and futuristic styling.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="flex max-w-[82%] items-end gap-3">
                  {/* USER BOX */}
                  <div className="rounded-[24px] rounded-br-md bg-linear-to-r from-cyan-500 to-blue-600 px-5 py-4 text-white shadow-xl shadow-cyan-200">
                    <div className="mb-2 text-sm font-semibold">
                      You
                    </div>

                    <p className="text-[15px] leading-7">
                      Can you create a floating futuristic AI widget?
                    </p>
                  </div>

                  <img
                    src="https://i.pravatar.cc/100?img=12"
                    alt="User"
                    className="h-11 w-11 rounded-2xl object-cover shadow-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  "Generate UI",
                  "Create Dashboard",
                  "Build Landing",
                  "AI Widget",
                ].map((item, i) => (
                  <button
                    key={i}
                    className="rounded-2xl border border-white/50 bg-white/60 p-4 text-left shadow-md backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
                      <MessageSquare className="h-4 w-4 text-cyan-600" />
                    </div>

                    <h3 className="text-sm font-semibold text-slate-800">
                      {item}
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Modern AI interface design
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* <div className="border-t border-white/30 bg-white/40 p-4 backdrop-blur-3xl">
            <div className="flex items-end gap-3 rounded-[28px] border border-white/50 bg-white/70 p-3 shadow-xl backdrop-blur-2xl">
              <button className="flex h-11 w-11 items-center justify-center rounded-2xl transition hover:bg-white">
                <Paperclip className="h-5 w-5 text-slate-500" />
              </button>

              <textarea
                rows={1}
                placeholder="Ask anything..."
                className="max-h-40 flex-1 resize-none bg-transparent px-2 py-3 text-[15px] text-slate-700 outline-none placeholder:text-slate-400"
              />

              <button className="flex h-11 w-11 items-center justify-center rounded-2xl transition hover:bg-white">
                <Mic className="h-5 w-5 text-slate-500" />
              </button>

              <button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 text-white shadow-xl shadow-cyan-200 transition-all duration-300 hover:scale-105">
                <SendHorizonal className="h-5 w-5" />
              </button>
            </div>
          </div> */}
          {/* MODERN INPUT AREA */}
            <div className="relative bg-transparent px-4 pb-5 pt-4">

            <div className="relative overflow-hidden rounded-[30px] border border-white/20 bg-[#dfe9ff]/70 p-2 shadow-[0_20px_60px_rgba(59,130,246,0.15)] backdrop-blur-3xl">

                <div className="absolute inset-0 bg-linear-to-r from-cyan-100/30 via-white/10 to-blue-100/30" />

                <div className="relative flex items-center gap-2">

                <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/40 transition-all duration-300 hover:bg-white/70">
                    <Paperclip className="h-5 w-5 text-slate-600" />
                </button>

                <div className="flex h-12 flex-1 items-center rounded-2xl border border-white/30 bg-[#f8fbff]/90 px-4">

                    <textarea
                    rows={1}
                    placeholder="Ask anything..."
                    className="max-h-32 w-full resize-none bg-transparent pt-0.5 text-[15px] leading-6 text-slate-700 outline-none placeholder:text-slate-400"
                    />

                </div>

                <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/40 transition-all duration-300 hover:bg-white/70">
                    <Mic className="h-5 w-5 text-slate-600" />
                </button>

                <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 to-blue-600 shadow-[0_10px_30px_rgba(6,182,212,0.35)] transition-all duration-300 hover:scale-105">
                    <SendHorizonal className="h-5 w-5 text-white" />
                </button>

                </div>
            </div>
            </div>
        </div>
      )}
    </div>
  );
}