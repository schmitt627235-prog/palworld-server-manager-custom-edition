-- PSMChatRelay — Palworld Server Manager chat relay
--
-- Hooks the server's chat broadcast and appends every message as one JSON line to
--   Pal/Saved/psm-chat.jsonl
-- which the Palworld Server Manager app tails to display chat and relay it to Discord.
--
-- Requires UE4SS (experimental Palworld build) in Pal/Binaries/Win64.
-- The Lua working directory is Pal/Binaries/Win64, so ../../Saved reaches Pal/Saved.

local OUT_PATH = "../../Saved/psm-chat.jsonl"

-- Minimal JSON string escaping (quotes, backslashes, control chars).
local function esc(s)
    s = tostring(s or "")
    s = s:gsub("\\", "\\\\"):gsub('"', '\\"')
    s = s:gsub("\n", "\\n"):gsub("\r", "\\r"):gsub("\t", "\\t")
    return s
end

local function now_ms()
    return math.floor(os.time() * 1000)
end

local function append_line(name, channel, message)
    local ok, f = pcall(io.open, OUT_PATH, "a")
    if not ok or not f then return end
    local line = string.format(
        '{"name":"%s","channel":"%s","message":"%s","at":%d}\n',
        esc(name), esc(channel), esc(message), now_ms()
    )
    f:write(line)
    f:close()
end

-- Safely turn a UE FString/FText field into a Lua string.
local function to_str(v)
    if v == nil then return "" end
    local ok, s = pcall(function() return v:ToString() end)
    if ok and s then return s end
    return tostring(v)
end

-- Map the chat category enum to a readable channel name; best-effort.
local function channel_name(cat)
    local n = tonumber(cat)
    local map = { [0] = "Global", [1] = "Local", [2] = "Guild", [3] = "Whisper" }
    if n and map[n] then return map[n] end
    return "Global"
end

local function on_chat(self, chat_message_param)
    local ok = pcall(function()
        local msg = chat_message_param:get()
        local text = to_str(msg.Message)
        if text == "" then return end
        local name = to_str(msg.SenderName)
        if name == "" then name = to_str(msg.SenderPlayerName) end
        if name == "" then name = "Player" end
        append_line(name, channel_name(msg.Category), text)
    end)
    if not ok then
        -- swallow errors so a game update that changes the struct can't crash the server
    end
end

RegisterHook("/Script/Pal.PalGameStateInGame:BroadcastChatMessage", on_chat)

print("[PSMChatRelay] loaded — writing chat to Pal/Saved/psm-chat.jsonl\n")
