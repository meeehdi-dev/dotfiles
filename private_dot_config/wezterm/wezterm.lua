local wezterm = require("wezterm")

local config = wezterm.config_builder()

config.color_scheme = "rose-pine"
config.font = wezterm.font("Roboto Mono")
config.font_size = 14

config.enable_tab_bar = false
config.window_padding = {
	left = 0,
	right = 0,
	top = 0,
	bottom = 0,
}

config.background = {
	{
		source = {
			Color = "#191724",
		},
		width = "100%",
		height = "100%",
		opacity = 0.95,
	},
	{
		source = {
			File = "/Users/mehdi/rem.jpg",
		},
		hsb = { brightness = 0.1 },
		width = "Cover",
		height = "Cover",
		horizontal_align = "Center",
		vertical_align = "Middle",
		opacity = 0.1,
	},
}

return config
