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
    },
    config = function(_, opts)
      local telescope = require("telescope")
      telescope.setup(opts)
      telescope.load_extension("fzf")
      telescope.load_extension("ui-select")
    end,
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
          require("telescope.builtin").live_grep() -- requires ripgrep
        end,
      },
      {
        "<C-f>",
        function()
          require("telescope.builtin").grep_string() -- requires ripgrep
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
