return {
  {
    "nvim-lualine/lualine.nvim",
    event = "VeryLazy",
    dependencies = {
      "nvim-tree/nvim-web-devicons",
    },
    opts = {
      sections = {
        lualine_a = {
          {
            "mode",
            fmt = string.lower,
          },
        },
        lualine_b = {
          {
            "branch",
            fmt = function(branch)
              if #branch <= 16 then
                return branch
              end

              return string.sub(branch, 0, 16) .. "..."
            end,
          },
        },
        lualine_c = {
          {
            "filename",
            path = 1,
          },
        },
        lualine_x = {},
        lualine_y = {},
      },
      inactive_sections = {
        lualine_c = {
          {
            "filename",
            path = 1,
          },
        },
      },
      extensions = {
        "fzf",
        "lazy",
        "mason",
        "nvim-tree",
      },
    },
  },
}
