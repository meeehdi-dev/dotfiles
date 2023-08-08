return {
  {
    "folke/tokyonight.nvim",
    opts   = {
      transparent = true,
      on_highlights = function(hl, c)
        hl.LineNr = {
          fg = c.fg_dark,
        }
        hl.DiffAdd = {
          fg = c.hint,
          bg = c.fg_gutter,
        }
        hl.DiffChange = {
          fg = c.warning,
          bg = c.fg_gutter,
        }
        hl.DiffDelete = {
          fg = c.error,
          bg = c.fg_gutter,
        }
        hl.GitGutterAdd = {
          fg = c.hint,
          -- bg = c.fg_gutter,
        }
        hl.GitGutterChange = {
          fg = c.warning,
          -- bg = c.fg_gutter,
        }
        hl.GitGutterDelete = {
          fg = c.error,
          -- bg = c.fg_gutter,
        }
      end,
    },
    config = function(_, opts)
      require("tokyonight").setup(opts)
      vim.cmd("colorscheme tokyonight-storm")
    end
  }
}
