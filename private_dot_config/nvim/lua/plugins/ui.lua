return {
  {
    {
      "rose-pine/neovim",
      name = "rose-pine",
      lazy = false,
      opts = {
        styles = {
          transparency = true,
        },
      },
      config = function(_, opts)
        require("rose-pine").setup(opts)
        vim.cmd("colorscheme rose-pine")
      end,
    },
  },
  {
    "nvim-lualine/lualine.nvim",
    event = { "BufRead", "BufWrite" },
  },
  {
    "folke/noice.nvim",
    event = "VeryLazy",
    dependencies = {
      "MunifTanjim/nui.nvim",
    },
    opts = {
      lsp = {
        override = {
          ["vim.lsp.util.convert_input_to_markdown_lines"] = true,
          ["vim.lsp.util.stylize_markdown"] = true,
          ["cmp.entry.get_documentation"] = true,
        },
      },
    },
  },
  {
    "laytan/cloak.nvim",
    event = "BufRead *.env*",
    config = true,
  },
  {
    "stevearc/dressing.nvim",
    event = "VeryLazy",
    config = true,
  },
  {
    "folke/todo-comments.nvim",
    event = "BufRead",
    dependencies = {
      "nvim-lua/plenary.nvim",
    },
    opts = {
      signs = false,
    },
  },
  {
    "j-hui/fidget.nvim",
    lazy = false,
    config = true,
  },
}
