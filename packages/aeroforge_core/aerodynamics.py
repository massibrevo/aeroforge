"""Versioned geometry and bounded illustrative aerodynamic inputs."""

from pydantic import BaseModel, ConfigDict, Field
from typing import Literal

from .atmosphere import CEILING, G, atmosphere


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Airframe(Contract):
    version: Literal[1] = 1
    span: float = Field(28, ge=12, le=42)
    area: float = Field(78, ge=25, le=160)
    taper: float = Field(0.36, ge=0.2, le=1)
    sweep: float = Field(22, ge=0, le=40)
    dihedral: float = Field(5, ge=0, le=12)
    length: float = Field(25, ge=12, le=46)
    width: float = Field(2.8, ge=1.3, le=6)
    tail: float = Field(1, ge=0.55, le=1.45)

    def dimensions(self):
        root = 2 * self.area / (self.span * (1 + self.taper))
        return {
            "aspect_ratio": self.span**2 / self.area,
            "root_chord": root,
            "tip_chord": root * self.taper,
        }


class Flight(Contract):
    airframe: Airframe = Field(default_factory=Airframe)
    mass: float = Field(17_500, ge=2_000, le=100_000)
    altitude: float = Field(1800, ge=0, le=CEILING)
    speed: float = Field(112, ge=25, le=240)
    cl: float = Field(0.45, ge=0, le=1.5)
    cd0: float = Field(0.025, ge=0.008, le=0.15)
    efficiency: float = Field(0.82, ge=0.45, le=1)
    throttle: float = Field(0.48, ge=0, le=1)
    thrust: float = Field(38_000, ge=1000, le=180_000)


CL_LIMIT = 1.5
MACH_LIMIT = 0.72


def compute(flight: Flight):
    air = atmosphere(flight.altitude)
    q = 0.5 * air["density"] * flight.speed**2
    k = 1 / (3.141592653589793 * flight.efficiency * flight.airframe.dimensions()["aspect_ratio"])
    cd = flight.cd0 + k * flight.cl**2
    required = flight.mass * G / (q * flight.airframe.area)
    mach = flight.speed / air["sound_speed"]
    lift, drag = q * flight.airframe.area * flight.cl, q * flight.airframe.area * cd
    thrust = flight.thrust * flight.throttle * air["density"] / 1.225
    warnings = []
    if required >= CL_LIMIT:
        warnings.append("Level trim exceeds the assumed lift limit.")
    if flight.cl >= CL_LIMIT:
        warnings.append("Imposed lift coefficient reaches the assumed lift limit.")
    if mach >= MACH_LIMIT:
        warnings.append("Outside the low-Mach drag model domain.")
    return {
        **air,
        "q": q,
        "lift": lift,
        "drag": drag,
        "mach": mach,
        "cd": cd,
        "cl_required": required,
        "ld": lift / drag,
        "thrust": thrust,
        "warnings": warnings,
        **flight.airframe.dimensions(),
    }
