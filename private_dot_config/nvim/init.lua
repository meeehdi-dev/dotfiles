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
vim.opt.cindent = true
vim.opt.cursorcolumn = true
vim.opt.cursorline = true
vim.opt.expandtab = true
vim.opt.hlsearch = true
vim.opt.ignorecase = true
vim.opt.laststatus = 2
vim.opt.list = true
vim.opt.listchars:append("eol:↴")
vim.opt.mouse = "n"
vim.opt.number = true
vim.opt.numberwidth = 2
vim.opt.relativenumber = true
vim.opt.scrolloff = 10
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
vim.opt.title = true
vim.opt.updatetime = 100

-- Leader
vim.g.mapleader = " "

-- Diagnostics
vim.diagnostic.config({
  underline = true,
  update_in_insert = true,
  virtual_text = false,
  float = {
    focusable = false,
  },
  severity_sort = true,
})

vim.fn.sign_define("DiagnosticSignError", { text = "", texthl = "DiagnosticSignError" })
vim.fn.sign_define("DiagnosticSignWarn", { text = "", texthl = "DiagnosticSignWarn" })
vim.fn.sign_define("DiagnosticSignInfo", { text = "", texthl = "DiagnosticSignInfo" })
vim.fn.sign_define("DiagnosticSignHint", { text = "", texthl = "DiagnosticSignHint" })

-- WSL Clipboard
if vim.fn.has("wsl") then
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

-- Keymap
vim.keymap.set("n", "<C-e>", function()
  require("nvim-tree.api").tree.toggle({
    find_file = true,
    focus = true,
  })
end)

vim.keymap.set("n", "<F5>", vim.cmd.UndotreeToggle)
vim.keymap.set("n", "<C-t>", vim.cmd.TroubleToggle)
vim.keymap.set("n", "<S-t>", vim.diagnostic.open_float)
vim.keymap.set("n", "<leader>f", function()
  local rc = vim.fn.findfile(".prettierrc", ".;")
  local rcjson = vim.fn.findfile(".prettierrc.json", ".;")
  if rc == "" and rcjson == "" then
    vim.lsp.buf.format()
  else
    vim.cmd.Prettier()
  end
end)

vim.keymap.set("n", "<C-d>", "<C-d>zz", { remap = false })
vim.keymap.set("n", "<C-u>", "<C-u>zz", { remap = false })
vim.keymap.set("n", "<C-o>", "<C-o>zz", { remap = false })

vim.keymap.set("n", "<F3>", ":noh<CR>", { remap = false })
vim.keymap.set("n", "<F2>", vim.lsp.buf.rename)
vim.keymap.set("n", "gd", function()
  require("telescope.builtin").lsp_definitions()
end)
vim.keymap.set("n", "gr", function()
  require("telescope.builtin").lsp_references()
end)
vim.keymap.set("n", "<C-f>", function()
  require("telescope.builtin").live_grep()
end)
vim.keymap.set("n", "gi", vim.lsp.buf.hover)
vim.keymap.set("n", "<C-a>", vim.lsp.buf.code_action)
vim.keymap.set("n", "<C-i>", function()
  vim.lsp.buf.execute_command({ command = "_typescript.organizeImports", arguments = { vim.api.nvim_buf_get_name(0) } })
end)

vim.keymap.set("n", "q", "<nop>", { remap = false })
vim.keymap.set("n", "Q", "<nop>", { remap = false })
vim.keymap.set("n", "<PageUp>", "<nop>", { remap = false })
vim.keymap.set("n", "<PageDown>", "<nop>", { remap = false })
vim.keymap.set("n", "<C-f>", "<nop>", { remap = false })
vim.keymap.set("i", "<C-c>", "<nop>", { remap = false })

require("lazy").setup("plugins")
