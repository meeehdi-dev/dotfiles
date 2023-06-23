vim.cmd [[packadd packer.nvim]]

return require("packer").startup(function(use)
  use "wbthomason/packer.nvim"
  use "folke/tokyonight.nvim"
  use "nvim-lualine/lualine.nvim"
  use "tpope/vim-fugitive"
  use {
    "nvim-telescope/telescope.nvim",
    tag = "0.1.2",
    requires = { "nvim-lua/plenary.nvim" },
  }
  use {
    "nvim-treesitter/nvim-treesitter",
    run = function()
      local ts_update = require("nvim-treesitter.install").update({ with_sync = true })
      ts_update()
    end,
  }
  use {
    "nvim-treesitter/nvim-treesitter-textobjects",
    requires = { "nvim-treesitter/nvim-treesitter" },
  }
  use {
    "nvim-treesitter/nvim-treesitter-context",
    requires = { "nvim-treesitter/nvim-treesitter" },
  }
  use "nvim-tree/nvim-tree.lua"
  use "rmagatti/auto-session"
  use "lukas-reineke/indent-blankline.nvim"
  use "chrisgrieser/nvim-early-retirement"
  use "zbirenbaum/copilot.lua"
  use "folke/trouble.nvim"

  use {
    "williamboman/mason.nvim",
    run = ":MasonUpdate",
  }
  use "williamboman/mason-lspconfig.nvim"
  use "neovim/nvim-lspconfig"
  use "hrsh7th/nvim-cmp"
  use "hrsh7th/cmp-nvim-lsp"
  use "hrsh7th/cmp-buffer"
  use "hrsh7th/cmp-path"
  use "hrsh7th/cmp-cmdline"
  use "L3MON4D3/LuaSnip"
  use {
    "prettier/vim-prettier",
    build = "yarn install --frozen-lockfile --production",
  }

  use "numToStr/Comment.nvim"
  use "mbbill/undotree"
  use "sindrets/diffview.nvim"
  use "airblade/vim-gitgutter"
  use "windwp/nvim-ts-autotag"
end)
