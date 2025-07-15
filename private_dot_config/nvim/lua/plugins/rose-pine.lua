return {
  {
    "rose-pine/neovim",
    lazy = false,
    name = "rose-pine",
    opts = {
      styles = {
        transparency = true,
      },
    },
    config = function(_, opts)
      require("rose-pine").setup(opts)
      vim.cmd("colorscheme rose-pine")
    end,
  },
}
