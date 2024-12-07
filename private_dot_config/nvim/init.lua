-- vim options
vim.opt.cursorline = true
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.ignorecase = true
vim.opt.smartcase = true
vim.opt.splitbelow = true
vim.opt.splitright = true
vim.opt.undofile = true
vim.opt.updatetime = 250

-- auto-session
vim.o.sessionoptions="blank,buffers,curdir,folds,help,tabpages,winsize,winpos,terminal,localoptions"

-- leader
vim.g.mapleader = " "

-- keymaps
vim.keymap.set("n", "<Space>", "<Nop>", { silent = true }) -- Unmap space

-- remap number keys in normal mode (azerty)
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

-- qol
vim.keymap.set("n", "<Esc>", "<Esc>:noh<CR>", { silent = true }) -- Clear highlights
vim.keymap.set("v", "<", "<gv") -- Keep visual selection after indent
vim.keymap.set("v", ">", ">gv") -- Keep visual selection after indent

-- clipboard (wsl)
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

-- copy to system clipboard
vim.keymap.set("v", "Y", '"*y')

-- macros
vim.keymap.set("n", "Q", "@q")
vim.keymap.set("x", "Q", ":norm @q<CR>")

-- lsp
vim.keymap.set("n", "grn", vim.lsp.buf.rename)
vim.keymap.set("n", "<C-s>", vim.lsp.buf.signature_help)

-- diagnostics
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

local function format(with_imports)
  if with_imports then
    -- organize imports
    vim.lsp.buf.execute_command({
      command = "_typescript.organizeImports",
      arguments = { vim.api.nvim_buf_get_name(0) },
      title = "",
    })
  end
  -- format
  require("conform").format(
    { timeout_ms = 1000, lsp_fallback = true },
    function()
      -- lint
      if vim.fn.exists(":EslintFixAll") > 0 then
        vim.cmd.EslintFixAll()
      end
    end
  )
end

-- lint & format
vim.keymap.set("n", "<leader>f", function()
  format()
end)
vim.keymap.set("n", "<leader>ff", function()
  format(true)
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

-- Lazy init
require("lazy").setup("plugins", {
  dev = {
    path = "~/code/nvim-plugins",
    patterns = { "meeehdi-dev" },
  },
})
