import { useEffect, useState } from "react";
import { Phone, PhoneOff, PhoneIncoming, ShieldAlert, Mic, MicOff, Volume2 } from "lucide-react";
import type { CallState } from "@/types";
import { useStore } from "@/store/useStore";
import { TECHNICIANS } from "@/engine/fleet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, fmtTimeSec } from "@/lib/utils";
import { SimTag } from "./bits";

export function Waveform({ active, color = "#7C3AED" }: { active: boolean; color?: string }) {
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {Array.from({ length: 22 }).map((_, i) => (
        <span key={i} className={cn("w-[3px] origin-bottom rounded-full", active && "animate-wave")} style={{ height: `${10 + ((i * 37) % 22)}px`, background: color, animationDelay: `${(i % 7) * 0.09}s`, opacity: active ? 1 : 0.3 }} />
      ))}
    </div>
  );
}

export function CallTranscript({ call, dark = false }: { call: CallState; dark?: boolean }) {
  return (
    <ul className={cn("space-y-2 text-sm", dark ? "text-white" : "text-navy")} aria-label="Call transcript">
      {call.transcript.map((l, i) => (
        <li key={i} className={cn("rounded-lg px-3 py-2", l.who === "engine" ? (dark ? "bg-white/10" : "bg-ai-soft") : l.who === "technician" ? (dark ? "bg-primary/60" : "bg-primary-50") : dark ? "bg-white/5 italic text-white/70" : "bg-slate-100 italic text-muted")}>
          <span className="mr-2 text-[10px] font-semibold uppercase opacity-70">{l.who === "engine" ? "Engine" : l.who === "technician" ? "Technician" : "System"}</span>
          {l.text}
          <span className="ml-2 text-[10px] opacity-60">{fmtTimeSec(l.ts)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Read-only status card used on the senior live-incident view. */
export function CallStatusCard({ call }: { call: CallState }) {
  const tone = call.status === "escalated" ? "crit" : call.status === "ringing" ? "warn" : "ok";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={tone}>{call.status === "ringing" ? "Ringing…" : call.status === "connected" ? "Connected" : call.status === "escalated" ? "Escalated — dispatch stopped" : "Ended"}</Badge>
        <SimTag label="Simulated call" />
      </div>
      <ol className="space-y-1.5 text-sm">
        {call.attempts.map((a, i) => {
          const t = TECHNICIANS.find((x) => x.id === a.techId)!;
          const label = { ringing: "Ringing", declined: "Declined", no_answer: "No answer", answered: "Accepted" }[a.outcome];
          const v = a.outcome === "answered" ? "ok" : a.outcome === "ringing" ? "warn" : "crit";
          return (
            <li key={i} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
              <span>Attempt {i + 1} · {t.name}</span><Badge variant={v}>{label}</Badge>
            </li>
          );
        })}
      </ol>
      <CallTranscript call={call} />
    </div>
  );
}

/** Full-screen simulated incoming call for the technician role. */
export function IncomingCallOverlay() {
  const call = useStore((s) => s.call);
  const candidates = useStore((s) => s.candidates);
  const respond = useStore((s) => s.callRespond);
  const [secs, setSecs] = useState(25);
  const ringing = call?.status === "ringing";
  const attemptKey = call?.candidateIdx ?? -1;
  useEffect(() => {
    if (!ringing) return;
    setSecs(25);
    const t = setInterval(() => setSecs((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [ringing, attemptKey]);
  useEffect(() => {
    if (ringing && secs <= 0) respond("timeout");
  }, [secs, ringing, respond]);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { if (ringing) setDismissed(false); }, [ringing, attemptKey]);
  if (!call || dismissed || (call.status !== "ringing" && call.status !== "connected")) return null;
  const cur = candidates.filter((c) => c.qualified)[call.candidateIdx];
  return (
    <div role="dialog" aria-modal="true" aria-label="Incoming emergency call (simulated)" className="fixed inset-0 z-[80] flex flex-col items-center bg-gradient-to-b from-[#1b0f3a] via-[#2a1250] to-navy px-5 pb-8 pt-12 text-white animate-fadeIn">
      <SimTag label="Simulated call — no real telephony" className="border-white/30 text-white/70" />
      <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-red-300">Emergency dispatch</p>
      <div className="relative mt-5 grid h-24 w-24 place-items-center">
        {call.status === "ringing" && <><span className="absolute h-full w-full rounded-full bg-red-500/40 animate-pulseRing" /><span className="absolute h-full w-full rounded-full bg-red-500/30 animate-pulseRing [animation-delay:.5s]" /></>}
        <span className="relative grid h-20 w-20 place-items-center rounded-full bg-ai text-white"><ShieldAlert className="h-9 w-9" /></span>
      </div>
      <h2 className="mt-4 text-xl font-semibold">Team CGX · Unified Engine</h2>
      <p className="text-sm text-white/70">{call.status === "ringing" ? `Calling ${cur?.tech.name ?? "technician"} · ${call.turbineId}` : "Connected"}</p>
      {call.status === "ringing" && <p className="mt-1 text-xs tabular-nums text-white/60">Auto-escalates to next candidate in {Math.max(0, secs)}s</p>}
      {call.status === "connected" && <div className="mt-3"><Waveform active color="#C4B5FD" /></div>}
      <div className="mt-6 w-full max-w-md flex-1 overflow-y-auto rounded-xl bg-black/20 p-3">
        {call.status === "ringing" ? (
          <p className="text-sm text-white/80">“{call.turbineId} critical bearing alert. Qualified, on-call, nearest to site. Answer to accept the emergency assignment. No work may start before permit-to-work and safety clearance are confirmed.”</p>
        ) : <CallTranscript call={call} dark />}
      </div>
      <div className="mt-5 flex w-full max-w-md items-center justify-around">
        {call.status === "ringing" ? (
          <>
            <button onClick={() => respond("decline")} className="grid h-16 w-16 place-items-center rounded-full bg-crit text-white shadow-pop active:scale-95" aria-label="Decline call"><PhoneOff className="h-7 w-7" /></button>
            <button onClick={() => respond("accept")} className="grid h-16 w-16 place-items-center rounded-full bg-ok text-white shadow-pop active:scale-95 animate-pulse" aria-label="Answer call"><Phone className="h-7 w-7" /></button>
          </>
        ) : (
          <Button variant="success" size="lg" onClick={() => setDismissed(true)}><PhoneIncoming className="h-5 w-5" /> Open task</Button>
        )}
      </div>
    </div>
  );
}

/** Executive voice briefing (simulated). */
export function VoiceBriefing({ lines, onEnd }: { lines: string[]; onEnd: () => void }) {
  const [shown, setShown] = useState(1);
  const [muted, setMuted] = useState(false);
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (shown >= lines.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 2600);
    return () => clearTimeout(t);
  }, [shown, lines.length]);
  const speaking = shown < lines.length;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-gradient-to-b from-[#2a1250] to-navy text-white animate-slideUp">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="flex items-center gap-2 text-xs font-semibold"><Volume2 className="h-4 w-4 text-purple-300" />Executive voice briefing</span>
        <SimTag label="Simulated call" className="border-white/30 text-white/70" />
      </div>
      <div className="flex flex-col items-center py-4">
        <Waveform active={speaking && !muted} color="#C4B5FD" />
        <p className="mt-2 text-xs tabular-nums text-white/70">{String(Math.floor(sec / 60)).padStart(2, "0")}:{String(sec % 60).padStart(2, "0")}</p>
      </div>
      <div className="max-h-52 space-y-2 overflow-y-auto px-4 text-sm" role="log" aria-live="polite">
        {lines.slice(0, shown).map((l, i) => <p key={i} className="rounded-lg bg-white/10 px-3 py-2 animate-slideUp">{l}</p>)}
      </div>
      <div className="flex items-center justify-center gap-4 p-4">
        <button onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? "Unmute" : "Mute"} className="grid h-11 w-11 place-items-center rounded-full bg-white/15 hover:bg-white/25">{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
        <button onClick={onEnd} aria-label="End call" className="grid h-12 w-12 place-items-center rounded-full bg-crit hover:bg-red-700"><PhoneOff className="h-5 w-5" /></button>
      </div>
    </div>
  );
}
