local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", -- latest stable release
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

-- Options
vim.opt.autoindent = true
vim.opt.expandtab = true
vim.opt.hlsearch = true
vim.opt.ignorecase = true
vim.opt.laststatus = 2
vim.opt.matchtime = 1
vim.opt.mouse = "n"
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.scrolloff = 2
vim.opt.shiftwidth = 2
vim.opt.showmatch = true
vim.opt.signcolumn = "yes"
vim.opt.smartcase = true
vim.opt.smartindent = true
vim.opt.smarttab = true
vim.opt.softtabstop = 2
vim.opt.splitbelow = true
vim.opt.splitright = true
vim.opt.tabstop = 2
vim.opt.termguicolors = true
vim.opt.title = true
vim.opt.updatetime = 100

-- Leader
vim.g.mapleader = " "

-- Diagnostics
vim.diagnostic.config({
  update_in_insert = true,
  severity_sort = true,
})

vim.fn.sign_define("DiagnosticSignError", { text = "", texthl = "DiagnosticSignError" })
vim.fn.sign_define("DiagnosticSignWarn", { text = "", texthl = "DiagnosticSignWarn" })
vim.fn.sign_define("DiagnosticSignInfo", { text = "", texthl = "DiagnosticSignInfo" })
vim.fn.sign_define("DiagnosticSignHint", { text = "", texthl = "DiagnosticSignHint" })

-- WSL Clipboard
if vim.fn.has("wsl") == 1 then
  vim.g.clipboard = {
    name = "WslClipboard",
    copy = {
      ["+"] = "clip.exe",
      ["*"] = "clip.exe",
    },
    paste = {
      ["+"] = 'powershell.exe -c [Console]::Out.Write($(Get-Clipboard -Raw).tostring().replace("`r", ""))',
      ["*"] = 'powershell.exe -c [Console]::Out.Write($(Get-Clipboard -Raw).tostring().replace("`r", ""))',
    },
    cache_enabled = 0,
  }
end
vim.keymap.set("v", "<leader>y", "\"*y")
vim.keymap.set("x", "<leader>p", "\"_dP")

vim.keymap.set("n", "<leader>t", function()
  vim.diagnostic.open_float(nil, { focus = false })
end)

vim.keymap.set("n", "<C-d>", "<C-d>zz", { remap = false })
vim.keymap.set("n", "<C-u>", "<C-u>zz", { remap = false })
vim.keymap.set("n", "<C-o>", "<C-o>zz", { remap = false })
vim.keymap.set("n", "n", "nzz", { remap = false })
vim.keymap.set("n", "N", "Nzz", { remap = false })

vim.keymap.set("x", ">", ">gv", { remap = false })
vim.keymap.set("x", "<", "<gv", { remap = false })

vim.keymap.set("n", "<F2>", vim.lsp.buf.rename)
vim.keymap.set("n", "<leader>h", vim.lsp.buf.hover)
vim.keymap.set("n", "<leader>0", vim.lsp.buf.code_action)
vim.keymap.set("n", "<C-i>", function()
  vim.lsp.buf.execute_command({ command = "_typescript.organizeImports", arguments = { vim.api.nvim_buf_get_name(0) } })
end)
vim.keymap.set("n", "<leader><Right>", vim.diagnostic.goto_next)
vim.keymap.set("n", "<leader><Left>", vim.diagnostic.goto_prev)

vim.keymap.set("n", "<PageUp>", "<nop>", { remap = false })
vim.keymap.set("n", "<PageDown>", "<nop>", { remap = false })
vim.keymap.set("i", "<C-c>", "<nop>", { remap = false })

require("lazy").setup("plugins")
