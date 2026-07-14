# Palworld Server Manager Custom Edition 2.2.0-CE

This is the first public Custom Edition release based on Palworld Server Manager 2.1.0.

## Added

- Reserved Slots page with multiple SteamID64 entries, roles, notes, and per-world capacity.
- Playit.gg Center and public-community-server diagnostics.
- English-first language selection and 13 complete language files.
- Language-pack validation covering all 713 current keys.
- System health checks and extended runtime metrics.
- Safer standalone installation and official-to-Custom Edition migration packages.
- Automatic manager, data, configuration, and save backups during migration.
- English and German installation documentation.

## Preserved

- World management, player tools, console, backups, scheduling, mods, Discord integration, chat, broadcast, REST API tools, crash guardian, and the remaining upstream feature set.
- Existing manager registry and registered worlds when using the migration patch.

## Important notes

- The release does not include or overwrite `Pal\Saved`.
- Reserved slots are enforced at manager/REST level; they are not native pre-login admission control.
- Packages are not code-signed and may trigger Windows SmartScreen.
- Non-English translations beyond German are machine translated and welcome community review.

## Credits

Based on the original GPL-3.0 project by [PrakashMandal-IV](https://github.com/PrakashMandal-IV), also known as [Frenzi24](https://next.nexusmods.com/profile/Frenzi24).

