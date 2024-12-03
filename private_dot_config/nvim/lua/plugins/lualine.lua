return {
  {
    "nvim-lualine/lualine.nvim",
    opts = {
      sections = {
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
