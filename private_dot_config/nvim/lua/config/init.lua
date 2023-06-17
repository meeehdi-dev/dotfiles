require("config.vim")

require("config.plugins")

require("tokyonight").setup({
  transparent = true,
})
vim.cmd [[colorscheme tokyonight]]

require("config.telescope")
require("config.treesitter")
require("config.lsp")

require("nvim-tree").setup()
require("trouble").setup({
  auto_open = false,
  auto_close = true,
})
require("lualine").setup({
  sections = {
    lualine_c = { { "filename", path = 1 } },
  },
  inactive_sections = {
    lualine_c = { { "filename", path = 1 } },
  },
})
require("auto-session").setup()
require("nvim-autopairs").setup()
require("indent_blankline").setup({
  show_current_context = true,
})
require("copilot").setup({
  suggestion = {
    keymap = {
      next = "<S-Tab>",
      accept = "<C-Right>",
    },
  },
})
require("early-retirement").setup()

require("config.keymap")

