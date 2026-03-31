local util = require("util")

vim.pack.add({
  util.gh("nvim-lualine/lualine.nvim"),
  util.gh("nvim-tree/nvim-web-devicons"),
})

require("lualine").setup({
  options = {
    section_separators = "",
    component_separators = "",
  },
  sections = {
    lualine_c = { { "filename", path = 1 } },
  },
})
