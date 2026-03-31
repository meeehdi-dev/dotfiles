local util = require("util")

vim.pack.add({
  util.gh("folke/noice.nvim"),
  util.gh("MunifTanjim/nui.nvim"),
  util.gh("folke/snacks.nvim"),
})

require("snacks").setup()

require("noice").setup({
  lsp = {
    override = {
      ["vim.lsp.util.convert_input_to_markdown_lines"] = true,
      ["vim.lsp.util.stylize_markdown"] = true,
    },
  },
})
