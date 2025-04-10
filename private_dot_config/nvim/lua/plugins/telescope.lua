return {
  {
    "nvim-telescope/telescope.nvim",
    branch = "0.1.x",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-treesitter/nvim-treesitter",
      "nvim-tree/nvim-web-devicons",
      {
        "nvim-telescope/telescope-fzf-native.nvim",
        build = "make",
      },
      "nvim-telescope/telescope-ui-select.nvim",
    },
    opts = {
      extensions = {
        ["fzf"] = {},
        ["ui-select"] = { require("telescope.themes").get_dropdown({}) },
      },
      pickers = {
        find_files = {
          find_command = {
            "rg",
            "--files",
            "--color=never",
            "--hidden",
            "--glob=!**/.git/*",
          },
        },
      },
    },
    config = function(_, opts)
      local telescope = require("telescope")
      local telescope_config = require("telescope.config")

      local vimgrep_arguments =
        { unpack(telescope_config.values.vimgrep_arguments) }
      table.insert(vimgrep_arguments, "--hidden")
      table.insert(vimgrep_arguments, "--glob=!**/.git/*")
      opts.defaults = {
        vimgrep_arguments = vimgrep_arguments,
      }

      telescope.setup(opts)
      telescope.load_extension("fzf")
      telescope.load_extension("ui-select")
    end,
    keys = {
      {
        "<C-p>",
        require("telescope.builtin").find_files,
      },
      {
        "grd",
        require("telescope.builtin").lsp_definitions,
      },
      {
        "grr",
        require("telescope.builtin").lsp_references,
      },
      {
        "gri",
        require("telescope.builtin").lsp_implementations,
      },
      {
        "gO",
        require("telescope.builtin").lsp_document_symbols,
      },
      {
        "<C-f>",
        require("telescope.builtin").live_grep,
      },
      {
        "<C-f>",
        require("telescope.builtin").grep_string,
        mode = "v",
      },
      {
        "<leader><C-r>",
        require("telescope.builtin").resume,
      },
    },
  },
}
