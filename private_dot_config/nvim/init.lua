vim.opt.cursorline = true
vim.opt.expandtab = true
vim.opt.ignorecase = true
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.shiftwidth = 2
vim.opt.smartcase = true
vim.opt.splitbelow = true
vim.opt.splitright = true
vim.opt.tabstop = 2
vim.opt.undofile = true
vim.opt.updatetime = 1000

-- Leader
vim.g.mapleader = " "

-- Keymaps
vim.keymap.set("n", "<Space>", "<Nop>", { silent = true }) -- Unmap space
-- vim.keymap.set("n", "<Up>", "<Nop>", { silent = true }) -- Unmap up
-- vim.keymap.set("n", "<Down>", "<Nop>", { silent = true }) -- Unmap down
-- vim.keymap.set("n", "<Left>", "<Nop>", { silent = true }) -- Unmap left
-- vim.keymap.set("n", "<Right>", "<Nop>", { silent = true }) -- Unmap right

-- Remap number keys in normal mode
vim.keymap.set("n", "&", "1", { silent = true })
vim.keymap.set("n", "é", "2", { silent = true })
vim.keymap.set("n", '"', "3", { silent = true })
vim.keymap.set("n", "'", "4", { silent = true })
vim.keymap.set("n", "(", "5", { silent = true })
vim.keymap.set("n", "-", "6", { silent = true })
vim.keymap.set("n", "è", "7", { silent = true })
vim.keymap.set("n", "_", "8", { silent = true })
vim.keymap.set("n", "ç", "9", { silent = true })
vim.keymap.set("n", "à", "0", { silent = true })

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
vim.keymap.set("n", "<leader><Left>", vim.diagnostic.goto_prev)
vim.keymap.set("n", "<leader><Right>", vim.diagnostic.goto_next)

-- Lint & format
vim.keymap.set("n", "<leader>f", function()
  local progress = require("fidget.progress")
  local handle = progress.handle.create({
    title = "Formatting",
    lsp_client = { name = "format" },
  })

  -- Organize imports
  vim.lsp.buf.execute_command({
    command = "_typescript.organizeImports",
    arguments = { vim.api.nvim_buf_get_name(0) },
    title = "",
  })
  -- Lint
  if vim.fn.exists(":EslintFixAll") > 0 then
    vim.cmd.EslintFixAll()
  end
  -- Format
  require("conform").format({ timeout_ms = 1000, lsp_fallback = true })

  handle:finish()
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
