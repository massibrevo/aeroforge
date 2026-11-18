# Reproducibility

Use Python 3.11–3.13 and Node 20+. Direct Python versions are pinned in
`requirements.txt`. npm dependencies and transitive versions are locked in
`apps/web/package-lock.json`. First setup needs package registry access.
No runtime network is needed for the synthetic workspace.

```sh
python scripts/bootstrap.py
python scripts/verify.py
.venv/bin/python scripts/train_baseline.py --demo --seed 42 --final
.venv/bin/python scripts/download_nasa.py
.venv/bin/python scripts/train_baseline.py --seed 42
.venv/bin/python scripts/train_baseline.py --seed 42 --final
```

On Windows use `.venv\Scripts\python.exe` for the CLI examples. To load a manually acquired archive, pass `--archive /path/to/cmapss.zip` to `download_nasa.py`.
For EDA, open Engine Health and export channel summaries and correlations
from the selected dataset's training partition. The same summary is available through `.venv/bin/python scripts/eda.py --demo` (omit `--demo` for FD001).

The demo generator seed is 173 and the default benchmark seed is 42.
A seeded permutation selects approximately 20% of the training engine IDs
for validation. Training labels use each training engine's last observed cycle
minus its current cycle. Ridge scales using only fit engines. Forest and median
consume the same feature columns without train-wide feature selection.
The current settings and sensors, cycle index, and causal sensor means over
up to ten observed cycles are the only predictors.

Each validation engine contributes one endpoint selected at 35%–85% of its
trajectory using a separate seeded random generator. These engines never
contribute samples used to fit transforms or estimators. With explicit final
evaluation, the official test set contributes one endpoint per engine with the
provided RUL labels, without refitting or reconstructing future observations.
Validation and test partitions have separate metric tables.

Each local result includes seed, provenance SHA-256, model hyperparameters,
schema, engine IDs, CPU time and per-engine residuals. The sampled CPU time
covers fitting inside the process. Peak memory is not measured. Prediction
checks the model schema, feature names, dataset and digest. Scores may vary
slightly with platform math libraries, and fit times vary by machine.
