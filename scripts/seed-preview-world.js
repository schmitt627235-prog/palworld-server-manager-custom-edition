// Creates an isolated, non-startable profile for UI testing only.
// The caller must set PALWORLD_MANAGER_DATA_DIR to .preview-data.
const fs = require("fs");
const path = require("path");
const dbm = require("../lib/db");

const worldId = "ce-3-1-1-preview-world";
const root = path.join(process.env.PALWORLD_MANAGER_DATA_DIR || path.join(process.cwd(), ".preview-data"), "test-world");
fs.mkdirSync(path.join(root, "Pal", "Saved", "SaveGames", "0", "CE311TESTWORLD"), { recursive: true });

if (!dbm.getWorld(worldId)) {
  dbm.insertWorld({
    world_id: worldId,
    display_name: "Community Test Server",
    install_dir: root,
    game_port: 8211,
    query_port: 27015,
    rest_api_port: 8213,
    rcon_port: 25575,
    admin_password: "PREVIEW_ONLY_NOT_A_SECRET",
    rest_api_enabled: 1,
    status: "stopped",
    autostart: 0,
    crash_guard: 0,
    build_id: "preview",
    extra_args: "",
    created_at: Date.now(),
  });
  dbm.updateWorld(worldId, {
    community_server: 1,
    playit_enabled: 1,
    // RFC 5737 TEST-NET-3 address; never use a real user's endpoint in fixtures.
    playit_public_ip: "203.0.113.10",
    playit_public_port: 14815,
  });
}
dbm.saveReservedSlots(worldId, {
  enabled: false,
  reserved_slots: 1,
    message: "The remaining server slot is reserved.",
});
dbm.upsertReservedPlayer(worldId, {
  // Synthetic, non-routable fixture below the normal SteamID64 account range.
  steam_id: "76561190000000000",
  display_name: "Example Player",
  role: "owner",
  note: "Public documentation example",
  enabled: true,
});
dbm.setSetting("language", "en");
console.log(`Preview-Testwelt bereit: ${root}`);
