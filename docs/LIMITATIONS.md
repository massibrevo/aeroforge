# Limitations

- The aircraft mesh is a visual planform. No wind tunnel, CFD, structural, certification or six-degree-of-freedom analysis is performed.
- Constant-mass flight segments use fixed throttle and a simplified density-scaled thrust proxy. The model omits detailed fuel use, weather, compressibility corrections, engine maps and terrain.
- C-MAPSS FD001 is historical simulation with one operating condition and one simulated failure mode. No real-time engine data are available. The estimator has no calibrated uncertainty intervals.
- Random forest impurity importance describes splits in the fitted model. Correlations and importance do not establish physical causal mechanisms.
- OpenVSP, Aviary, ASRS and FD002–FD004 are outside this release's adapters. The local application installs no optional research tool.
- Run on loopback. Job state is in memory while completed experiments are file-backed.
