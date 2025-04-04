return {
  {
    "nvim-telescope/telescope.nvim",
    branch = "0.1.x",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-treesitter/nvim-treesitter",
      {
        "nvim-telescope/telescope-fzf-native.nvim",
        build = "make",
      },
    },
    opts = {
      defaults = {
        preview = {
          filesize_limit = 0.1, -- MB
        },
      },
      extensions = {
        fzf = {
          fuzzy = true,
          override_generic_sorter = true,
          override_file_sorter = true,
        },
      },
    },
    keys = {
      {
        "<C-p>",
        function()
          vim.fn.system("git rev-parse --is-inside-work-tree")
          local is_inside_work_tree = vim.v.shell_error == 0

          if is_inside_work_tree then
            require("telescope.builtin").git_files({ show_untracked = true })
          else
            require("telescope.builtin").find_files()
          end
        end,
      },
      {
        "grd",
        function()
          require("telescope.builtin").lsp_definitions()
        end,
      },
      {
        "grr",
        function()
          require("telescope.builtin").lsp_references()
        end,
      },
      {
        "gri",
        function()
          require("telescope.builtin").lsp_implementations()
        end,
      },
      {
        "gO",
        function()
          require("telescope.builtin").lsp_document_symbols()
        end,
      },
      {
        "<C-f>",
        function()
          require("telescope.builtin").live_grep()
        end,
      },
      {
        "<C-f>",
        function()
          require("telescope.builtin").grep_string()
        end,
        mode = "v",
      },
      {
        "<leader><C-r>",
        function()
          require("telescope.builtin").resume()
        end,
      },
    },
  },
}
