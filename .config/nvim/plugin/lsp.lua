local util = require("util")

vim.pack.add({
  util.gh("neovim/nvim-lspconfig"),
  util.gh("mason-org/mason.nvim"),
  util.gh("WhoIsSethDaniel/mason-tool-installer.nvim"),
})

require("mason").setup()
require("mason-tool-installer").setup({
  ensure_installed = {
    "tree-sitter-cli",

    -- lsp
    "css-lsp", -- cssls
    "eslint-lsp", -- eslint
    "eslint_d", -- eslint (daemon)
    "lua-language-server", -- lua_ls
    "prisma-language-server", -- prismals
    "typescript-language-server", -- ts_ls
    "vue-language-server", -- vue_ls

    -- formatter
    "prettier", -- *
    "prettierd", -- * (daemon)
    "shfmt", -- shell
    "stylua", -- lua
    "yamlfmt", -- yaml
  },
  auto_update = true,
})

vim.lsp.enable("cssls") -- css-lsp
vim.lsp.enable("eslint") -- eslint-lsp
vim.lsp.enable("lua_ls") -- lua-language-server
vim.lsp.enable("prismals") -- prisma-language-server
vim.lsp.enable("ts_ls") -- typescript-language-server
vim.lsp.enable("vue_ls") -- vue-language-server
