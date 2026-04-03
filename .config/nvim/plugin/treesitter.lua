local util = require("util")

vim.pack.add({
  util.gh("nvim-treesitter/nvim-treesitter"),
  util.gh("nvim-treesitter/nvim-treesitter-textobjects"),
  util.gh("nvim-treesitter/nvim-treesitter-context"),
})

require("nvim-treesitter").update()
require("nvim-treesitter").install({
  "vim",
  "regex",
  "lua",
  "bash",
  "markdown",
  "markdown_inline",

  "css",
  "lua",
  "prisma",
  "tsx",
  "typescript",
  "vue",
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
