return {
  {
    "meeehdi-dev/sunset.nvim",
    lazy = false,
    opts = {
      italic_comment = true,
      transparent = true,
    },
    config = function(_, opts)
      require("sunset").setup(opts)
      vim.cmd("colorscheme sunset")
    end,
  },
}
