local util = require("util")

vim.pack.add({ util.gh("neovim/nvim-lspconfig") })

vim.lsp.enable("cssls")
vim.lsp.enable("eslint")
vim.lsp.enable("lua_ls")
vim.lsp.enable("pylsp")
vim.lsp.enable("ts_ls")
vim.lsp.enable("vue_ls")
-- vim.lsp.enable("oxlint")
-- vim.lsp.enable("gdscript")
