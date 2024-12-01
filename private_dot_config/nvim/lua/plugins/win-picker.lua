return {
  {
    "meeehdi-dev/win-picker.nvim",
    event = "VeryLazy",
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
}
