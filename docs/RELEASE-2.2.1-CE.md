# P-S-M Custom Manager 2.2.1-CE

This maintenance release packages the tested Custom Edition as a regular standalone application and as safe upgrades for existing installations.

## Changes in 2.2.1-CE

- Consistent **P-S-M Custom Manager** branding in the app title and all 13 bundled languages.
- English remains the first-launch default; the language can be changed under **Settings → Language**.
- Version metadata now matches the GitHub release so users can receive update notifications inside the manager.
- Three Windows packages are available:
  - **Standalone** for a separate installation.
  - **Official-to-Custom Edition Patch** for users of the official manager.
  - **Custom Edition Update** for existing CE installations.
- English installer output plus English and German README documentation.

## Included Custom Edition features

- Per-world reserved-slot settings with multiple SteamID64 entries, roles, names and notes.
- Playit.gg community-server configuration and diagnostics.
- 13 bundled interface languages with complete key coverage.
- CPU/RAM metrics, REST API checks, logs, backups, schedules, Discord routing, mods and administration tools.
- GitHub release checks from inside the manager.

## Safety

- No personal Steam IDs, worlds, passwords, webhook URLs, Playit endpoints or save games are included.
- Patch packages create backups before replacing manager files.
- `Pal\\Saved` is never shipped with the release and is not intentionally overwritten or deleted.

## Credits

Based on the GPL-3.0-licensed [Palworld Server Manager](https://github.com/PrakashMandal-IV/palworld-server-manager) by [PrakashMandal-IV](https://github.com/PrakashMandal-IV), also known as [Frenzi24](https://next.nexusmods.com/profile/Frenzi24).
