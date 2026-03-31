local util = require("util")

vim.pack.add({ util.gh("mbbill/undotree") })

vim.keymap.set("n", "U", vim.cmd.UndotreeToggle)
