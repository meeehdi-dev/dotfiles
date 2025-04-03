return {
  {
    "meeehdi-dev/bropilot.nvim",
    event = "InsertEnter",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "j-hui/fidget.nvim",
    },
    opts = {
      provider = "codestral",
      api_key = os.getenv("CODESTRAL_API_KEY"),
      auto_suggest = false,
      debounce = 1,
      keymap = {
        accept_word = "<Tab>",
        accept_line = "<S-Tab>",
        accept_block = false,
        suggest = "<C-l>",
      },
    },
  },
}
