"""Export a chronological single-turbine wind/power sample from a published SCADA file."""
import argparse
import csv
import itertools
import io
import json
import math
import zipfile
from contextlib import ExitStack
from datetime import datetime, timezone
from pathlib import Path

FORMATS = {
    "care": ("time_stamp", "wind_speed_3_avg", "power_30_avg"),
    "kelmarsh": ("# Date and time", "Wind speed (m/s)", "Power (kW)"),
    "penmanshiel": ("# Date and time", "Wind speed (m/s)", "Power (kW)"),
    "la-haute-borne": ("Date_time", "Ws_avg", "P_avg"),
}


def export(args):
    time_col, wind_col, power_col = FORMATS[args.source]
    with ExitStack() as stack:
        if args.member:
            archive = stack.enter_context(zipfile.ZipFile(args.input))
            stream = stack.enter_context(io.TextIOWrapper(archive.open(args.member), encoding="utf-8-sig"))
        else:
            stream = stack.enter_context(args.input.open(encoding="utf-8-sig"))
        header = next(line for line in stream if line.startswith(time_col) or line.startswith("Wind_turbine_name,"))
        rows = csv.DictReader(itertools.chain([header], stream), delimiter=";" if args.source == "care" else ",")
        samples = {}
        for row in rows:
            if args.source == "care" and (row["asset_id"] != args.turbine or row["train_test"] != "train"):
                continue
            if args.source == "la-haute-borne" and row["Wind_turbine_name"] != args.turbine:
                continue
            if args.source in ("kelmarsh", "penmanshiel"):
                if not args.member or not args.member.startswith(f"Turbine_Data_{args.source.title()}_{args.turbine}_"):
                    raise ValueError("Select the Turbine_Data archive member matching this turbine")
            try:
                wind, power = float(row[wind_col]), float(row[power_col])
            except ValueError:
                continue
            if not (math.isfinite(wind) and wind >= 0 and math.isfinite(power)):
                continue
            stamp = datetime.fromisoformat(row[time_col])
            if stamp.tzinfo:
                stamp = stamp.astimezone(timezone.utc).replace(tzinfo=None)
            samples[stamp.isoformat()] = [wind, power]
            if len(samples) == args.limit:
                break
    if len(samples) < 10:
        raise ValueError("Insufficient valid paired readings")
    data = {"turbine": args.turbine, "file": args.member or args.input.name,
            "rows": [[time, *samples[time]] for time in sorted(samples)]}
    args.output.write_text(json.dumps(data, allow_nan=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", choices=FORMATS)
    parser.add_argument("input", type=Path)
    parser.add_argument("turbine")
    parser.add_argument("output", type=Path)
    parser.add_argument("--member")
    parser.add_argument("--limit", type=int, default=1008)
    export(parser.parse_args())
