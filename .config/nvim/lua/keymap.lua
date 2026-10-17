-- Set <Space> as leader
vim.g.mapleader = " "

-- Unmap space
vim.keymap.set("n", "<Space>", "<Nop>")

-- Add undo break-points
vim.keymap.set("i", ",", ",<C-g>u")
vim.keymap.set("i", ".", ".<C-g>u")
vim.keymap.set("i", ";", ";<C-g>u")
vim.keymap.set("i", "(", "(<C-g>u")
vim.keymap.set("i", ")", ")<C-g>u")
vim.keymap.set("i", "{", "{<C-g>u")
vim.keymap.set("i", "}", "}<C-g>u")
vim.keymap.set("i", "<Space>", " <C-g>u")

-- Clear highlights
vim.keymap.set("n", "<Esc>", "<Esc>:noh<CR>")

-- Keep visual selection after indent
vim.keymap.set("v", "<", "<gv")
vim.keymap.set("v", ">", ">gv")

-- Handle Up/Down in wrapped lines
vim.keymap.set({ "n", "x" }, "j", "v:count == 0 ? 'gj' : 'j'", { expr = true })
vim.keymap.set(
  { "n", "x" },
  "<Down>",
  "v:count == 0 ? 'gj' : 'j'",
  { expr = true }
)
vim.keymap.set({ "n", "x" }, "k", "v:count == 0 ? 'gk' : 'k'", { expr = true })
vim.keymap.set(
  { "n", "x" },
  "<Up>",
  "v:count == 0 ? 'gk' : 'k'",
  { expr = true }
)

-- Copy to system clipboard
vim.keymap.set("v", "Y", '"*y')

-- Save/Run macros with Q
vim.keymap.set("n", "Q", "@q")
vim.keymap.set("x", "Q", ":norm @q<CR>")

-- Navigate diagnostics
vim.keymap.set("n", "<leader>d", vim.diagnostic.open_float)
vim.keymap.set("n", "<leader>h", function()
  vim.diagnostic.jump({ count = -1 })
end)
vim.keymap.set("n", "<leader>l", function()
  vim.diagnostic.jump({ count = 1 })
end)
