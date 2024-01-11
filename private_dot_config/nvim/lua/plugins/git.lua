return {
  {
    "lewis6991/gitsigns.nvim",
    event = "BufRead",
    config = true,
    keys = {
      {
        "<leader><Up>",
        function()
          require("gitsigns.actions").prev_hunk()
        end,
      },
      {
        "<leader><Down>",
        function()
          require("gitsigns.actions").next_hunk()
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
