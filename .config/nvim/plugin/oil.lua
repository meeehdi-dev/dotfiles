vim.pack.add({
  "https://github.com/stevearc/oil.nvim",
  "https://github.com/nvim-tree/nvim-web-devicons",
})

require("oil").setup({ view_options = { show_hidden = true } })

vim.keymap.set("n", "<leader>e", function()
  require("oil").open()
end)
