return {
  {
    "meeehdi-dev/win-picker.nvim",
    opts = {},
    keys = {
      {
        "<leader>w",
        function()
          require("win-picker").pick_win()
        end,
      },
    },
  },
}
