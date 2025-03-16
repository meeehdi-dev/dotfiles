return {
  {
    "meeehdi-dev/bropilot.nvim",
    event = "InsertEnter",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "j-hui/fidget.nvim",
    },
    opts = {
      debounce = 1000,
      model_params = {
        num_predict = 64,
      },
      keymap = {
        accept_word = "<Tab>",
        accept_line = "<S-Tab>",
        accept_block = false,
        suggest = "<C-j>",
      },
    },
  },
}
