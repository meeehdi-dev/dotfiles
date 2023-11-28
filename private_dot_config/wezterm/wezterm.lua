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
    "cmd.exe", "/c", "dir", bgs_path, "/b"
  })

  for dir in stdout:gmatch("[^\r\n]+")
  do
    table.insert(bgs, bgs_path .. "\\" .. dir)
  end
elseif wezterm.target_triple == "aarch64-apple-darwin" then
  config.send_composed_key_when_left_alt_is_pressed = true

  local bgs_path = (os.getenv("HOME") or "") .. "/bgs"

  local _, stdout = wezterm.run_child_process({
    "ls", "-pa", bgs_path
  })

  for dir in stdout:gmatch("[^\n]+")
  do
    if dir:sub(-1) ~= "/" then
      table.insert(bgs, bgs_path .. "/" .. dir)
    end
  end
end

local bg = nil
if #bgs > 0 then
  bg = bgs[math.random(#bgs)]
end

config.hide_tab_bar_if_only_one_tab = true

config.color_scheme = "Tokyo Night"

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
        preset = "Cividis",
        orientation = {
          Linear = {
            angle = -30.0,
          },
        },
      },
    },
    width = "100%",
    height = "100%",
    opacity = 0.15,
  },
}

if bg ~= nil then
  table.insert(config.background, {
    source = {
      File = bg
    },
    width = "Cover",
    height = "Cover",
    horizontal_align = "Center",
    vertical_align = "Middle",
    opacity = 0.15,
  })
end

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
