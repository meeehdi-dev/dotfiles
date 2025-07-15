return {
  {
    "nvim-treesitter/nvim-treesitter",
    lazy = false,
    build = ":TSUpdate",
    dependencies = {
      "nvim-treesitter/nvim-treesitter-textobjects",
      {
        "nvim-treesitter/nvim-treesitter-context",
        opts = {
          -- mode = "cursor",
          max_lines = 3,
          -- multiline_threshold = 1,
        },
      },
    },
    config = function()
      local configs = require("nvim-treesitter.configs")

      configs.setup({
        modules = {},
        ignore_install = {},
        auto_install = true,
        sync_install = false,
        ensure_installed = {},
        highlight = { enable = true },
        indent = { enable = true },
      })
    end,
  },
}
