return {
  {
    "nvim-telescope/telescope.nvim",
    tag = "0.1.6",
    dependencies = {
      "nvim-lua/plenary.nvim",
      {
        "nvim-telescope/telescope-fzf-native.nvim",
        build = "cmake -S. -Bbuild -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release && cmake --install build --prefix build",
      },
      {
        "nvim-treesitter/nvim-treesitter",
        build = ":TSUpdate",
      },
    },
    config = function()
      require("telescope").setup({})
      require("telescope").load_extension("fzf")
    end,
    keys = {
      {
        "<C-p>",
        function()
          require("telescope.builtin").find_files()
        end,
      },
      {
        "gd",
        function()
          require("telescope.builtin").lsp_definitions()
        end,
      },
      {
        "gr",
        function()
          require("telescope.builtin").lsp_references()
        end,
      },
      {
        "<C-f>",
        function()
          require("telescope.builtin").live_grep()
        end,
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
