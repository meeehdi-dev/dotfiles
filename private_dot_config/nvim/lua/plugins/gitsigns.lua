return {
  {
    "lewis6991/gitsigns.nvim",
    event = "VeryLazy",
    opts = {},
    keys = {
      {
        "<leader><Up>",
        function()
          require("gitsigns.actions").nav_hunk("prev")
        end,
      },
      {
        "<leader><Down>",
        function()
          require("gitsigns.actions").nav_hunk("next")
        end,
      },
      {
        "<leader>gs",
        function()
          require("gitsigns.actions").blame_line()
        end,
      },
      {
        "<leader>gd",
        function()
          require("gitsigns.actions").preview_hunk()
        end,
      },
    },
  },
}
