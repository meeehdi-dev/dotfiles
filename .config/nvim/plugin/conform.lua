vim.pack.add({ "https://github.com/stevearc/conform.nvim" })

require("conform").setup({
  default_format_opts = {
    lsp_format = "fallback",
    timeout_ms = 1000,
  },
  formatters_by_ft = {
    css = { "prettierd" },
    fish = { "fish_indent" },
    javascript = { "prettierd" },
    javascriptreact = { "prettierd" },
    json = { "prettierd" },
    jsonc = { "prettierd" },
    jsonls = { "prettierd" },
    lua = { "stylua" },
    markdown = { "prettierd" },
    sh = { "shfmt" },
    typescript = { "prettierd" },
    typescriptreact = { "prettierd" },
    vue = { "prettierd" },
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
