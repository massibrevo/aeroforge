# Security

Report security issues through the repository's private vulnerability reporting feature when available. Include the affected version, platform and the minimum facts needed to reproduce the issue. Avoid publishing data files, credentials, or working exploit details in public issues.

AeroForge serves a single local workspace on loopback. Its API writes imports and models into the project directory. Run it with ordinary user privileges. Saved joblib models are executable Python serialization and should come only from local AeroForge training runs. The application offers no external model upload.
