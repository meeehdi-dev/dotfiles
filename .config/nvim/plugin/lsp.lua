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
    "eslint_d", -- eslint
    "lua-language-server", -- lua_ls
    "prisma-language-server", -- prismals
    "typescript-language-server", -- ts_la
    "vue-language-server", -- vue_ls

    -- formatter
    "prettier",
    "prettierd",
    "shfmt",
    "stylua",
    "yamlfmt",
  },
  auto_update = true,
})

vim.lsp.enable("cssls") -- css-lsp
vim.lsp.enable("eslint") -- eslint_d
vim.lsp.enable("lua_ls") -- lua-language-server
vim.lsp.enable("prismals") -- prisma-language-server
vim.lsp.enable("ts_ls") -- typescript-language-server
vim.lsp.enable("vue_ls") -- vue-language-server
