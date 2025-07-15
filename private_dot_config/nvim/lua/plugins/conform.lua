return {
  {
    "stevearc/conform.nvim",
    opts = {
      default_format_opts = {
        lsp_format = "fallback",
        timeout_ms = 1000,
      },
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
        yaml = { "yamlfmt" },
      },
    },
    keys = {
      {
        "<leader>f",
        function()
          require("conform").format(nil, function()
            if vim.fn.exists(":LspEslintFixAll") > 0 then
              vim.cmd.LspEslintFixAll()
            end
          end)
        end,
      },
    },
  },
}
