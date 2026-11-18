# Contributing

Use Python 3.11–3.13 and Node 20+. Run `python scripts/bootstrap.py` and `python scripts/verify.py` before opening a pull request. Install Chromium with `npm exec --prefix apps/web -- playwright install chromium` if the machine has no detected Chrome. Report the platform, failing commands and relevant output.

For a scientific change, describe the units, source, validity limits, reference values, and effects on the existing assumptions. Add checks for changed equations or validation behavior. Keep all dataset archives and serialized models out of Git. Use a labeled synthetic fixture for ordinary automated tests.
