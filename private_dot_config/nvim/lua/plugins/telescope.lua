return {
  {
    "nvim-telescope/telescope.nvim",
    branch = "0.1.x",
    dependencies = { "nvim-lua/plenary.nvim" },
    opts = {
      defaults = {
        file_ignore_patterns = {
          "^%.git/",
          "^node_modules/",
        },
      },
      pickers = {
        live_grep = {
          additional_args = function()
            return { "--hidden" }
          end
        },
      },
    },
    keys = {
      {
        "<C-p>",
        function()
          vim.fn.system("git rev-parse --is-inside-work-tree")
          local telescope = require("telescope.builtin")
          if vim.v.shell_error == 0 then
            telescope.git_files({
              hidden = true,
              show_untracked = true,
            })
          else
            telescope.find_files({
              hidden = true,
            })
          end
        end
      },
      {
        "gd",
        function()
          require("telescope.builtin").lsp_definitions()
        end
      },
      {
        "gr",
        function()
          require("telescope.builtin").lsp_references()
        end
      },
      {
        "<C-f>",
        function()
          require("telescope.builtin").live_grep()
        end,
      },
      {
        "<S-r>",
        function()
          require("telescope.builtin").resume()
        end
      },
    },
  }
}
