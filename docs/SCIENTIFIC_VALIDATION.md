# Scientific validation

**Research and education only — not for operational flight or maintenance decisions.**

## Dry standard troposphere

For geopotential height h between 0 and 11,000 m, AeroForge evaluates
`T = 288.15 − 0.0065h`, `p = 101325(T/288.15)^(g/(R·0.0065))`,
`ρ = p/(RT)` and `a = √(1.4RT)`. Temperature is in K, pressure in Pa,
density in kg/m³ and sound speed in m/s. Constants are g = 9.80665 m/s²
and R = 287.05287 J/(kg·K). The tests compare sea level, 5 km and 11 km
against approximate [standard atmosphere](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/19760017709.pdf)
reference values within 0.02% relative error.

## Airframe and force balance

The trapezoidal planform uses span b, area S and taper λ. Root chord
`cr = 2S/[b(1+λ)]`, tip chord `ct = λcr`, and aspect ratio `AR = b²/S`.
The displayed surface uses quarter-chord sweep and dihedral in degrees.
Fuselage and tail controls change the visual geometry. The force model uses
the supplied wing area and aspect ratio.

`q = ½ρV²` in Pa, `L = qSCL` and `D = qS[CD0 + CL²/(πeAR)]` in N.
`CL_required = mg/(qS)` assumes steady level flight. The imposed CL is an
independent static input. A density-scaled thrust proxy
`T = T_sl · throttle · ρ/1.225` yields excess power `(T − D)V` in W.
No fuel burn is inferred. Mach is `V/a`, and L/D is dimensionless.

For the default Regional aircraft, b = 28 m and S = 78 m² gives AR ≈ 10.05
and cr ≈ 4.10 m. At h = 1,800 m and V = 112 m/s, T_atm = 276.45 K,
ρ ≈ 1.027 kg/m³ and q ≈ 6.44 kPa. CL = 0.45 gives L ≈ 226 kN.
With CD0 = 0.025 and e = 0.82, CD ≈ 0.0328 and D ≈ 16.5 kN.
At 17,500 kg the level-trim coefficient is about 0.34. These are calculated
outputs from a specified input point. They do not establish aircraft performance.

## Time integration

State is horizontal distance x (m), height h (m), speed V (m/s) and flight-path
angle γ (rad). Still air, constant mass, thrust aligned with the velocity vector:

- `dx/dt = V cos γ`, `dh/dt = V sin γ`
- `dV/dt = (T − D)/m − g sin γ`
- `dγ/dt = (L/m − g cos γ)/V`

The illustrative feedback requests
`CL = m[g cos γ + 0.22 V(γ_target − γ)]/(qS)`, bounded to [0, 1.5].
The fixed target is 0° for cruise or 3° for climb. SciPy RK45 uses relative
tolerance 1e-7, absolute tolerance 1e-8 and a 2 s maximum step. Integration
ends at ground contact, 11 km, requested CL = 1.5, Mach 0.72, speed below
25 m/s, path angle outside ±0.35 rad, or elapsed duration. The trajectory
viewer scales distance and height by the same factor.

Checks include a force-balanced constant-speed cruise with analytic
`x(t) = Vt`, a climb/cruise comparison, finite ordered outputs and an altitude event.
The feedback is an illustrative numerical trim scheme. It omits wind, gusts,
actuator dynamics and aircraft-specific aerodynamic or propulsion maps.

## RUL benchmarks

No target capping is used. Predicted RUL is clamped at zero and expressed
in operating cycles. With error `d = predicted − actual`, the aggregate PHM score
sums `exp(−d/13)−1` for negative d and `exp(d/10)−1` otherwise.
MAE averages |d| and RMSE is the square root of the mean d². Large optimistic
errors can dominate the asymmetric score. See [scoring reference](https://ntrs.nasa.gov/api/citations/20205001125/downloads/Run_to_Failure_Simulation_Under_Real_Flight_Conditions_Dataset.pdf).
Protocol and reproduction commands are in [REPRODUCIBILITY.md](REPRODUCIBILITY.md).
