return {
  {
    enabled = false,
    "meeehdi-dev/bropilot.nvim",
    event = "InsertEnter",
    dependencies = {
      "nvim-lua/plenary.nvim",
    },
    opts = {
      provider = "ollama",
      model = "qwen2.5-coder:7b",
      debounce = 1,
      ls_cmd = {
        "/Users/mehdi/code/llm-language-server/llm-language-server",
        "--debug",
      },
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
