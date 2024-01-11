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
    foreground = "#eef3f7", -- Light grayish blue
    background = "#050e13", -- Dark blue

    cursor_bg = "#e58e44", -- Warm dusky orange
    cursor_fg = "#112330", -- Dark blue
    cursor_border = "#e58e44", -- Warm dusky orange

    selection_fg = "#e58e44", -- Warm dusky orange
    selection_bg = "#112330", -- Light blue-gray

    scrollbar_thumb = "#112330", -- The color of the scrollbar "thumb"

    split = "#112330", -- The color of the split lines between panes

    ansi = {
      "#000000", -- Black
      "#ff3d00", -- Red
      "#e58e44", -- Green
      "#e0b547", -- Yellow
      "#7689d9", -- Blue
      "#8f509d", -- Magenta
      "#8fb9f4", -- Cyan
      "#eef3f7", -- White
    },
    brights = {
      "#112330", -- Black
      "#ff6347", -- Red
      "#f6aa6b", -- Green
      "#ffe56e", -- Yellow
      "#9eabe6", -- Blue
      "#b78fc2", -- Magenta
      "#a4c4ff", -- Cyan
      "#ffffff", -- White
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
