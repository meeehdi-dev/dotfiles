local util = require("util")

vim.pack.add({
  {
    src = util.gh("saghen/blink.cmp"),
    version = "v1",
  },
})

require("blink.cmp").setup({
  keymap = {
    preset = "enter",
  },
  completion = {
    documentation = { auto_show = true, auto_show_delay_ms = 0 },
    accept = {
      auto_brackets = { enabled = false },
    },
    list = {
      selection = {
        preselect = false,
        auto_insert = false,
      },
    },
  },
  sources = {
    default = { "lsp", "path", "snippets", "buffer" },
  },
  fuzzy = {
    implementation = "prefer_rust_with_warning",
    prebuilt_binaries = { force_version = "v1.10.1" },
  },
})
