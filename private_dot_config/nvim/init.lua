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
vim.opt.cursorline = true
vim.opt.cursorlineopt = "number"
vim.opt.expandtab = true
vim.opt.matchtime = 1
vim.opt.mouse = "n"
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.shiftwidth = 2
vim.opt.showmatch = true
vim.opt.signcolumn = "yes"
vim.opt.smartindent = true
vim.opt.splitbelow = true
vim.opt.splitright = true
vim.opt.tabstop = 2
vim.opt.termguicolors = true
vim.opt.title = true
vim.opt.updatetime = 100

-- Leader
vim.g.mapleader = " "

-- Diagnostics signs
vim.fn.sign_define(
  "DiagnosticSignError",
  { text = "", texthl = "DiagnosticSignError" }
)
vim.fn.sign_define(
  "DiagnosticSignWarn",
  { text = "", texthl = "DiagnosticSignWarn" }
)
vim.fn.sign_define(
  "DiagnosticSignInfo",
  { text = "", texthl = "DiagnosticSignInfo" }
)
vim.fn.sign_define(
  "DiagnosticSignHint",
  { text = "", texthl = "DiagnosticSignHint" }
)

-- WSL Clipboard
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
vim.keymap.set("v", "Y", '"*y')

-- Macros
vim.keymap.set("n", "Q", "@q")
vim.keymap.set("x", "Q", ":norm @q<CR>")

-- Code actions
vim.keymap.set("n", "<leader>r", vim.lsp.buf.rename)
vim.keymap.set("n", "<leader>h", vim.lsp.buf.hover)
vim.keymap.set("n", "<leader>0", vim.lsp.buf.code_action)
vim.keymap.set("n", "<leader>t", vim.diagnostic.open_float)

-- Fast navigation (diagnostics & git hunks)
vim.keymap.set("n", "<leader><Right>", vim.diagnostic.goto_next)
vim.keymap.set("n", "<leader><Left>", vim.diagnostic.goto_prev)

-- Focus
vim.keymap.set("n", "<leader><CR>", function()
  vim.api.nvim_win_set_width(0, math.floor(vim.o.columns * 0.6))
  vim.api.nvim_win_set_height(0, math.floor(vim.o.lines * 0.6))
end)

-- Format
vim.keymap.set("n", "<leader>oi", function()
  local buf_nr = vim.api.nvim_get_current_buf()
  local clients =
    vim.lsp.get_active_clients({ bufnr = buf_nr, name = "tsserver" })
  if next(clients) == nil then
    return
  end

  vim.lsp.buf.execute_command({
    command = "_typescript.organizeImports",
    arguments = { vim.api.nvim_buf_get_name(0) },
  })
end)
vim.keymap.set("n", "<leader>f", function()
  local buf_ft = vim.api.nvim_buf_get_option(0, "filetype")
  if buf_ft == "json" then
    vim.cmd(":%!jq '.'")
  else
    local formatted = require("conform").format()
    if not formatted then
      vim.lsp.buf.format()
    end
  end
end)
vim.keymap.set("n", "<leader>fs", function()
  local buf_ft = vim.api.nvim_buf_get_option(0, "filetype")
  if buf_ft == "json" then
    vim.cmd(":%!jq --sort-keys '.'")
  end
end)

-- Lazy
require("lazy").setup("plugins", {
  dev = {
    path = "~/code/nvim-plugins",
    patterns = { "meeehdi-dev" },
  },
})
