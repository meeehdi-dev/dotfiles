vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

-- Options
vim.opt.completeopt = "menuone,noselect"
vim.opt.cursorline = true
vim.opt.cursorlineopt = "both"
vim.opt.expandtab = true
vim.opt.ignorecase = true
vim.opt.mouse = "a"
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.shiftwidth = 2
vim.opt.signcolumn = "yes"
vim.opt.smartcase = true
vim.opt.splitbelow = true
vim.opt.splitright = true
vim.opt.tabstop = 2
vim.opt.termguicolors = true
vim.opt.timeoutlen = 500
vim.opt.updatetime = 500

-- Leader
vim.g.mapleader = " "

-- Keymaps
vim.keymap.set("n", "<Space>", "<Nop>", { silent = true }) -- Unmap space
vim.keymap.set(
  "n",
  "<Up>",
  "v:count == 0 ? 'gk' : 'k'",
  { expr = true, silent = true }
) -- Make j/k move visual line
vim.keymap.set(
  "n",
  "<Down>",
  "v:count == 0 ? 'gj' : 'j'",
  { expr = true, silent = true }
) -- Make j/k move visual line
vim.keymap.set("n", "<Esc>", "<Esc>:noh<CR>", { silent = true }) -- Clear highlights
vim.keymap.set("v", "<", "<gv") -- Keep visual selection after indent
vim.keymap.set("v", ">", ">gv") -- Keep visual selection after indent

-- Clipboard (WSL)
if vim.fn.has("wsl") == 1 then
  vim.g.clipboard = {
    name = "WslClipboard",
    copy = {
      ["+"] = "win32yank.exe -i --crlf",
      ["*"] = "win32yank.exe -i --crlf",
    },
    paste = {
      ["+"] = "win32yank.exe -o --lf",
      ["*"] = "win32yank.exe -o --lf",
    },
    cache_enabled = 0,
  }
end

-- System clipboard
vim.keymap.set("v", "Y", '"*y')

-- Macros
vim.keymap.set("n", "Q", "@q")
vim.keymap.set("x", "Q", ":norm @q<CR>")

-- LSP
vim.keymap.set("n", "<leader>r", vim.lsp.buf.rename)
vim.keymap.set("n", "<leader>h", vim.lsp.buf.hover)
vim.keymap.set("n", "<leader>a", vim.lsp.buf.code_action)

-- Diagnostics
vim.diagnostic.config({
  virtual_text = {
    prefix = "-",
  },
  severity_sort = true,
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = "",
      [vim.diagnostic.severity.WARN] = "",
      [vim.diagnostic.severity.INFO] = "",
      [vim.diagnostic.severity.HINT] = "",
    },
  },
})
vim.keymap.set("n", "<leader>d", vim.diagnostic.open_float)
vim.keymap.set("n", "<leader><Right>", vim.diagnostic.goto_next)
vim.keymap.set("n", "<leader><Left>", vim.diagnostic.goto_prev)

-- Lint & format
vim.keymap.set("n", "<leader>ff", function()
  if vim.fn.exists(":OrganizeImports") > 0 then
    vim.cmd.OrganizeImports()
  end
end)
vim.keymap.set("n", "<leader>f", function()
  if vim.fn.exists(":EslintFixAll") > 0 then
    vim.cmd.EslintFixAll()
  end
  require("conform").format({ lsp_fallback = true })
end)

-- Lazy bootstrap
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

-- Lazy init
require("lazy").setup("plugins", {
  dev = {
    path = "~/code/nvim-plugins",
    patterns = { "meeehdi-dev" },
  },
})
