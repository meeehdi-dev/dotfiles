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
          require("fzf-lua").files()
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
        "<leader><C-f>",
        function()
          require("fzf-lua").grep_visual()
        end,
      },
      {
        "<leader><C-r>",
        function()
          require("fzf-lua").resume()
        end,
      },
    },
  },
}
