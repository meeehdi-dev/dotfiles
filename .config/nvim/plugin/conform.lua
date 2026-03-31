local util = require("util")

vim.pack.add({ util.gh("stevearc/conform.nvim") })

require("conform").setup({
  default_format_opts = {
    lsp_format = "fallback",
    timeout_ms = 1000,
  },
  formatters_by_ft = {
    css = { "prettier" },
    fish = { "fish_indent" },
    -- gdscript = { "gdformat" },
    javascript = { "prettier" },
    javascriptreact = { "prettier" },
    json = { "prettier" },
    jsonc = { "prettier" },
    jsonls = { "prettier" },
    lua = { "stylua" },
    markdown = { "prettier" },
    sh = { "shfmt" },
    typescript = { "prettier" },
    typescriptreact = { "prettier" },
    vue = { "prettier" },
    yaml = { "yamlfmt" },
  },
})

vim.keymap.set("n", "<leader>f", function()
  require("conform").format(nil, function()
    if vim.fn.exists(":LspEslintFixAll") > 0 then
      vim.cmd.LspEslintFixAll()
    end
  end)
end)
