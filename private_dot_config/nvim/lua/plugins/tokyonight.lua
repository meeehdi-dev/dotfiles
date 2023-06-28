return {
  {
    "folke/tokyonight.nvim",
    opts   = {
      transparent = true,
      on_colors = function(colors)
        colors.comment = "#8899bb"
        colors.terminal_black = "#667799"
        colors.fg_dark = "#ffffff"
        colors.fg_gutter = "#556688"
        colors.bg_highlight = "#445577"
      end
    },
    config = function(_, opts)
      require("tokyonight").setup(opts)
      vim.cmd([[colorscheme tokyonight]])
    end
  }
}
