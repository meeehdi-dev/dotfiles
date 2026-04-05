vim.pack.add({
  "https://github.com/neovim/nvim-lspconfig",
  "https://github.com/mason-org/mason.nvim",
  "https://github.com/WhoIsSethDaniel/mason-tool-installer.nvim",
})

require("mason").setup()
require("mason-tool-installer").setup({
  ensure_installed = {
    "tree-sitter-cli",

    -- lsp
    "css-lsp", -- cssls
    "eslint-lsp", -- eslint
    "eslint_d", -- eslint (daemon)
    "fish-lsp", -- fish_lsp
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
vim.lsp.enable("fish_lsp") -- fish-lsp
vim.lsp.enable("lua_ls") -- lua-language-server
vim.lsp.enable("prismals") -- prisma-language-server
vim.lsp.enable("ts_ls") -- typescript-language-server
vim.lsp.enable("vue_ls") -- vue-language-server
