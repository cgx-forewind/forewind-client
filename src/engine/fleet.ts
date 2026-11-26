import type { TurbineSeed, Technician } from "@/types";
import { mulberry32 } from "./rng";

// Synthetic wind farm. Names/locations are fictional. NOT SKF data.
export const SITE_NAME = "Nordhavn Ridge (simulated site)";
export const FOCUS_YELLOW = "WT-07";
export const FOCUS_RED = "WT-03";
const DAY = 86400000;
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function buildFleet(): TurbineSeed[] {
  const r = mulberry32(42);
  const list: TurbineSeed[] = [];
  const rows = [
    { site: "North Ridge", y: 22 },
    { site: "Central Ridge", y: 50 },
    { site: "South Ridge", y: 78 },
  ];
  let n = 1;
  rows.forEach((row, ri) => {
    for (let c = 0; c < 8; c++) {
      const id = `WT-${String(n).padStart(2, "0")}`;
      const base = 0.02 + r() * 0.2;
      list.push({
        id,
        site: row.site,
        x: 9 + c * 11.2 + (r() - 0.5) * 3 + ri * 1.5,
        y: row.y + (r() - 0.5) * 9 + Math.sin(c * 0.8) * 4,
        model: n % 3 === 0 ? "SG 3.4-132" : "SG 3.6-130",
        bearing: n % 2 === 0 ? "SKF main bearing, spherical roller (sim.)" : "SKF main bearing, tapered double-inner (sim.)",
        ratedKw: n % 3 === 0 ? 3400 : 3600,
        baseDegradation: base,
        lastInspection: startOfToday() - Math.round(20 + r() * 160) * DAY,
        baseStatus: "operational",
      });
      n++;
    }
  });
  // seeded non-demo states
  list[18].baseStatus = "offline"; // WT-19 grid fault
  list[21].baseStatus = "maintenance"; // WT-22 routine service
  list[10].baseDegradation = 0.31; // WT-11 watch-list (still green)
  return list;
}

export const FLEET: TurbineSeed[] = buildFleet();
export const turbineById = (id: string) => FLEET.find((t) => t.id === id);

export const TECHNICIANS: Technician[] = [
  {
    id: "T-01", name: "Omar Haddad", base: "Nordhavn depot", x: 30, y: 38, status: "available", onCall: true,
    transport: "Service van", speedKmh: 55,
    skills: ["Main bearing replacement", "Condition monitoring", "Rope access"],
    certs: ["GWO Basic Safety", "GWO Working at Heights", "SKF bearing installation (sim.)", "LV switching"],
    equipment: ["Hydraulic bearing puller", "Torque kit", "Alignment laser", "Fall-arrest set"],
    rating: 4.8, phone: "+00 555 0101", currentAssignment: null, unavailableDays: [], workloadH: 14,
  },
  {
    id: "T-02", name: "Lena Brandt", base: "Central Ridge hub", x: 58, y: 56, status: "available", onCall: true,
    transport: "4x4 pickup", speedKmh: 45,
    skills: ["Main bearing replacement", "Lubrication systems", "Vibration analysis"],
    certs: ["GWO Basic Safety", "GWO Working at Heights", "SKF bearing installation (sim.)", "Confined space"],
    equipment: ["Hydraulic bearing puller", "Torque kit", "Borescope", "Fall-arrest set"],
    rating: 4.7, phone: "+00 555 0102", currentAssignment: null, unavailableDays: [2], workloadH: 22,
  },
  {
    id: "T-03", name: "Mateo Silva", base: "South Ridge hub", x: 76, y: 84, status: "available", onCall: true,
    transport: "4x4 pickup", speedKmh: 45,
    skills: ["Main bearing replacement", "Rope access", "Blade inspection"],
    certs: ["GWO Basic Safety", "GWO Working at Heights", "SKF bearing installation (sim.)"],
    equipment: ["Torque kit", "Hydraulic bearing puller", "Fall-arrest set"],
    rating: 4.5, phone: "+00 555 0103", currentAssignment: null, unavailableDays: [0, 1], workloadH: 31,
  },
  {
    id: "T-04", name: "Aisha Rahman", base: "Mobile crew (coast)", x: 14, y: 70, status: "available", onCall: false,
    transport: "Service van", speedKmh: 55,
    skills: ["Condition monitoring", "Lubrication systems", "Gearbox service"],
    certs: ["GWO Basic Safety", "GWO Working at Heights"],
    equipment: ["Borescope", "Grease pump kit", "Fall-arrest set"],
    rating: 4.6, phone: "+00 555 0104", currentAssignment: null, unavailableDays: [], workloadH: 9,
  },
  {
    id: "T-05", name: "Jonas Weber", base: "Offshore-transfer pier", x: 92, y: 18, status: "available", onCall: true,
    transport: "Helicopter transfer", speedKmh: 180,
    skills: ["Main bearing replacement", "Rope access", "Crane coordination"],
    certs: ["GWO Basic Safety", "GWO Working at Heights", "SKF bearing installation (sim.)", "Helicopter hoist (HUET)"],
    equipment: ["Hydraulic bearing puller", "Torque kit", "Fall-arrest set", "Lift-plan kit"],
    rating: 4.9, phone: "+00 555 0105", currentAssignment: null, unavailableDays: [3], workloadH: 18,
  },
  {
    id: "T-06", name: "Priya Nair", base: "Nordhavn depot", x: 34, y: 42, status: "off_shift", onCall: false,
    transport: "Service van", speedKmh: 55,
    skills: ["Main bearing replacement", "Vibration analysis"],
    certs: ["GWO Basic Safety", "GWO Working at Heights", "SKF bearing installation (sim.)"],
    equipment: ["Torque kit", "Borescope"],
    rating: 4.4, phone: "+00 555 0106", currentAssignment: null, unavailableDays: [0, 1, 2, 3, 4, 5, 6], workloadH: 0,
  },
];

export const REQUIRED_CERTS = ["GWO Basic Safety", "GWO Working at Heights", "SKF bearing installation (sim.)"];
export const REQUIRED_SKILL = "Main bearing replacement";
export const REQUIRED_EQUIPMENT = ["Hydraulic bearing puller", "Torque kit", "Fall-arrest set"];

export const dayStart = startOfToday;
