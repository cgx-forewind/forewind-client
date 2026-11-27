"""Export original SCADA columns for a bounded historical sample per turbine."""
import argparse
import csv
import io
import itertools
import json
import zipfile
from pathlib import Path
from datetime import datetime, timezone

from import_training import FORMATS


def read_file(stream, source, member, turbines, limit, training, matched):
    time_col, _, _ = FORMATS[source]
    delimiter = ";" if source == "care" else ","
    header = next(line for line in stream if line.startswith((time_col, "Wind_turbine_name,")))
    reader = csv.reader(itertools.chain([header], stream), delimiter=delimiter)
    columns = next(reader)
    key = {"care": "asset_id", "la-haute-borne": "Wind_turbine_name"}.get(source)
    key_index = columns.index(key) if key else None
    time_index = columns.index(time_col)
    for row in reader:
        if len(row) != len(columns):
            raise ValueError(f"Unexpected row width in {member}")
        turbine = row[key_index] if key_index is not None else member.split("_")[3]
        sample = turbines.setdefault(turbine, {"columns": columns, "rows": [], "file": member})
        if sample["columns"] != columns:
            raise ValueError(f"Schema changed for {turbine}")
        training_asset = training and turbine == training["turbine"]
        if training_asset and len(matched) < len(training["times"]):
            stamp = datetime.fromisoformat(row[time_index])
            if stamp.tzinfo:
                stamp = stamp.astimezone(timezone.utc).replace(tzinfo=None)
            key_time = stamp.isoformat()
            if key_time in training["times"]:
                matched[key_time] = clean(row)
        if len(sample["rows"]) < limit:
            sample["rows"].append(clean(row))
        elif key_index is None and (not training_asset or len(matched) == len(training["times"])):
            break


def clean(row):
    return [None if v.strip().lower() in {"", "nan", "na", "null"} else v for v in row]


def export(source, path, limit, training=None):
    matched = {}
    turbines = {}
    if source == "care":
        with path.open(encoding="utf-8-sig", newline="") as stream:
            read_file(stream, source, path.name, turbines, limit, training, matched)
    else:
        with zipfile.ZipFile(path) as archive:
            for member in sorted(archive.namelist()):
                if source == "la-haute-borne":
                    selected = member.startswith("la-haute-borne-data-") and member.endswith(".csv")
                else:
                    selected = member.startswith(f"Turbine_Data_{source.title()}_") and member.endswith(".csv")
                if selected:
                    with archive.open(member) as raw, io.TextIOWrapper(raw, encoding="utf-8-sig", newline="") as stream:
                        read_file(stream, source, member, turbines, limit, training, matched)
    if not turbines:
        raise ValueError("No matching turbine data")
    if training:
        turbines[training["turbine"]]["trainingRows"] = [matched[t] for t in training["times"]]
    return {"source": source, "timeColumn": FORMATS[source][0], "turbines": turbines}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", choices=FORMATS)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--limit", type=int, default=24)
    parser.add_argument("--training", type=Path, help="Include all source columns at these training timestamps")
    args = parser.parse_args()
    if args.limit < 1:
        parser.error("limit must be positive")
    training = None
    if args.training:
        baseline = json.loads(args.training.read_text())
        training = {"turbine": baseline["turbine"], "times": dict.fromkeys(row[0] for row in baseline["rows"])}
    data = export(args.source, args.input, args.limit, training)
    headers = sorted({name for t in data["turbines"].values() for name in t["columns"]})
    args.output.with_suffix(".columns.json").write_text(json.dumps(headers) + "\n")
    args.output.write_text(json.dumps(data, separators=(",", ":")) + "\n")
