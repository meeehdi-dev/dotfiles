local util = require("util")

vim.pack.add({
  util.gh("j-hui/fidget.nvim"),
})

require("fidget").setup({
  notification = {
    override_vim_notify = true,
  },
})
