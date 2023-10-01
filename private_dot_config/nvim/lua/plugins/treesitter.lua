return {
  {
    "nvim-treesitter/nvim-treesitter",
    build = ":TSUpdate",
    dependencies = { "nvim-treesitter/nvim-treesitter-textobjects",
      {
        "nvim-treesitter/nvim-treesitter-context",
        opts = {
          multiline_threshold = 1,
        },
      },
      "windwp/nvim-ts-autotag"
    },
    opts = {
      ensure_installed = { "c", "lua", "vim", "vimdoc", "query" },
      sync_install = false,
      auto_install = true,
      highlight = {
        enable = true,
        additional_vim_regex_highlighting = false,
      },
      textobjects = {
        enable = true,
        lookahead = true,
        include_surrouding_whitespace = true,
      },
      autotag = {
        enable = true,
        enable_rename = true,
        enable_close = true,
        enable_close_on_slash = false,
        filetypes = { "html", "javascript", "javascriptreact", "typescript", "typescriptreact" },
      },
    },
    main = "nvim-treesitter.configs",
  },
}
