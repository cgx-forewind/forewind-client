"""Export original SCADA columns for a bounded historical sample per turbine."""
import argparse
import csv
import io
import itertools
import json
import zipfile
from pathlib import Path

from import_training import FORMATS


def read_file(stream, source, member, turbines, limit):
    time_col, _, _ = FORMATS[source]
    delimiter = ";" if source == "care" else ","
    header = next(line for line in stream if line.startswith((time_col, "Wind_turbine_name,")))
    reader = csv.reader(itertools.chain([header], stream), delimiter=delimiter)
    columns = next(reader)
    key = {"care": "asset_id", "la-haute-borne": "Wind_turbine_name"}.get(source)
    key_index = columns.index(key) if key else None
    for row in reader:
        if len(row) != len(columns):
            raise ValueError(f"Unexpected row width in {member}")
        turbine = row[key_index] if key_index is not None else member.split("_")[3]
        sample = turbines.setdefault(turbine, {"columns": columns, "rows": [], "file": member})
        if sample["columns"] != columns:
            raise ValueError(f"Schema changed for {turbine}")
        if len(sample["rows"]) < limit:
            sample["rows"].append([None if v.strip().lower() in {"", "nan", "na", "null"} else v for v in row])
        elif key_index is None:
            break


def export(source, path, limit):
    turbines = {}
    if source == "care":
        with path.open(encoding="utf-8-sig", newline="") as stream:
            read_file(stream, source, path.name, turbines, limit)
    else:
        with zipfile.ZipFile(path) as archive:
            for member in sorted(archive.namelist()):
                if source == "la-haute-borne":
                    selected = member.startswith("la-haute-borne-data-") and member.endswith(".csv")
                else:
                    selected = member.startswith(f"Turbine_Data_{source.title()}_") and member.endswith(".csv")
                if selected:
                    with archive.open(member) as raw, io.TextIOWrapper(raw, encoding="utf-8-sig", newline="") as stream:
                        read_file(stream, source, member, turbines, limit)
    if not turbines:
        raise ValueError("No matching turbine data")
    return {"source": source, "timeColumn": FORMATS[source][0], "turbines": turbines}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", choices=FORMATS)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--limit", type=int, default=24)
    args = parser.parse_args()
    if args.limit < 1:
        parser.error("limit must be positive")
    data = export(args.source, args.input, args.limit)
    args.output.write_text(json.dumps(data, separators=(",", ":")) + "\n")
