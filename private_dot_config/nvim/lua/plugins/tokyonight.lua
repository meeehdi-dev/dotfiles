return {
  {
    "folke/tokyonight.nvim",
    opts = {
      transparent = true,
      on_highlights = function(hl, c)
        hl.Comment = {
          fg = c.dark5,
        }
        hl.LineNr = {
          fg = c.dark3,
        }
        hl.CursorLineNr = {
          fg = c.dark5,
        }
      end,
    },
    config = function(_, opts)
      require("tokyonight").setup(opts)
      vim.cmd("colorscheme tokyonight")
    end,
  },
}
