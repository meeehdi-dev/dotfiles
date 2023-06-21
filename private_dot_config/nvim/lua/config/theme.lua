require("tokyonight").setup({
  transparent = true,
  on_colors = function(colors)
    colors.comment = "#667788"
    colors.fg_dark = "#ffffff"
    colors.fg_gutter = "#556677"
    colors.bg_highlight = "#445566"
  end
})
vim.cmd [[colorscheme tokyonight]]
