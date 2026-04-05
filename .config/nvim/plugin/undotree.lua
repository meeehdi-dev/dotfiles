vim.pack.add({ "https://github.com/mbbill/undotree" })

vim.keymap.set("n", "U", vim.cmd.UndotreeToggle)
