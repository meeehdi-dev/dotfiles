vim.cmd [[packadd packer.nvim]]

return require("packer").startup(function(use)
  use "wbthomason/packer.nvim"   -- Package manager
  use "zbirenbaum/copilot.lua"   -- Copilot
  use {
    "nvim-lualine/lualine.nvim", -- Status line
    requires = { "nvim-tree/nvim-web-devicons" },
  }
  use "tpope/vim-fugitive"           -- Git commands in nvim
  use "folke/tokyonight.nvim"        -- Theme
  use {
    "nvim-telescope/telescope.nvim", -- Fuzzy finder
    tag = "0.1.2",
    requires = { "nvim-lua/plenary.nvim" },
  }
  use {
    "nvim-treesitter/nvim-treesitter", -- Treesitter
    run = function()
      local ts_update = require("nvim-treesitter.install").update({ with_sync = true })
      ts_update()
    end,
  }
  use "nvim-treesitter/nvim-treesitter-context" -- Treesitter context
  use {
    "folke/trouble.nvim",                       -- LSP diagnostics
    requires = { "nvim-tree/nvim-web-devicons" },
  }
  use {
    "nvim-tree/nvim-tree.lua", -- File explorer
    requires = { "nvim-tree/nvim-web-devicons" },
  }
  use "tpope/vim-commentary" -- Commenting
  use "mbbill/undotree"      -- Undo tree
  use {
    "prettier/vim-prettier", -- Prettier
    run = "yarn install",
  }
  use {
    "VonHeikemen/lsp-zero.nvim", -- LSP
    requires = {
      "neovim/nvim-lspconfig",
      "williamboman/mason.nvim",
      "williamboman/mason-lspconfig.nvim",

      "hrsh7th/nvim-cmp",
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-buffer",
      "hrsh7th/cmp-path",
      "hrsh7th/cmp-cmdline",

      "hrsh7th/cmp-nvim-lua",
      "saadparwaiz1/cmp_luasnip",
      "L3MON4D3/LuaSnip",
    },
  }
  use "sindrets/diffview.nvim"              -- Diffview
  use "rmagatti/auto-session"               -- Auto session
  use "windwp/nvim-autopairs"               -- Autopairs
  use "windwp/nvim-ts-autotag"              -- Autotag
  use "lukas-reineke/indent-blankline.nvim" -- Indent lines
  use "airblade/vim-gitgutter"              -- Git gutter
  use "chrisgrieser/nvim-early-retirement"  -- Auto close inactive buffers
  use "zbirenbaum/copilot-cmp"              -- Integrate copilot with cmp
end)
