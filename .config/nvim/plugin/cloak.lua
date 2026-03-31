local util = require("util")

vim.pack.add({ util.gh("laytan/cloak.nvim") })

require("cloak").setup()
