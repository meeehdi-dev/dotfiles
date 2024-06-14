return {
  {
    "rmagatti/auto-session",
    lazy = false,
    opts = {
      auto_session_suppress_dirs = { "~/" },
    },
  },
  {
    "chrisgrieser/nvim-early-retirement",
    event = "BufRead",
    opts = {
      retirementAgeMins = 5,
    },
  },
  -- {
  --   "github/copilot.vim",
  --   event = "InsertEnter",
  --   config = function()
  --     vim.keymap.set("i", "<C-Right>", "<Plug>(copilot-accept-word)")
  --     vim.keymap.set("i", "<M-Right>", "<Plug>(copilot-accept-line)")
  --   end,
  -- },
  {
    "numToStr/Comment.nvim",
    dependencies = {
      "JoosepAlviste/nvim-ts-context-commentstring",
    },
    event = "BufRead",
    config = function()
      require("Comment").setup({
        pre_hook = require(
          "ts_context_commentstring.integrations.comment_nvim"
        ).create_pre_hook(),
      })
    end,
  },
  {
    "kylechui/nvim-surround",
    event = "BufRead",
    config = true,
  },
  {
    "j-hui/fidget.nvim",
    lazy = false,
    config = true,
  },
  {
    "kdheepak/lazygit.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
    },
    keys = {
      {
        "<leader>gg",
        "<cmd>LazyGit<cr>",
        desc = "LazyGit",
      },
    },
  },
  {
    "meeehdi-dev/win-picker.nvim",
    opts = {
      hl_group = "WinPicker",
      filter = function(id)
        local buf = vim.api.nvim_win_get_buf(id)
        local ft = vim.api.nvim_get_option_value("filetype", { buf = buf })
        return not vim.tbl_contains({ "noice", "notify" }, ft)
      end,
    },
    keys = {
      {
        "<leader>w",
        function()
          local win_id = require("win-picker").pick_win()
          if win_id then
            vim.api.nvim_set_current_win(win_id)
          end
        end,
      },
    },
  },
  {
    "meeehdi-dev/bropilot.nvim",
    event = "VeryLazy",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "j-hui/fidget.nvim",
    },
    config = true,
    keys = {
      {
        "<C-Right>",
        function()
          require("bropilot").accept_word()
        end,
        mode = "i",
      },
      {
        "<S-Right>",
        function()
          require("bropilot").accept_line()
        end,
        mode = "i",
      },
      {
        "<Tab>",
        function()
          require("bropilot").accept_block()
        end,
        mode = "i",
      },
    },
  },
}
