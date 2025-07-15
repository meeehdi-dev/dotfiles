-- options
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

-- leader
vim.g.mapleader = " "

-- keymaps
vim.keymap.set("n", "<Space>", "<Nop>") -- Unmap space

-- remap number keys in normal mode (azerty)
vim.keymap.set({ "n", "x" }, "&", "1")
vim.keymap.set({ "n", "x" }, "é", "2")
vim.keymap.set({ "n", "x" }, '"', "3")
vim.keymap.set({ "n", "x" }, "'", "4")
vim.keymap.set({ "n", "x" }, "(", "5")
vim.keymap.set({ "n", "x" }, "§", "6")
vim.keymap.set({ "n", "x" }, "è", "7")
vim.keymap.set({ "n", "x" }, "!", "8")
vim.keymap.set({ "n", "x" }, "ç", "9")
vim.keymap.set({ "n", "x" }, "à", "0")

-- Add undo break-points
vim.keymap.set("i", ",", ",<C-g>u")
vim.keymap.set("i", ".", ".<C-g>u")
vim.keymap.set("i", ";", ";<C-g>u")
vim.keymap.set("i", "<Space>", " <C-g>u")

-- qol
vim.keymap.set("n", "<Esc>", "<Esc>:noh<CR>") -- Clear highlights
vim.keymap.set("v", "<", "<gv") -- Keep visual selection after indent
vim.keymap.set("v", ">", ">gv") -- Keep visual selection after indent
-- better up/down
vim.keymap.set({ "n", "x" }, "j", "v:count == 0 ? 'gj' : 'j'", { expr = true })
vim.keymap.set(
  { "n", "x" },
  "<Down>",
  "v:count == 0 ? 'gj' : 'j'",
  { expr = true }
)
vim.keymap.set({ "n", "x" }, "k", "v:count == 0 ? 'gk' : 'k'", { expr = true })
vim.keymap.set(
  { "n", "x" },
  "<Up>",
  "v:count == 0 ? 'gk' : 'k'",
  { expr = true }
)

-- copy to system clipboard
vim.keymap.set("v", "Y", '"*y')

-- macros
vim.keymap.set("n", "Q", "@q")
vim.keymap.set("x", "Q", ":norm @q<CR>")

-- diagnostics
vim.diagnostic.config({
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = "󰅙",
      [vim.diagnostic.severity.WARN] = "",
      [vim.diagnostic.severity.INFO] = "󰋼",
      [vim.diagnostic.severity.HINT] = "󰌵",
    },
  },
  virtual_text = { current_line = true },
})
vim.keymap.set("n", "<leader>d", vim.diagnostic.open_float)
vim.keymap.set("n", "<leader>h", function()
  vim.diagnostic.jump({ count = -1 })
end)
vim.keymap.set("n", "<leader>l", function()
  vim.diagnostic.jump({ count = 1 })
end)

-- lazy bootstrap
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  local lazyrepo = "https://github.com/folke/lazy.nvim.git"
  local out = vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "--branch=stable",
    lazyrepo,
    lazypath,
  })
  if vim.v.shell_error ~= 0 then
    vim.api.nvim_echo({
      { "Failed to clone lazy.nvim:\n", "ErrorMsg" },
      { out, "WarningMsg" },
      { "\nPress any key to exit..." },
    }, true, {})
    vim.fn.getchar()
    os.exit(1)
  end
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  spec = {
    { import = "plugins" },
  },
  change_detection = { notify = false },
  dev = {
    path = "~/code/nvim-plugins",
    patterns = { "meeehdi-dev" },
    fallback = true,
  },
})

-- fzf
vim.opt.rtp:append("/opt/homebrew/opt/fzf")
