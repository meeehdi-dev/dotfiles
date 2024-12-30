return {
  {
    "folke/noice.nvim",
    dependencies = {
      "MunifTanjim/nui.nvim",
      {
        "folke/snacks.nvim",
        priority = 1000,
        lazy = false,
        opts = {
          -- TODO: cleanup
          bigfile = { enabled = true },
          -- dashboard = { enabled = true },
          indent = { enabled = true },
          input = { enabled = true },
          notifier = { enabled = true },
          quickfile = { enabled = true },
          scope = { enabled = true },
          scroll = { enabled = true },
          statuscolumn = { enabled = true },
          words = { enabled = true },
        },
      },
    },
    opts = {
      lsp = {
        override = {
          ["vim.lsp.util.convert_input_to_markdown_lines"] = true,
          ["vim.lsp.util.stylize_markdown"] = true,
        },
      },
    },
  },
}
