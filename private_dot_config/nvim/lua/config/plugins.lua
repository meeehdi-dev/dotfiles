local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", -- latest stable release
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  "folke/tokyonight.nvim",
  "nvim-lualine/lualine.nvim",
  "tpope/vim-fugitive",
  {
    "nvim-telescope/telescope.nvim",
    tag = "0.1.2",
    dependencies = { "nvim-lua/plenary.nvim" },
  },
  {
    "nvim-treesitter/nvim-treesitter",
    build = function()
      pcall(require("nvim-treesitter.install").update({ with_sync = true }))
    end,
  },
  {
    "nvim-treesitter/nvim-treesitter-textobjects",
    dependencies = { "nvim-treesitter/nvim-treesitter" },
  },
  {
    "nvim-treesitter/nvim-treesitter-context",
    dependencies = { "nvim-treesitter/nvim-treesitter" },
  },
  "nvim-tree/nvim-tree.lua",
  "rmagatti/auto-session",
  "lukas-reineke/indent-blankline.nvim",
  "chrisgrieser/nvim-early-retirement",
  "zbirenbaum/copilot.lua",
  "folke/trouble.nvim",
  {
    "williamboman/mason.nvim",
    build = ":MasonUpdate",
  },
  "williamboman/mason-lspconfig.nvim",
  "neovim/nvim-lspconfig",
  "hrsh7th/nvim-cmp",
  "hrsh7th/cmp-nvim-lsp",
  "hrsh7th/cmp-buffer",
  "hrsh7th/cmp-path",
  "hrsh7th/cmp-cmdline",
  "L3MON4D3/LuaSnip",
  {
    "prettier/vim-prettier",
    build = "yarn install --frozen-lockfile --production",
  },
  "numToStr/Comment.nvim",
  "mbbill/undotree",
  "sindrets/diffview.nvim",
  "airblade/vim-gitgutter",
  "windwp/nvim-ts-autotag",
})
