local util = require("util")

vim.pack.add({
  util.gh("meeehdi-dev/bropilot.nvim"),
  util.gh("nvim-lua/plenary.nvim"),
  util.gh("Leonardo-Luz/dotenv.nvim"),
  util.gh("j-hui/fidget.nvim"),
})

require("dotenv").load()

require("bropilot").setup({
  provider = "gemini",
  api_key = vim.env.GEMINI_API_KEY,
  auto_suggest = false,
  ls_cmd = {
    "/Users/mehdi/code/llm-language-server/llm-language-server",
    "--debug",
  },
  keymap = {
    accept_word = "<C-l>",
    accept_line = "<S-Tab>",
    accept_block = "<Tab>",
    suggest = "<C-j>",
  },
})
