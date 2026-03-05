return {
  {
    enabled = true,
    "meeehdi-dev/bropilot.nvim",
    event = "InsertEnter",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "Leonardo-Luz/dotenv.nvim",
    },
    config = function(_, opts)
      require("dotenv").load()

      if opts.provider == "gemini" then
        opts.api_key = vim.env.GEMINI_API_KEY
      elseif opts.provider == "codestral" then
        opts.api_key = vim.env.CODESTRAL_API_KEY
      elseif opts.provider == "mistral" then
        opts.api_key = vim.env.MISTRAL_API_KEY
      end

      require("bropilot").setup(opts)
    end,
    opts = {
      provider = "gemini",
      auto_suggest = false,
      -- debounce = 100,
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
    },
  },
}
