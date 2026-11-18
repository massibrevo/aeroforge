"""Power proxies using the same aerodynamic model as static calculations."""

from .aerodynamics import Flight, compute
from .atmosphere import G


def performance(flight: Flight):
    result = compute(flight)
    excess_power = (result["thrust"] - result["drag"]) * flight.speed
    return {
        **result,
        "excess_power": excess_power,
        "specific_excess_power": excess_power / (flight.mass * G),
    }
