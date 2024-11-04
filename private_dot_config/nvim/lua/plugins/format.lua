return {
  {
    "stevearc/conform.nvim",
    opts = {
      formatters_by_ft = {
        css = { "prettier" },
        javascript = { "prettier" },
        javascriptreact = { "prettier" },
        json = { "jq" },
        jsonls = { "jq" },
        lua = { "stylua" },
        proto = { "buf" },
        typescript = { "prettier" },
        typescriptreact = { "prettier" },
      },
    },
  },
}
