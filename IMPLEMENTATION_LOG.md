# Implementation log

## Aircraft Studio update · 2026-11-19

- Added four manufacturer-referenced airframe presets with backward-compatible JSON v1 import. The render includes fuselage profiles, swept and cambered wings, cabin and cockpit glazing, nacelles, intake fans and view shortcuts.
- Verified all four presets, camera controls, JSON round-trip and downstream flight calculation in Chromium. All 19 Python tests, lint, type checking, and the production build passed. The models are visual approximations with published span and overall length.

## Initial release checks

- Bootstrap completed with Python 3.12 and Node 22 on macOS arm64. Neither service requires an API key.
- `python3.12 scripts/verify.py` passed Ruff lint and format, 18 Python tests, TypeScript and Vite build, real loopback API health, and the Chrome/Playwright flow. Browser checks included all six routes, responsive layout, updated span and backend force calculation, integrated climb with playhead, synthetic and real FD001 views, a missing-data UI scenario, and training through the nonblocking API.
- Captured and visually inspected Mission Control and Flight Physics. The visual design uses the attached references through contrast, typography and geometric shapes. Public Sans, Barlow Condensed and IBM Plex Mono are bundled locally under the SIL Open Font License.
- NASA's PCoE-hosted archive was downloaded explicitly on 2026-11-18. The nested ZIP parsed as FD001 with 100 training and 100 test engines. SHA-256: `c9c5dec12a945a82e8bb4446589d7fb3cc057b5e5d81fa1a12e25ee9912ad3b2`. Ran grouped and final-endpoint scoring on both synthetic and FD001 fleets. See [benchmark results](docs/BENCHMARKS.md).
- npm audit and pip-audit found no known vulnerabilities in the installed dependency lists on 2026-11-18. npm and Python checks were run separately.

## Scope

SciPy, NumPy and scikit-learn already provide native numerical kernels. No project-specific C or C++ code was needed for the CPU-first workloads. OpenVSP, Aviary, ASRS and additional C-MAPSS subsets are documented as external or future integrations. Calibrated uncertainty, peak memory measurement and a hosted service are outside this release.
