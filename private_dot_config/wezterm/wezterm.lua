local wezterm = require("wezterm")

local config = {}

if wezterm.config_builder then
  config = wezterm.config_builder()
end

local bg = (os.getenv("HOME") or "") .. "/bg.png"

if wezterm.target_triple == "x86_64-pc-windows-msvc" then
  config.default_prog = {"wsl.exe", "~", "-d", "Ubuntu"}
  bg = (os.getenv("userprofile") or "") .. "/bg.png"
end

config.hide_tab_bar_if_only_one_tab = true

config.color_scheme = "Tokyo Night (Gogh)"

config.background = {
  {
    source = {
      Color = "#1A1B26",
    },
    width = "100%",
    height = "100%",
    opacity = 0.95,
  },
  {
    source = {
      Gradient = {
        preset = "Viridis",
        orientation = {
          Linear = {
            angle = -30.0,
          },
        },
      },
    },
    width = "100%",
    height = "100%",
    opacity = 0.05,
  },
  {
    source = {
      File = bg
    },
    width = "Cover",
    height = "Cover",
    horizontal_align = "Center",
    vertical_align = "Middle",
    opacity = 0.05
  },
}

config.font = wezterm.font("CaskaydiaCove Nerd Font Mono")
config.font_size = 12.0

return config

