# Official 2.2.0 integration audit

Base reviewed: `PrakashMandal-IV/palworld-server-manager` tag `v2.2.0`.

The Custom Edition contains every source path shipped by official 2.2.0. The
official downloadable language-pack catalog (`es`, `ja`, `zh`) is included in
addition to the 13 bundled Custom Edition locales.

The official 2.2.0 internationalization foundation is retained:

- language provider and first-run language wizard,
- language import, download and registry APIs,
- translated global and world views,
- custom language-pack guide and catalog,
- English fallback behavior.

Custom Edition additions remain layered on top: reserved-slot management,
Playit.gg configuration, extended metrics, public-safe fixtures, GitHub release
notifications and the `P-S-M Custom Manager` UI label.

This preview deliberately does not install or update a production application.
