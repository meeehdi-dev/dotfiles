return {
  {
    "folke/tokyonight.nvim",
    opts   = {
      transparent = true,
      on_highlights = function(hl, c)
        hl.LineNr = {
          fg = c.fg_dark,
        }
        hl.CursorLineNr = {
          fg = "#ffffff",
        }
        hl.DiffAdd = {
          fg = c.hint,
          bg = c.bg_statusline,
        }
        hl.DiffChange = {
          fg = c.warning,
          bg = c.bg_statusline,
        }
        hl.DiffDelete = {
          fg = c.error,
          bg = c.bg_statusline,
        }
        hl.GitSignsAdd = {
          fg = c.hint,
        }
        hl.GitSignsChange = {
          fg = c.warning,
        }
        hl.GitSignsDelete = {
          fg = c.error,
        }
      end,
    },
    config = function(_, opts)
      require("tokyonight").setup(opts)
      vim.cmd("colorscheme tokyonight-storm")
    end
  }
}
