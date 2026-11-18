# Benchmark results

Generated from the seed 42 local experiments using the protocol in [Reproducibility](REPRODUCIBILITY.md).
The holdout labels and fitted artifacts remain local. MAE and RMSE are in operating cycles.
The PHM score is an aggregate and penalizes optimistic errors more strongly.
The fit CPU times describe one execution and depend on hardware.

## Synthetic illustrative trajectories

Source archive or generated fleet SHA-256: `e36b7500ffab87678bba28d29cf0aa9fbce5b63e8f69d16d06494540316e8a7e`. Engine counts (fit / validation / test): 23 / 5 / 8. Feature schema rul-v1, scikit-learn 1.6.1.

| Estimator | Split | MAE | RMSE | PHM score | Fit CPU (s) |
| --- | --- | ---: | ---: | ---: | ---: |
| median | validation | 23.20 | 26.07 | 56.65 | 0.001 |
| median | test | 25.12 | 27.67 | 171.42 | 0.001 |
| ridge | validation | 8.42 | 8.75 | 6.36 | 0.002 |
| ridge | test | 11.26 | 12.96 | 14.33 | 0.002 |
| forest | validation | 3.04 | 3.38 | 1.67 | 1.122 |
| forest | test | 1.56 | 2.33 | 1.13 | 1.122 |

## NASA C-MAPSS FD001 (simulated)

Source archive or generated fleet SHA-256: `c9c5dec12a945a82e8bb4446589d7fb3cc057b5e5d81fa1a12e25ee9912ad3b2`. Engine counts (fit / validation / test): 80 / 20 / 100. Feature schema rul-v1, scikit-learn 1.6.1.

| Estimator | Split | MAE | RMSE | PHM score | Fit CPU (s) |
| --- | --- | ---: | ---: | ---: | ---: |
| median | validation | 34.70 | 42.85 | 5388.63 | 0.001 |
| median | test | 39.44 | 50.38 | 184065.21 | 0.001 |
| ridge | validation | 32.85 | 38.49 | 2758.61 | 0.005 |
| ridge | test | 27.85 | 33.39 | 10646.25 | 0.005 |
| forest | validation | 22.46 | 32.78 | 11605.27 | 4.619 |
| forest | test | 22.69 | 31.05 | 362564.59 | 4.619 |

On FD001, random forest had the lowest test MAE and RMSE, while ridge had the lowest test PHM score. These metrics describe different error costs on the same simulator endpoints.
