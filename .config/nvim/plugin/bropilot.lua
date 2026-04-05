vim.pack.add({
  "https://github.com/meeehdi-dev/bropilot.nvim",
  "https://github.com/nvim-lua/plenary.nvim",
  "https://github.com/Leonardo-Luz/dotenv.nvim",
  "https://github.com/j-hui/fidget.nvim",
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
