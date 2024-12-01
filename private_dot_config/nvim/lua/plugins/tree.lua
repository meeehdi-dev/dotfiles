return {
  {
    "nvim-tree/nvim-tree.lua",
    event = "VeryLazy",
    opts = {
      actions = {
        open_file = {
          window_picker = {
            picker = function()
              return require("win-picker").pick_win({
                filter = function(id)
                  local buf = vim.api.nvim_win_get_buf(id)
                  local ft =
                    vim.api.nvim_get_option_value("filetype", { buf = buf })
                  return not vim.tbl_contains(
                    { "noice", "notify", "NvimTree" },
                    ft
                  )
                end,
              })
            end,
          },
          quit_on_open = true,
        },
      },
    },
    keys = {
      {
        "<leader>e",
        function()
          require("nvim-tree.api").tree.toggle({
            find_file = true,
            focus = true,
          })
        end,
      },
    },
  },
}
