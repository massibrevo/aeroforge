# Architecture

- `apps/web` serves the React and TypeScript UI, including a demand-rendered R3F scene, SVG plots and a Vite development proxy.
- `apps/api` exposes Pydantic request contracts, fleet trajectories, physics calculations and asynchronous RUL training. Uvicorn and Vite listen on loopback. The browser calls the API through the same-origin Vite proxy.
- `packages/aeroforge_core` holds independent SI physics, geometry, and numerical integration.
- `packages/aeroforge_data` validates FD001, generates demo fleets and computes EDA on training trajectories.
- `packages/aeroforge_ml` manages causal features, grouped evaluation and model serialization. One local worker runs at a time. Completed runs appear atomically when their artifact directory is renamed into place.

The shared v1 airframe fields are serialized as JSON. The server validates imported configurations and computes aerodynamic outputs from the same span and area used by the mesh. The three scientific domains remain separate. Only dedicated acquisition endpoints contact NASA. Archived data and prediction artifacts remain under local ignored directories.
