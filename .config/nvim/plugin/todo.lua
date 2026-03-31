local util = require("util")

vim.pack.add({
  util.gh("folke/todo-comments.nvim"),
  util.gh("nvim-lua/plenary.nvim"),
})

require("todo-comments").setup()
