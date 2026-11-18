from math import isfinite

import pytest
from pydantic import ValidationError

from packages.aeroforge_core.aerodynamics import Airframe, Flight, compute
from packages.aeroforge_core.atmosphere import G, atmosphere
from packages.aeroforge_core.simulation import Segment, simulate
from packages.aeroforge_core.validation import REFERENCE_ATMOSPHERE


@pytest.mark.parametrize("height, expected", REFERENCE_ATMOSPHERE.items())
def test_standard_atmosphere(height, expected):
    assert atmosphere(height) == pytest.approx(expected, rel=0.0002)


def test_geometry_and_forces():
    frame = Airframe.model_validate_json(Airframe().model_dump_json())
    d = frame.dimensions()
    assert frame.span * (d["root_chord"] + d["tip_chord"]) / 2 == pytest.approx(frame.area)
    assert d["aspect_ratio"] == pytest.approx(frame.span**2 / frame.area)
    slow, fast = compute(Flight(speed=50)), compute(Flight(speed=100))
    assert fast["q"] == pytest.approx(4 * slow["q"])
    assert fast["lift"] == pytest.approx(fast["q"] * frame.area * Flight().cl)
    assert fast["drag"] == pytest.approx(fast["q"] * frame.area * fast["cd"])
    assert slow["warnings"]
    with pytest.raises(ValidationError):
        Flight(speed=0)
    with pytest.raises(ValueError):
        atmosphere(-1)


def test_exact_trim_limit():
    flight = Flight(altitude=1000, speed=95)
    cl = compute(flight)["cl_required"]
    drag = compute(flight.model_copy(update={"cl": cl}))["drag"]
    thrust = drag * 1.225 / atmosphere(1000)["density"]
    result = simulate(
        Segment(altitude=1000, speed=95, profile="cruise", throttle=1, thrust=thrust, duration=25)
    )
    end = result["samples"][-1]
    assert result["reason"] == "Completed"
    assert end["speed"] == pytest.approx(95)
    assert end["distance"] == pytest.approx(95 * 25)
    assert end["altitude"] == pytest.approx(1000, abs=1e-8)
    assert cl * compute(flight)["q"] * flight.airframe.area == pytest.approx(flight.mass * G)


def test_climb_and_envelope_events():
    climb = simulate(Segment())
    cruise = simulate(Segment(profile="cruise"))
    samples = climb["samples"]
    assert samples[-1]["altitude"] > cruise["samples"][-1]["altitude"]
    assert all(a["t"] < b["t"] for a, b in zip(samples, samples[1:]))
    assert all(isfinite(n) for s in samples for n in s.values())
    event = simulate(Segment(altitude=10990, speed=120))
    assert event["reason"] == "Troposphere ceiling"
    assert event["samples"][-1]["altitude"] == pytest.approx(11000)
    with pytest.raises(ValueError, match="Initial state"):
        simulate(Segment(speed=25))
