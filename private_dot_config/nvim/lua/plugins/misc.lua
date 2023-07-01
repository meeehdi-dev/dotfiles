return {
  "tpope/vim-fugitive",
  {
    "nvim-tree/nvim-tree.lua",
    config = true,
  },
  {
    "rmagatti/auto-session",
    config = true,
  },
  {
    "lukas-reineke/indent-blankline.nvim",
    opts = {
      show_current_context = true,
    },
  },
  {
    "chrisgrieser/nvim-early-retirement",
    opts = {
      retirementAgeMins = 10,
    },
  },
  {
    "zbirenbaum/copilot.lua",
    opts = {
      panel = {
        enable = false,
      },
      suggestion = {
        auto_trigger = true,
        debounce = 100,
        keymap = {
          next = "<S-Tab>",
          accept = "<Tab>",
          accept_word = "<C-Right>",
        },
      },
    },
  },
  {
    "folke/trouble.nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    opts = {
      auto_close = true,
    },
  },
  {
    "prettier/vim-prettier",
    build = "yarn install --frozen-lockfile --production",
  },
  {
    "numToStr/Comment.nvim",
    config = true,
  },
  "mbbill/undotree",
  "sindrets/diffview.nvim",
  "airblade/vim-gitgutter",
}
