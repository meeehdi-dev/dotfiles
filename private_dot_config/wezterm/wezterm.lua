local wezterm = require("wezterm")
local act = wezterm.action

local config = {}

if wezterm.config_builder then
  config = wezterm.config_builder()
end

config.disable_default_key_bindings = true

config.keys = {
  {
    key = "V",
    mods = "CTRL|SHIFT",
    action = act.PasteFrom("Clipboard"),
  },
}

local bg = nil

-- Windows
if wezterm.target_triple == "x86_64-pc-windows-msvc" then
  config.default_prog = { "wsl.exe", "~", "-d", "Ubuntu" }

  bg = os.getenv("userprofile") .. "\\bgs\\mayuri.jpg"
-- Unix
else
  bg = os.getenv("HOME") .. "/bgs/mayuri.jpg"
end

config.background = {
  {
    source = {
      Color = "#000000",
    },
    width = "100%",
    height = "100%",
    opacity = 0.98,
  },
  {
    source = {
      File = bg,
    },
    width = "Cover",
    height = "Cover",
    horizontal_align = "Center",
    vertical_align = "Middle",
    opacity = 0.1,
  },
}

config.color_scheme = "rose-pine"

config.hide_tab_bar_if_only_one_tab = true

config.font = wezterm.font("CaskaydiaCove Nerd Font")
config.font_size = 12.0

config.window_padding = {
  left = 0,
  right = 0,
  top = 0,
  bottom = 0,
}

config.initial_cols = 160
config.initial_rows = 48

return config
