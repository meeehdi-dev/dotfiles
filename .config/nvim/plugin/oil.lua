local util = require("util")

vim.pack.add({ util.gh("stevearc/oil.nvim"), util.gh("nvim-tree/nvim-web-devicons") })

require("oil").setup({ view_options = { show_hidden = true } })

vim.keymap.set("n", "<leader>e", function()
  require("oil").open()
end)
