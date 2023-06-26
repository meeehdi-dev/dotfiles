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
vim.opt.listchars:append("space:⋅")
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

-- Keymap
vim.keymap.set("n", "<C-e>", function()
  require("nvim-tree.api").tree.toggle({
    find_file = true,
    focus = false,
  })
end)

vim.keymap.set("x", "p", "\"_dP")

vim.keymap.set("n", "<F5>", vim.cmd.UndotreeToggle)
vim.keymap.set("n", "<C-t>", vim.cmd.TroubleToggle)
vim.keymap.set("n", "<leader>f", function()
  local file = vim.fn.findfile(".prettierrc", ".;")
  if file == "" then
    vim.lsp.buf.format()
  else
    vim.cmd.Prettier()
  end
end)

vim.keymap.set("n", "<C-d>", "<C-d>zz", { remap = false })
vim.keymap.set("n", "<C-u>", "<C-u>zz", { remap = false })
vim.keymap.set("n", "<C-o>", "<C-o>zz", { remap = false })

vim.keymap.set("n", "q", "<nop>", { remap = false })
vim.keymap.set("n", "Q", "<nop>", { remap = false })
vim.keymap.set("n", "<PageUp>", "<nop>", { remap = false })
vim.keymap.set("n", "<PageDown>", "<nop>", { remap = false })
vim.keymap.set("n", "<C-f>", "<nop>", { remap = false })
vim.keymap.set("i", "<C-c>", "<nop>", { remap = false })

vim.keymap.set("n", "<F2>", vim.lsp.buf.rename)
vim.keymap.set("n", "gd", function()
  require("telescope.builtin").lsp_definitions()
end)
vim.keymap.set("n", "gr", function()
  require("telescope.builtin").lsp_references()
end)
vim.keymap.set("n", "gi", vim.lsp.buf.hover)
vim.keymap.set("n", "<C-a>", vim.lsp.buf.code_action)
vim.keymap.set("n", "<C-i>", function()
  vim.lsp.buf.execute_command({ command = "_typescript.organizeImports", arguments = { vim.api.nvim_buf_get_name(0) } })
end)

vim.api.nvim_create_autocmd("BufWritePre", {
  callback = function()
    if vim.fn.exists(":EslintFixAll") > 0 then
      vim.cmd.EslintFixAll()
    end
  end
})
vim.api.nvim_create_autocmd("CursorHold", {
  callback = function()
    vim.lsp.buf.document_highlight()
    vim.diagnostic.open_float()
  end
})
vim.api.nvim_create_autocmd("CursorMoved", {
  callback = vim.lsp.buf.clear_references
})

vim.diagnostic.config({
  underline = true,
  update_in_insert = true,
  virtual_text = false,
  float = {
    focusable = false,
  },
  severity_sort = true,
})

require("lazy").setup("plugins")
