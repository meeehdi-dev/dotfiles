return {
  {
    "nvim-lualine/lualine.nvim",
    dependencies = {
      "nvim-tree/nvim-web-devicons",
    },
    opts = {
      sections = {
        lualine_a = {
          {
            "mode",
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
