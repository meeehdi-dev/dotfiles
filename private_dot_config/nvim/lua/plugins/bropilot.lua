return {
  {
    "meeehdi-dev/bropilot.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "j-hui/fidget.nvim",
    },
    opts = {
      -- provider = "copilot",
      provider = "ollama",
      ls_cmd = { "/Users/mehdi/code/llm-language-server/llm-language-server" },
      -- provider = "codestral",
      -- api_key = os.getenv("CODESTRAL_API_KEY"),
      auto_suggest = false,
      keymap = {
        accept_word = "<C-l>",
        accept_line = "<S-Tab>",
        accept_block = "<Tab>",
        suggest = "<C-j>",
        suggest_next = "<C-k>",
      },
    },
  },
}
