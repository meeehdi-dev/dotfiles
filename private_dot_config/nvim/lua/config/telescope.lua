require("telescope").setup({
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
})
