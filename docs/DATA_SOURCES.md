# Data sources

| Provider / source | Update behavior | Access and cache | Reuse and limitations |
| --- | --- | --- | --- |
| [NASA Ames PCoE](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/) · [catalogue](https://data.nasa.gov/dataset/cmapss-jet-engine-simulated-data) · [verified ZIP mirror linked by PCoE](https://phm-datasets.s3.amazonaws.com/NASA/6.+Turbofan+Engine+Degradation+Simulation+Data+Set.zip) | Historical research snapshot | Explicit download or ZIP import. Outer ZIP contains `CMAPSSData.zip`. Cache `data/raw/fd001.zip`, with source, UTC acquisition timestamp and SHA-256 in `data/raw/<sha256>.json`. | Catalogue license unspecified. AeroForge redistributes no archive or raw trajectories. FD001 comes from a simulator under one operating condition and one degradation mode. |
| [NASA Glenn](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/earth-atmosphere-equation-english/) and [U.S. Standard Atmosphere, 1976 constants and tables](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/19760017709.pdf) | Static reference | No runtime download. Original equations implemented in SI. | Cited references support the dry standard troposphere approximation. |
| AeroForge synthetic generator | Deterministic, seed 173 | In memory. Small independent parser fixture in `data/sample/`. | Original illustrative data under the project license. No aircraft telemetry. |
| [OpenVSP](https://github.com/OpenVSP/OpenVSP) | Upstream releases | Optional external software, no integration package or cache shipped. | [NOSA 1.3](https://github.com/OpenVSP/OpenVSP/blob/main/LICENSE). No OpenVSP code or output bundled. |
| [OpenMDAO Aviary](https://github.com/OpenMDAO/Aviary) | Upstream releases | Optional external software, no integration package or cache shipped. | [Apache-2.0](https://github.com/OpenMDAO/Aviary/blob/main/LICENSE). No Aviary results bundled. |
| [NASA ASRS](https://asrs.arc.nasa.gov/search/database.html) | Ongoing voluntary submissions | Source link only. | De-identified and unverified narratives. A convenience sample has no denominator for population incident rates. |

**Dataset citation.** A. Saxena and K. Goebel (2008), *Turbofan Engine Degradation Simulation Data Set*, NASA Prognostics Data Repository, NASA Ames Research Center, Moffett Field, CA. FD001 has 100 training engines and 100 separate test engines. Its 26 columns are engine ID, cycle, three operating settings and 21 sensor channels. One provided RUL value per test engine applies to its final observed cycle. The Studio geometry and the NASA simulator are independent.

**Methods references.** [Saxena, Goebel, Simon and Eklund (2008)](https://c3.ndc.nasa.gov/dashlink/static/media/publication/2008_IEEEPHM_CMAPPSDamagePropagation.pdf) describe the degradation simulation. [Chao et al. (2021)](https://ntrs.nasa.gov/api/citations/20205001125/downloads/Run_to_Failure_Simulation_Under_Real_Flight_Conditions_Dataset.pdf) document the asymmetric scoring convention on a separate benchmark.

## Software attribution

| Direct dependency | Upstream licenses |
| --- | --- |
| FastAPI, Pydantic, Uvicorn, pytest | MIT for FastAPI, Pydantic and pytest. BSD-3-Clause for Uvicorn. |
| NumPy, SciPy, scikit-learn, joblib | BSD-3-Clause. Binary wheels may include additional notices. |
| Starlette, HTTPX | BSD-3-Clause |
| Ruff | MIT |
| React, React DOM, Three.js, React Three Fiber, Vite, frontend type declarations | MIT |
| Lucide icons | ISC |
| TypeScript, Playwright | Apache-2.0 |
| Public Sans, Barlow Condensed, IBM Plex Mono | SIL Open Font License 1.1. Notices ship in `apps/web/public/licenses/`. |

Upstream license files accompany installed distributions. The npm lockfile identifies transitive packages and their source tarballs. AeroForge publishes its source and dependency declarations. Third-party licenses apply independently to their components, and the NASA data are acquired separately.
