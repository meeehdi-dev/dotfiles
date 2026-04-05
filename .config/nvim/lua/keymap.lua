-- leader
vim.g.mapleader = " "

-- keymaps
vim.keymap.set("n", "<Space>", "<Nop>") -- Unmap space

-- remap number keys in normal mode (azerty)
vim.keymap.set({ "n", "x" }, "&", "1")
vim.keymap.set({ "n", "x" }, "é", "2")
vim.keymap.set({ "n", "x" }, '"', "3")
vim.keymap.set({ "n", "x" }, "'", "4")
vim.keymap.set({ "n", "x" }, "(", "5")
vim.keymap.set({ "n", "x" }, "§", "6")
vim.keymap.set({ "n", "x" }, "è", "7")
vim.keymap.set({ "n", "x" }, "!", "8")
vim.keymap.set({ "n", "x" }, "ç", "9")
vim.keymap.set({ "n", "x" }, "à", "0")

-- Add undo break-points
vim.keymap.set("i", ",", ",<C-g>u")
vim.keymap.set("i", ".", ".<C-g>u")
vim.keymap.set("i", ";", ";<C-g>u")
vim.keymap.set("i", "(", "(<C-g>u")
vim.keymap.set("i", ")", ")<C-g>u")
vim.keymap.set("i", "{", "{<C-g>u")
vim.keymap.set("i", "}", "}<C-g>u")
vim.keymap.set("i", "<Space>", " <C-g>u")

-- qol
vim.keymap.set("n", "<Esc>", "<Esc>:noh<CR>") -- Clear highlights
vim.keymap.set("v", "<", "<gv") -- Keep visual selection after indent
vim.keymap.set("v", ">", ">gv") -- Keep visual selection after indent
-- better up/down
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

-- copy to system clipboard
vim.keymap.set("v", "Y", '"*y')

-- macros
vim.keymap.set("n", "Q", "@q")
vim.keymap.set("x", "Q", ":norm @q<CR>")

-- diagnostics
vim.keymap.set("n", "<leader>d", vim.diagnostic.open_float)
vim.keymap.set("n", "<leader>h", function()
  vim.diagnostic.jump({ count = -1 })
end)
vim.keymap.set("n", "<leader>l", function()
  vim.diagnostic.jump({ count = 1 })
end)
