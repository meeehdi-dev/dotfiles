require("telescope").setup({
  pickers = {
    live_grep = {
      additional_args = function()
        return { "--hidden" }
      end
    },
    buffers = {
      sort_lastused = true,
      mappings = {
        n = {
          ["<C-d>"] = require("telescope.actions").delete_buffer,
        },
      },
    },
  },
  defaults = {
    file_ignore_patterns = {
      "node_modules"
    }
  }
})
