local util = require("util")

vim.pack.add({ { src = util.gh("catppuccin/nvim"), name = "catppuccin" } })

require("catppuccin").setup({
  transparent_background = true,
})

vim.cmd("colorscheme catppuccin-nvim")
