"""Deterministic illustrative engine trajectories, independent of NASA and flight models."""

import hashlib
from functools import lru_cache

import numpy as np

from .cmapss import Fleet


@lru_cache
def demo():
    rng = np.random.default_rng(173)
    train, test, labels = {}, {}, {}
    for unit in range(1, 37):
        lifetime = int(rng.integers(100, 190))
        subgroup = train if unit <= 28 else test
        observed = lifetime if subgroup is train else int(lifetime * rng.uniform(0.44, 0.88))
        if subgroup is test:
            labels[unit] = lifetime - observed
        cycle = np.arange(1, observed + 1)
        wear = np.clip(1 - (lifetime - cycle) / 120, 0, 1)
        settings = rng.normal(0, 0.1, (observed, 3))
        gains = np.linspace(-0.5, 0.9, 21)
        sensors = (
            np.linspace(1, 4, 21)
            + wear[:, None] * gains
            + rng.normal(0, 0.04, (observed, 21))
            + rng.normal(0, 0.04, 21)
        )
        subgroup[unit] = np.column_stack([np.repeat(unit, observed), cycle, settings, sensors])
    digest = hashlib.sha256()
    for group in (train, test):
        for matrix in group.values():
            digest.update(matrix.astype("<f8", copy=False).tobytes())
    digest.update(np.array(list(labels.values()), dtype="<i8").tobytes())
    return Fleet(train, test, labels, digest.hexdigest(), "Synthetic illustrative trajectories")
