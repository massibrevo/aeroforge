"""Dry standard troposphere in SI units."""

from math import sqrt

G = 9.80665
R = 287.05287
CEILING = 11_000


def atmosphere(height: float) -> dict[str, float]:
    if not 0 <= height <= CEILING:
        raise ValueError("Altitude must be between 0 and 11,000 m.")
    temperature = 288.15 - 0.0065 * height
    pressure = 101325 * (temperature / 288.15) ** (G / (R * 0.0065))
    return {
        "temperature": temperature,
        "pressure": pressure,
        "density": pressure / (R * temperature),
        "sound_speed": sqrt(1.4 * R * temperature),
    }
