import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, FileText, History, Loader2, ExternalLink } from "lucide-react";
import type { Role } from "@/types";
import { useStore } from "@/store/useStore";
import { SUGGESTIONS } from "@/engine/assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/misc";
import { cn, fmtTime } from "@/lib/utils";
import { SimTag } from "./bits";

const persona: Record<Role, { title: string; sub: string; greet: string }> = {
  senior: { title: "Engine Assistant", sub: "Technical · sensors, maths, recommendations", greet: "Ask about sensor data, model reasoning, windows, technician selection, or reports." },
  executive: { title: "Executive Assistant", sub: "Business language · financial impact & risk", greet: "Ask for a summary, savings, or business risks — I keep it non-technical." },
  technician: { title: "Field Assistant", sub: "Simple, practical task help", greet: "Ask about your task, safety steps, tools or weather." },
};

export function ChatPanel({ role, compact = false }: { role: Role; compact?: boolean }) {
  const msgs = useStore((s) => s.chats[role]);
  const busy = useStore((s) => s.chatBusy);
  const send = useStore((s) => s.sendChat);
  const [text, setText] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const p = persona[role];
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [msgs.length, busy]);
  const submit = (t: string) => {
    const v = t.trim();
    if (!v || busy) return;
    setText("");
    void send(role, v);
  };
  const history = [
    "Yesterday — Sensor drift review on WT-09",
    "2 days ago — Weekly availability summary",
    "5 days ago — Bearing replacement checklist",
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-ai text-white"><Sparkles className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{p.title}</p>
          <p className="truncate text-xs text-muted">{p.sub}</p>
        </div>
        <button onClick={() => setShowHistory((v) => !v)} aria-pressed={showHistory} aria-label="Conversation history" className={cn("rounded-md p-1.5 text-muted hover:bg-slate-100", showHistory && "bg-slate-100 text-navy")}><History className="h-4 w-4" /></button>
      </div>
      {showHistory && (
        <ul className="border-b border-line bg-slate-50 px-4 py-2 text-xs text-muted animate-fadeIn">
          <li className="py-1 font-semibold uppercase tracking-wide text-[10px]">Previous conversations (sample)</li>
          {history.map((h) => <li key={h} className="py-1">{h}</li>)}
        </ul>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        {msgs.length === 0 && (
          <div className="rounded-xl bg-ai-soft/60 p-3 text-sm text-slate-700">
            {p.greet}
            <div className="mt-1"><SimTag label="Simulated engine responses" /></div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-slate-100 text-navy")}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.report && (
                <div className="mt-2 overflow-hidden rounded-lg border border-line bg-white text-navy">
                  <div className="flex items-center gap-1.5 border-b border-line bg-slate-50 px-3 py-1.5 text-xs font-semibold"><FileText className="h-3.5 w-3.5 text-primary" />{m.report.title}</div>
                  <dl className="divide-y divide-line text-xs">
                    {m.report.rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 px-3 py-1.5"><dt className="text-muted">{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>)}
                  </dl>
                </div>
              )}
              {m.refs && m.refs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.refs.map((r) => (
                    <a key={r.label} href={r.href} className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary-50"><ExternalLink className="h-3 w-3" />{r.label}</a>
                  ))}
                </div>
              )}
              <p className={cn("mt-1 text-[10px]", m.role === "user" ? "text-white/70" : "text-muted")}>{fmtTime(m.ts)}</p>
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Engine is thinking…</div>}
        <div ref={end} />
      </div>
      <div className="border-t border-line p-3">
        <div className={cn("mb-2 flex gap-1.5 overflow-x-auto pb-1", compact && "max-h-0 overflow-hidden pb-0")} aria-label="Suggested questions">
          {SUGGESTIONS[role].map((q) => (
            <button key={q} onClick={() => submit(q)} disabled={busy} className="shrink-0 rounded-full border border-line bg-white px-2.5 py-1 text-xs text-navy transition hover:border-ai hover:text-ai-ink disabled:opacity-50">{q}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); submit(text); }} className="flex gap-2">
          <Input aria-label="Message the assistant" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask the unified engine…" />
          <Button type="submit" variant="ai" size="icon" aria-label="Send" disabled={busy || !text.trim()}><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </div>
  );
}
