return {
  {
    "stevearc/conform.nvim",
    opts = {
      formatters_by_ft = {
        css = { "prettier" },
        fish = { "fish_indent" },
        javascript = { "prettier" },
        javascriptreact = { "prettier" },
        json = { "jq" },
        jsonls = { "jq" },
        lua = { "stylua" },
        proto = { "buf" },
        sh = { "shfmt" },
        typescript = { "prettier" },
        typescriptreact = { "prettier" },
        vue = { "prettier" },
      },
    },
    keys = {
      {
        "<leader>f",
        function()
          require("conform").format(
            { timeout_ms = 1000, lsp_fallback = true },
            function()
              if vim.fn.exists(":EslintFixAll") > 0 then
                vim.cmd.EslintFixAll()
              end
            end
          )
        end,
      },
    },
  },
}
