return {
  {
    "saghen/blink.cmp",
    version = "1.*",
    opts = {
      completion = {
        accept = {
          auto_brackets = {
            enabled = false,
          },
        },
        documentation = {
          auto_show = true,
        },
        keyword = { range = "full" },
        list = { selection = { auto_insert = false } },
      },
      fuzzy = {
        implementation = "rust",
        sorts = { "exact", "score", "sort_text" },
      },
      keymap = { preset = "enter" },
      signature = {
        enabled = true,
      },
      sources = {
        min_keyword_length = 3,
      },
    },
  },
}
