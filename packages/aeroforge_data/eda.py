"""Reproducible summaries for the selected fleet partition."""

import numpy as np

from .cmapss import CHANNELS


def summarize(group):
    data = np.vstack(list(group.values()))[:, 2:]
    std = data.std(axis=0)
    active = std > 1e-10
    correlation = np.zeros((len(CHANNELS), len(CHANNELS)))
    if active.any():
        correlation[np.ix_(active, active)] = np.corrcoef(data[:, active].T)
    by_unit = np.vstack([series[:, 2:].mean(axis=0) for series in group.values()])
    deltas = np.vstack([series[-1, 2:] - series[0, 2:] for series in group.values()])
    return {
        "engines": len(group),
        "cycles": len(data),
        "channel_order": CHANNELS,
        "correlation": correlation.tolist(),
        "channels": [
            {
                "name": name,
                "quantiles": np.quantile(data[:, i], [0, 0.25, 0.5, 0.75, 1]).tolist(),
                "std": float(std[i]),
                "between_engine_std": float(by_unit[:, i].std()),
                "mean_first_to_last": float(deltas[:, i].mean()),
                "stable": not bool(active[i]),
            }
            for i, name in enumerate(CHANNELS)
        ],
    }
