require("config.vim")

require("config.plugins")
require("config.theme")
require("config.lualine")
require("config.telescope")
require("config.treesitter")

require("nvim-tree").setup()
require("auto-session").setup()
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
    auto_trigger = true,
    debounce = 500,
    keymap = {
      accept = "<Tab>",
    },
  },
})
require("Comment").setup()
require("trouble").setup({
  icons = false,
  auto_close = true,
})

require("config.cmp")
require("config.lsp")

require("config.keymap")
