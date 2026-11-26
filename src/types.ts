export type Role = "senior" | "executive" | "technician";
export type Risk = "green" | "yellow" | "red";
export type TurbineStatus = "operational" | "maintenance" | "offline";
export type MaintStatus = "none" | "awaiting_approval" | "scheduled" | "dispatching" | "in_progress" | "emergency";

export interface TurbineSeed {
  id: string;
  site: string;
  x: number; // 0-100 schematic map coordinates (synthetic layout)
  y: number;
  model: string;
  bearing: string;
  ratedKw: number;
  baseDegradation: number;
  lastInspection: number; // epoch ms
  baseStatus: TurbineStatus;
}

export interface TelemetryPoint {
  i: number;
  ts: number;
  label: string;
  temp: number;
  expected: number;
  residual: number;
  vibration: number;
  rpm: number;
  power: number;
  ambient: number;
  wind: number;
  anomaly: number;
  risk: number;
  riskLo: number;
  riskHi: number;
}

export interface Contribution {
  sensor: string;
  share: number; // 0-1
  note: string;
}

export interface Prediction {
  turbineId: string;
  risk: Risk;
  riskScore: number;
  anomaly: number;
  rulDays: number;
  rulLo: number;
  rulHi: number;
  failureDate: number;
  confidence: number;
  contributions: Contribution[];
  dataAgeMin: number;
  recommended: string[];
  explanation: string[];
  simulated: true;
}

export interface TurbineView extends TurbineSeed {
  status: TurbineStatus;
  maint: MaintStatus;
  risk: Risk;
  riskScore: number;
  rulDays: number | null;
  degradation: number;
  sensors: { temp: number; vibration: number; rpm: number; power: number; ambient: number };
  residual: number;
}

export interface MaintWindow {
  id: string;
  turbineId: string;
  start: number;
  end: number;
  durationH: number;
  windMs: number;
  condition: string;
  expectedMWh: number;
  priceEurMWh: number;
  lostRevenue: number;
  failureDeadline: number;
  safetyMarginH: number;
  techAvailable: number;
  checks: { id: string; label: string; ok: boolean; detail: string }[];
  eligible: boolean;
  cheapestEligible: boolean;
  rank: number | null;
  clearance: "pending" | "confirmed";
  statusLabel: string;
}

export interface Technician {
  id: string;
  name: string;
  base: string;
  x: number;
  y: number;
  status: "available" | "busy" | "off_shift";
  onCall: boolean;
  transport: "Service van" | "4x4 pickup" | "Helicopter transfer";
  speedKmh: number;
  skills: string[];
  certs: string[];
  equipment: string[];
  rating: number;
  phone: string;
  currentAssignment: string | null;
  unavailableDays: number[]; // day offsets from today
  workloadH: number;
}

export interface Candidate {
  tech: Technician;
  etaMin: number;
  distanceKm: number;
  score: number;
  qualified: boolean;
  reasons: string[];
  excluded?: string;
}

export type EventStatus = "done" | "active" | "warning" | "failed";
export interface EngineEvent {
  id: string;
  ts: number;
  step: number; // 1-13 per timeline
  title: string;
  status: EventStatus;
  explanation: string;
  details: { label: string; value: string }[];
  turbineId?: string;
  actor: "engine" | "senior" | "technician" | "executive" | "system";
}

export type AssignStatus =
  | "offered"
  | "accepted"
  | "travelling"
  | "arrived"
  | "cleared"
  | "in_progress"
  | "completed"
  | "declined";

export interface Assignment {
  id: string;
  turbineId: string;
  techId: string;
  kind: "planned" | "emergency";
  status: AssignStatus;
  windowId: string | null;
  offeredAt: number;
  acceptedAt?: number;
  etaMin: number;
  action: string;
  declineReason?: string;
  completionNotes?: string;
  findings?: string;
  history: { status: AssignStatus; ts: number }[];
}

export interface CallLine {
  who: "engine" | "technician" | "system";
  text: string;
  ts: number;
}
export interface CallState {
  turbineId: string;
  candidateIdx: number;
  attempts: { techId: string; outcome: "ringing" | "declined" | "no_answer" | "answered" }[];
  status: "ringing" | "connected" | "escalated" | "ended";
  transcript: CallLine[];
  startedAt: number;
}

export interface Notice {
  id: string;
  ts: number;
  roles: Role[];
  severity: "info" | "success" | "warning" | "critical";
  title: string;
  body: string;
  read: boolean;
  link?: string;
}

export interface Job {
  id: string;
  turbineId: string;
  kind: "planned" | "emergency";
  status: "open" | "completed";
  plannedCost: number;
  lostRevenue: number;
  reactiveCostAvoided: number;
  label: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
  refs?: { label: string; href?: string }[];
  report?: { title: string; rows: [string, string][] };
}

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone: "info" | "success" | "warning" | "critical";
}
