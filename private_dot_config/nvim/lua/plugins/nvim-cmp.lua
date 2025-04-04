return {
  {
    "hrsh7th/nvim-cmp",
    event = "VeryLazy",
    dependencies = {
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-buffer",
      "hrsh7th/cmp-path",
      "hrsh7th/cmp-cmdline",
    },
    opts = {
      expand = function(args)
        vim.snippet.expand(args.body)
      end,
    },
    config = function(_, opts)
      local cmp = require("cmp")

      opts.sources = cmp.config.sources({
        { name = "nvim_lsp", max_item_count = 10 },
        { name = "path", max_item_count = 5 },
        { name = "buffer", max_item_count = 5 },
      })

      opts.mapping = cmp.mapping.preset.insert({
        ["<C-Space>"] = cmp.mapping.complete({
          config = {
            sources = {
              { name = "nvim_lsp", max_item_count = 20 },
            },
          },
        }),
        ["<CR>"] = {
          i = cmp.mapping.confirm({ select = false }),
        },
      })

      cmp.setup(opts)

      cmp.setup.cmdline({ "/", "?" }, {
        mapping = cmp.mapping.preset.cmdline(),
        sources = {
          { name = "buffer", max_item_count = 10 },
        },
      })

      cmp.setup.cmdline(":", {
        mapping = cmp.mapping.preset.cmdline(),
        sources = cmp.config.sources({
          { name = "cmdline", max_item_count = 10 },
        }),
        matching = { disallow_symbol_nonprefix_matching = false },
      })
    end,
  },
}
