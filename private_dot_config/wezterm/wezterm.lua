local wezterm = require("wezterm")

local config = {}

if wezterm.config_builder then
  config = wezterm.config_builder()
end

local bgs = {}

if wezterm.target_triple == "x86_64-pc-windows-msvc" then
  config.default_prog = { "wsl.exe", "~", "-d", "Ubuntu" }

  local bgs_path = (os.getenv("userprofile") or "") .. "\\bgs"

  local _, stdout = wezterm.run_child_process({
    "cmd.exe",
    "/c",
    "dir",
    bgs_path,
    "/b",
  })

  for dir in stdout:gmatch("[^\r\n]+") do
    table.insert(bgs, bgs_path .. "\\" .. dir)
  end
elseif wezterm.target_triple == "aarch64-apple-darwin" then
  config.send_composed_key_when_left_alt_is_pressed = true

  local bgs_path = (os.getenv("HOME") or "") .. "/bgs"

  local _, stdout = wezterm.run_child_process({
    "ls",
    "-pa",
    bgs_path,
  })

  for dir in stdout:gmatch("[^\n]+") do
    if dir:sub(-1) ~= "/" then
      table.insert(bgs, bgs_path .. "/" .. dir)
    end
  end
end

local bg = nil
if #bgs > 0 then
  bg = bgs[math.random(#bgs)]
end

config.background = {
  {
    source = {
      Color = "#070e13",
    },
    width = "100%",
    height = "100%",
    opacity = 0.95,
  },
  {
    source = {
      File = bg,
    },
    width = "Cover",
    height = "Cover",
    horizontal_align = "Center",
    vertical_align = "Middle",
    opacity = 0.05,
  },
}

config.color_schemes = {
  ["Sunset"] = {
    foreground = "#eef3f7",
    background = "#050e13",

    cursor_bg = "#e58e44",
    cursor_fg = "#112330",
    cursor_border = "#e58e44",

    selection_fg = "#e58e44",
    selection_bg = "#112330",

    scrollbar_thumb = "#112330",

    split = "#112330",

    ansi = {
      "#000000",
      "#ff3d00",
      "#77b886",
      "#e0b547",
      "#7689d9",
      "#8f509d",
      "#8fb9f4",
      "#eef3f7",
    },
    brights = {
      "#213340",
      "#ff6347",
      "#a3d6a5",
      "#ffe56e",
      "#9eabe6",
      "#b78fc2",
      "#a4c4ff",
      "#ffffff",
    },
  },
}
config.color_scheme = "Sunset"

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
