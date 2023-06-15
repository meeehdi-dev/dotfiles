local telescope = require("telescope.builtin")
local tree = require("nvim-tree.api")

vim.keymap.set("n", "<C-f>", function()
  telescope.live_grep()
end)
vim.keymap.set("n", "<C-p>", function()
  vim.fn.system("git rev-parse --is-inside-work-tree")
  if vim.v.shell_error == 0 then
    telescope.git_files()
  else
    telescope.find_files({
      hidden = true,
    })
  end
end)
vim.keymap.set("n", "<C-b>", telescope.buffers)

vim.keymap.set("n", "<C-e>", function ()
  tree.tree.toggle({
    find_file = true,
    focus = false,
  })
end)

vim.keymap.set("x", "p", "\"_dP")
vim.keymap.set("n", "q", "<nop>")
vim.keymap.set("n", "Q", "<nop>")

vim.keymap.set("n", "<F5>", vim.cmd.UndotreeToggle)
vim.keymap.set("n", "<C-t>", vim.cmd.TroubleToggle)

vim.keymap.set("i", "<C-right>", function()
  local suggestion = vim.fn["copilot#Accept"]("")
  local bar = vim.fn["copilot#TextQueuedForInsertion"]()
  return vim.fn.split(bar, [[[ .]\zs]])[1]
end, {expr = true, remap = false})