require("config.vim")

require("config.plugins")
require("config.theme")
require("config.lualine")
require("config.telescope")
require("config.treesitter")

require("nvim-tree").setup()
require("auto-session").setup()
require("nvim-autopairs").setup()
require("indent_blankline").setup({
  show_current_context = true,
})
require("early-retirement").setup({
  retirementAgeMins = 10,
})

require("copilot").setup({
  panel = {
    enable = false,
  },
  suggestion = {
    enable = false,
  },
})
require("copilot_cmp").setup()
require("Comment").setup()

require("config.cmp")
require("config.lsp")

require("config.keymap")
