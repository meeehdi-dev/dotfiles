return {
  "nvim-telescope/telescope.nvim",
  dependencies = { "nvim-lua/plenary.nvim" },
  opts = {
    defaults = {
      file_ignore_patterns = {
        "node_modules"
      }
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
          })
        else
          telescope.find_files({
            hidden = true,
          })
        end
      end
    },
  },
}
