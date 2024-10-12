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
  {
    "numToStr/Comment.nvim",
    event = "BufRead",
    config = true,
  },
  {
    "kylechui/nvim-surround",
    event = "BufRead",
    config = true,
  },
  {
    "mbbill/undotree",
    keys = {
      {
        "<leader>u",
        function()
          vim.cmd.UndotreeToggle()
        end,
      },
    },
  },
  {
    "meeehdi-dev/win-picker.nvim",
    opts = {
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
          require("win-picker").pick_win()
        end,
      },
    },
  },
  {
    "hedyhli/outline.nvim",
    event = "BufRead",
    config = true,
    keys = {
      {
        "<leader>o",
        function()
          require("outline").toggle()
        end,
      },
    },
  },
  {
    "windwp/nvim-autopairs",
    event = "InsertEnter",
    config = true,
  },
  {
    "windwp/nvim-ts-autotag",
    event = "InsertEnter",
    config = true,
  },
  {
    "lukas-reineke/indent-blankline.nvim",
    event = "BufRead",
    main = "ibl",
    config = true,
  },
  {
    "folke/trouble.nvim",
    config = true,
    cmd = "Trouble",
    keys = {
      {
        "<leader>t",
        "<cmd>Trouble diagnostics toggle focus=false<cr>",
      },
    },
  },
  -- {
  --   "meeehdi-dev/bropilot.nvim",
  --   event = "VeryLazy",
  --   dependencies = {
  --     "nvim-lua/plenary.nvim",
  --     "j-hui/fidget.nvim",
  --   },
  --   config = true,
  -- },
}
