vim.pack.add({ "https://github.com/lewis6991/gitsigns.nvim" })

require("gitsigns").setup()

vim.keymap.set("n", "<leader>k", function() require("gitsigns").nav_hunk("prev") end)
vim.keymap.set("n", "<leader>j", function() require("gitsigns").nav_hunk("next") end)
vim.keymap.set("n", "<leader>gs", function() require("gitsigns").blame_line() end)
vim.keymap.set("n", "<leader>ga", function() require("gitsigns").stage_hunk() end)
vim.keymap.set("n", "<leader>gr", function() require("gitsigns").stage_hunk() end)
vim.keymap.set("n", "<leader>gR", function() require("gitsigns").reset_hunk() end)
vim.keymap.set("n", "<leader>gd", function() require("gitsigns").preview_hunk() end)
