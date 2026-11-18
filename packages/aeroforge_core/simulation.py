"""Integrate a constant-mass, longitudinal point mass with path-angle feedback."""

from math import cos, radians, sin
from typing import Literal

import numpy as np
from pydantic import Field
from scipy.integrate import solve_ivp

from .aerodynamics import CL_LIMIT, MACH_LIMIT, Flight
from .atmosphere import CEILING, G, atmosphere


class Segment(Flight):
    profile: Literal["climb", "cruise"] = "climb"
    duration: int = Field(90, ge=10, le=240)


def simulate(segment: Segment):
    area = segment.airframe.area
    mass = segment.mass
    target_angle = radians(3 if segment.profile == "climb" else 0)
    k = 1 / (np.pi * segment.efficiency * segment.airframe.dimensions()["aspect_ratio"])

    def state_terms(state):
        _, altitude, speed, angle = state
        air = atmosphere(float(np.clip(altitude, 0, CEILING)))
        q_area = 0.5 * air["density"] * max(speed, 1) ** 2 * area
        desired_cl = mass * (G * cos(angle) + speed * 0.22 * (target_angle - angle)) / q_area
        return air, q_area, desired_cl

    def derivative(_, state):
        _, _, speed, angle = state
        air, q_area, desired_cl = state_terms(state)
        cl = np.clip(desired_cl, 0, CL_LIMIT)
        drag = q_area * (segment.cd0 + k * cl**2)
        thrust = segment.thrust * segment.throttle * air["density"] / 1.225
        return [
            speed * cos(angle),
            speed * sin(angle),
            (thrust - drag) / mass - G * sin(angle),
            (q_area * cl / mass - G * cos(angle)) / max(speed, 1),
        ]

    def ground(_, state):
        return state[1]

    def ceiling(_, state):
        return CEILING - state[1]

    def lift_limit(_, state):
        return CL_LIMIT - state_terms(state)[2]

    def mach_limit(_, state):
        return MACH_LIMIT - state[2] / state_terms(state)[0]["sound_speed"]

    def envelope(_, state):
        return min(state[2] - 25, 0.35 - abs(state[3]))

    events = [ground, ceiling, lift_limit, mach_limit, envelope]
    names = ["Ground contact", "Troposphere ceiling", "Lift limit", "Mach limit", "Envelope limit"]
    for event in events:
        event.terminal = True
        event.direction = -1

    initial = [0, segment.altitude, segment.speed, 0]
    for name, event in zip(names[2:], events[2:], strict=True):
        if event(0, initial) <= 0:
            raise ValueError(f"Initial state exceeds the {name.lower()}.")
    solved = solve_ivp(
        derivative,
        (0, segment.duration),
        initial,
        dense_output=True,
        events=events,
        max_step=2,
        rtol=1e-7,
        atol=1e-8,
    )
    if not solved.success or not np.isfinite(solved.y).all():
        raise ValueError("The integrator could not resolve this segment.")
    end = solved.t[-1]
    times = np.linspace(0, end, max(2, int(end * 2) + 1)) if end > 0 else np.array([0.0])
    samples = [
        {
            "t": float(t),
            "distance": float(x),
            "altitude": float(h),
            "speed": float(v),
            "angle": float(angle),
        }
        for t, (x, h, v, angle) in zip(times, solved.sol(times).T)
    ]
    reason = next((name for name, events in zip(names, solved.t_events) if len(events)), "Completed")
    return {"samples": samples, "reason": reason, "profile": segment.profile}
