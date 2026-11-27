# Historical training samples

Each JSON contains the first 1,008 valid paired readings for one turbine in the selected file, ordered by timestamp. Rows contain timestamp, wind speed (m/s) and active power. Original missing values are excluded. The UK and ENGIE times use UTC. CARE uses its anonymized dataset clock and its original power scale. CARE rows come from the source training partition. Negative power readings are retained.

| Extract | Turbine and source | Attribution and data licence |
|---|---|---|
| care.json | Farm A, asset 10, datasets/40.csv | Christian Gück and Cyriana Roelofs, [CARE](https://zenodo.org/records/15846963), extract under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| kelmarsh.json | Kelmarsh 1, 2016 SCADA export | Charlie Plumley and Roberta Takeuchi, [Kelmarsh](https://zenodo.org/records/16807551), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| penmanshiel.json | Penmanshiel 11, 2016 SCADA export | Charlie Plumley and Roberta Takeuchi, [Penmanshiel](https://zenodo.org/records/16807304), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| la-haute-borne.json | R80736, 2014–2015 ENGIE SCADA export | ENGIE, [OpenOA archive](https://github.com/NatLabRockies/OpenOA/blob/main/examples/data/la_haute_borne.zip), [Open Licence 2.0](https://www.data.gouv.fr/pages/legal/licences/etalab-2-0) |

To replace a sample, run `python3 scripts/import_training.py SOURCE INPUT TURBINE public/training/SOURCE.json`. For a ZIP, supply `--member` with the exact CSV path. Use `--limit N` for larger training windows. This panel trains a historical power baseline. Bearing alerts in the CARE replay, simulated fleet risk scores and the current MET Norway weather panel have separate inputs.

Turbine management also offers full-column historical samples from these same four sources and licences. Each metrics file contains the first 24 source records per turbine in the supplied CSV or SCADA archive. The original headers and timestamp text are preserved. Empty and missing values display as Missing. Rebuild a dataset with `python3 scripts/import_metrics.py SOURCE INPUT public/training/metrics/SOURCE.json`. CARE uses the Farm A event 40 CSV; the UK archives cover the turbines included in each 2016 export; La Haute Borne uses the OpenOA CSV subset.
