local util = require("util")

vim.pack.add({ util.gh("folke/ts-comments.nvim") })

require("ts-comments").setup()
