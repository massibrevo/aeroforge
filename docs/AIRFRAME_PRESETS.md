# Aircraft Studio presets

| Preset | Span | Length | Visible features | Reference dimensions |
| --- | ---: | ---: | --- | --- |
| Boeing 737-800 | 35.8 m | 39.5 m | Two low-mounted nacelles with flatter lower contours and blended winglets | [Boeing 737NG](https://www.boeing.com/commercial/737ng/737-next-generation-design-highlights) |
| Boeing 747-8 Intercontinental | 68.4 m | 76.3 m | Four turbofans, upper deck, and raked tips | [Boeing 747-8 Intercontinental](https://www.boeing.com/content/dam/boeing/boeingdotcom/company/about_bca/startup/pdf/historical/747-8I_-_passenger.pdf) |
| Airbus A320neo | 35.80 m | 37.57 m | Two nacelles and sharklets | [Airbus A320neo](https://www.aircraft.airbus.com/en/aircraft/a320-family/a320neo) |
| Airbus A350-900 | 64.75 m | 66.80 m | Two wide nacelles and blended wing tips | [Airbus A350-900](https://www.aircraft.airbus.com/en/aircraft/a350/a350-900) |

These are original procedural meshes with simplified airfoil sections, cockpit
and cabin glazing, nacelles and visible fan blades. Boeing and Airbus sources
provide reference dimensions. Wing area, sweep, taper, dihedral and tail
stations in the presets are illustrative approximations. Dimensions and
appearance vary across aircraft variants and configurations.

The wing visual is a piecewise planform whose projected area is set by the
selected input. Flight Physics continues to use the equivalent trapezoid for
its displayed root and tip chords. The preset carries span and wing area into
Flight Physics. Mass, speed, drag and thrust remain independent user inputs.
AeroForge publishes no aircraft-specific performance values.

The optional `profile` field selects the visual features in an airframe JSON v1
configuration. Newly exported presets preserve that profile. Previous v1
files without the field use the generic profile when imported.
