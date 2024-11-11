return {
  {
    "ibhagwan/fzf-lua",
    config = true,
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
        "<C-f>",
        function()
          require("fzf-lua").grep_visual()
        end,
        mode = "v",
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
