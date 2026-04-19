vim.pack.add({
  {
    src = "https://github.com/saghen/blink.cmp",
    version = vim.version.range("^1"),
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

  cmdline = {
    keymap = {
      ["<Tab>"] = { "select_next" },
      ["<Down>"] = { "select_next" },
      ["<S-Tab>"] = { "select_prev" },
      ["<Up>"] = { "select_prev" },
      ["<CR>"] = { "accept_and_enter", "fallback" },
    },
    completion = {
      menu = { auto_show = true },
      list = {
        selection = {
          preselect = false,
          auto_insert = true,
        },
      },
    },
  },
  fuzzy = {
    implementation = "rust",
  },
})
