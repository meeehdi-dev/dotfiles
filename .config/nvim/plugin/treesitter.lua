local util = require("util")

vim.pack.add({
  util.gh("nvim-treesitter/nvim-treesitter"),
  util.gh("nvim-treesitter/nvim-treesitter-textobjects"),
  util.gh("nvim-treesitter/nvim-treesitter-context"),
  util.gh("lewis6991/ts-install.nvim"),
})

require("ts-install").setup({
  auto_install = true,
  ensure_install = {
    "vim",
    "regex",
    "lua",
    "bash",
    "markdown",
    "markdown_inline",
  },
})
require("nvim-treesitter-textobjects").setup()
require("treesitter-context").setup()

vim.api.nvim_create_autocmd("FileType", {
  pattern = { "*" },
  callback = function(ev)
    local ft = vim.bo[ev.buf].filetype
    local lang = vim.treesitter.language.get_lang(ft)
    if not lang then
      return
    end
    if not vim.treesitter.language.add(lang) then
      return
    end

    vim.treesitter.start(ev.buf, lang)
    vim.bo.indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
  end,
})
