return {
  {
    "saghen/blink.cmp",
    version = "1.*",
    opts = {
      completion = {
        list = { selection = { auto_insert = false } },
      },
      fuzzy = {
        implementation = "rust",
        sorts = { "exact", "score", "sort_text" },
      },
      keymap = { preset = "enter" },
    },
  },
}
