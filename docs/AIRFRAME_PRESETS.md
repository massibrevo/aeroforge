# Aircraft Studio presets

Aircraft Studio includes 16 commercial variants and three concept aircraft. Select a
manufacturer group in the preset dropdown, then open **Manufacturer
specifications** for the source links, published dimensions, reference take-off
mass and engine type. Published take-off masses can vary by weight variant.

| Aircraft | Span (m) | Length (m) | Height (m) | Take-off mass (kg) | Powerplant | Sources |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Boeing 737-800 | 35.80 | 39.50 | 12.50 | 79,010 | CFM56-7B | [Manufacturer](https://www.boeing.com/commercial/737ng/737-next-generation-design-highlights) · [Additional reference](https://www.boeing.com/commercial/737ng) |
| Boeing 737 MAX 8 | 35.90 | 39.50 | 12.30 | 82,640 | CFM LEAP-1B | [Manufacturer](https://www.boeing.com/commercial/737max) |
| Boeing 747-8 Intercontinental | 68.40 | 76.30 | 19.40 | 447,700 | GE GEnx-2B67 | [Manufacturer](https://www.boeing.com/content/dam/boeing/boeingdotcom/company/about_bca/startup/pdf/historical/747-8I_-_passenger.pdf) |
| Boeing 777-300ER | 64.80 | 73.90 | 18.50 | 351,530 | GE90-115B | [Manufacturer](https://www.boeing.com/commercial/777/design-highlights) |
| Boeing 787-8 | 60.12 | 56.72 | 16.92 | 227,930 | GEnx-1B or Trent 1000 | [Manufacturer](https://www.boeing.com/content/dam/boeing/v2/airports/acaps/787_Rev_P.pdf) · [Additional reference](https://www.boeing.com/commercial/787) |
| Boeing 787-9 | 60.12 | 62.81 | 17.02 | 259,220 | GEnx-1B or Trent 1000 | [Manufacturer](https://www.boeing.com/content/dam/boeing/v2/airports/acaps/787_Rev_P.pdf) · [Additional reference](https://www.boeing.com/commercial/787) |
| Airbus A220-300 | 35.10 | 38.70 | 11.50 | 70,900 | Pratt & Whitney PW1500G | [Manufacturer](https://www.aircraft.airbus.com/en/aircraft/a220/a220-300) · [Additional reference](https://www.aircraft.airbus.com/sites/g/files/jlcbta126/files/2025-12/A220-300ARP-Issue106-00-27Nov2025.pdf) |
| Airbus A319neo | 35.80 | 33.84 | 11.76 | 75,500 | LEAP-1A or PW1100G-JM | [Manufacturer](https://www.aircraft.airbus.com/en/aircraft/a320-family/a319neo) |
| Airbus A320neo | 35.80 | 37.57 | 11.76 | 79,000 | LEAP-1A or PW1100G-JM | [Manufacturer](https://www.aircraft.airbus.com/en/aircraft/a320-family/a320neo) |
| Airbus A321neo | 35.80 | 44.51 | 11.76 | 97,000 | LEAP-1A or PW1100G-JM | [Manufacturer](https://www.aircraft.airbus.com/en/aircraft/a320-family/a321neo) |
| Airbus A330-900 | 64.00 | 63.69 | 16.79 | 253,000 | Rolls-Royce Trent 7000 | [Manufacturer](https://www.aircraft.airbus.com/en/aircraft/a330/a330-900) |
| Airbus A350-900 | 64.75 | 66.80 | 17.05 | 283,000 | Rolls-Royce Trent XWB-84 | [Manufacturer](https://mediaassets.airbus.com/pm_38_898_898668-3xlxpks93j.pdf?fileName=airbus-a350-family-facts-and-figures-april-2026.pdf) |
| Airbus A350-1000 | 64.75 | 73.78 | 17.08 | 322,000 | Rolls-Royce Trent XWB-97 | [Manufacturer](https://mediaassets.airbus.com/pm_38_898_898668-3xlxpks93j.pdf?fileName=airbus-a350-family-facts-and-figures-april-2026.pdf) |
| Airbus A380-800 | 79.75 | 72.73 | 24.10 | 575,000 | Trent 900 or GP7200 | [Manufacturer](https://www.aircraft.airbus.com/sites/default/files/2025-12/AC_A380_20251201.pdf) · [Additional reference](https://www.airbus.com/sites/default/files/2025-01/airbus-a380-facts-and-figures-february-2022.pdf) |
| Embraer E195-E2 | 35.12 | 41.60 | 10.78 | 62,500 | Pratt & Whitney PW1900G | [Manufacturer](https://www.embraer.com/media/vmsjxvk5/e-jets-e2_apm_e-jetse2.pdf) · [Additional reference](https://www.embraer.com/media/q5sll1p5/e195-e2-spec.pdf) |
| ATR 72-600 | 27.05 | 27.17 | — | 23,000 | Pratt & Whitney Canada PW127XT-M | [Manufacturer](https://www.atr-aircraft.com/wp-content/uploads/2022/06/ATR_Fiche72-600-3.pdf) · [Additional reference](https://www.atr-aircraft.com/wp-content/uploads/2020/07/Factsheets_-_ATR_72-600.pdf) |

## Geometry and simulation

The procedural meshes use published overall length and wingspan. The A220-300
and A380-800 also use manufacturer-published wing reference areas. Other wing
areas and most cross sections, taper ratios, sweep, dihedral and tail stations
are modeling estimates. Doors, windows, fairings and engine shells are visual
approximations. Manufacturer diagrams and photos link from the catalog and are
not bundled.

The model name follows the surface of both sides of the fuselage on an original
AeroForge livery. Distinct features include the A380’s full double deck and its
published inner and outer nacelle stations, the 747-8’s shorter upper deck, the
737 MAX’s split winglets, the 787’s swept raked tips and chevron nacelles, and
the ATR’s high wing, T-tail and six-blade propellers.

The wing mesh uses a piecewise planform sized from the selected reference area.
The flight solver uses span and area from the selected geometry, with independent
mass, thrust and speed inputs. The close-up follow camera displays the same
airframe and livery as Aircraft Studio, with altitude and speed from the current
integration sample. The model is displayed at a larger relative scale so it is
readable along the plotted path.

The optional `profile` field identifies an aircraft in an airframe JSON v1
configuration. Previous v1 files without that field still load as generic airframes.
The shared catalog feeds the preset API and renderer from one source.
