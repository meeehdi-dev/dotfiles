return {
  {
    "ibhagwan/fzf-lua",
    opts = {
      fzf_opts = { ["--layout"] = "default" },
    },
    keys = {
      {
        "<C-p>",
        function()
          vim.fn.system("git rev-parse --is-inside-work-tree")
          local fzf = require("fzf-lua")
          if vim.v.shell_error == 0 then
            fzf.git_files()
          else
            fzf.files()
          end
        end,
      },
      {
        "gd",
        function()
          require("fzf-lua").lsp_definitions()
        end,
      },
      {
        "gr",
        function()
          require("fzf-lua").lsp_references()
        end,
      },
      {
        "<C-f>",
        function()
          require("fzf-lua").live_grep()
        end,
      },
      {
        "<S-f>",
        function()
          require("fzf-lua").grep_cword()
        end,
      },
      {
        "<S-r>",
        function()
          require("fzf-lua").resume()
        end,
      },
    },
  },
}
