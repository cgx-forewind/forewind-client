import { useState } from "react";
import { Phone, FileText, Bell, Sparkles } from "lucide-react";
import type { Role } from "@/types";
import { useStore } from "@/store/useStore";
import { ChatPanel } from "@/components/common/chat";
import { VoiceBriefing } from "@/components/common/call";
import { PageHeader, SimTag } from "@/components/common/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { execSummary } from "@/pages/exec/Dashboard";
import { relTime } from "@/lib/utils";

export default function AssistantPage({ role }: { role: Role }) {
  const [voice, setVoice] = useState(false);
  const notices = useStore((s) => s.notices).filter((n) => n.roles.includes(role)).slice(0, 4);
  const send = useStore((s) => s.sendChat);
  const titles = { senior: "AI assistant", executive: "Executive AI assistant", technician: "Field assistant" };
  return (
    <div className={role === "technician" ? "space-y-3 p-3" : "page"}>
      {role !== "technician" && <PageHeader title={titles[role]} subtitle={<>Role-aware answers from the unified engine <SimTag className="ml-1" /></>} />}
      <div className={role === "technician" ? "" : "grid gap-4 lg:grid-cols-3"}>
        <Card className={role === "technician" ? "h-[calc(100vh-9rem)]" : "h-[min(70vh,640px)] lg:col-span-2"}><ChatPanel role={role} /></Card>
        {role !== "technician" && (
          <div className="space-y-4">
            {role === "executive" && (
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Phone className="h-4 w-4 text-ai" /> Voice call</CardTitle></CardHeader>
                <CardContent>{voice ? <VoiceBriefing lines={execSummary(useStore.getState())} onEnd={() => setVoice(false)} /> : (<><p className="mb-3 text-sm text-muted">Hear a 30-second business briefing. Simulated — no real telephony.</p><Button variant="ai" className="w-full" onClick={() => setVoice(true)}><Phone className="h-4 w-4" /> Start voice briefing</Button></>)}</CardContent></Card>
            )}
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Report previews</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => void send(role, role === "executive" ? "Give me an executive summary" : "Generate the two-week operations report")}><Sparkles className="h-4 w-4 text-ai" /> {role === "executive" ? "Generate executive summary" : "Generate two-week report preview"}</Button>
                <p className="text-xs text-muted">Previews appear in the conversation with supporting data links.</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> {role === "executive" ? "Proactive notifications" : "Recent alerts"}</CardTitle></CardHeader>
              <CardContent>{notices.length === 0 ? <p className="text-sm text-muted">No alerts yet.</p> : <ul className="space-y-2">{notices.map((n) => <li key={n.id} className="rounded-lg bg-slate-50 p-2.5"><p className="text-sm font-semibold leading-tight">{n.title}</p><p className="text-xs text-muted">{n.body} · {relTime(n.ts)}</p></li>)}</ul>}</CardContent></Card>
          </div>
        )}
      </div>
    </div>
  );
}
