return {
  {
    "neovim/nvim-lspconfig",
    dependencies = {
      {
        "mason-org/mason.nvim",
        cmd = { "Mason" },
        opts = {},
      },
      "mason-org/mason-lspconfig.nvim",
    },
    config = function()
      local mason = require("mason")
      local mason_lspconfig = require("mason-lspconfig")

      mason.setup()
      mason_lspconfig.setup({
        automatic_enable = true,
        ensure_installed = {},
      })
    end,
  },
}
