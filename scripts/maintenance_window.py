"""Reference handler for the simulated maintenance_window hub action."""

from datetime import datetime, timezone


def explain_window(args):
    if args.get("simulated") is not True:
        raise ValueError("Expected simulated planning data")
    windows = args["candidates"]
    required = {"wind", "weather", "margin", "tech", "lead"}

    def qualifies(window):
        checks = window["checks"]
        return required <= {c["id"] for c in checks} and all(c["ok"] is True for c in checks)

    eligible = sorted(filter(qualifies, windows),
                      key=lambda w: (w["lostRevenue"], -w["safetyMarginH"]))
    if not eligible:
        return {"text": "Simulation: no maintenance window meets all five planning checks."}
    best = eligible[0]

    def utc(ms):
        return datetime.fromtimestamp(ms / 1000, timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    text = (f"Simulation, turbine {args['turbine_id']}: {utc(best['start'])} to {utc(best['end'])}. "
            f"Estimated lost revenue €{best['lostRevenue']:,.0f}.")
    if len(eligible) > 1:
        saving = eligible[1]["lostRevenue"] - best["lostRevenue"]
        text += f" The next eligible slot costs €{saving:,.0f} more." if saving else " The next eligible slot has the same estimated cost."
    cheaper = [w for w in windows if w["lostRevenue"] < best["lostRevenue"]]
    if cheaper:
        other = min(cheaper, key=lambda w: w["lostRevenue"])
        reasons = [c["label"] for c in other["checks"] if c["ok"] is not True]
        reasons.extend(sorted(required - {c["id"] for c in other["checks"]}))
        text += f" Cheaper slot at {utc(other['start'])} excluded. Failed or missing checks: {', '.join(reasons)}."
    return {"text": text + " Site clearance is pending."}
