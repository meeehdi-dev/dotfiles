return {
  {
    "hrsh7th/nvim-cmp",
    dependencies = {
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-buffer",
      "hrsh7th/cmp-path",
      "hrsh7th/cmp-cmdline",
      "L3MON4D3/LuaSnip",
      {
        "windwp/nvim-autopairs",
        config = true,
      },
    },
    config = function()
      local cmp = require("cmp")
      cmp.event:on(
        'confirm_done',
        require('nvim-autopairs.completion.cmp').on_confirm_done()
      )

      cmp.setup({
        mapping = cmp.mapping.preset.insert({
          ["<Up>"] = cmp.mapping.select_prev_item({ behavior = cmp.SelectBehavior.Select }),
          ["<Down>"] = cmp.mapping.select_next_item({ behavior = cmp.SelectBehavior.Select }),
          ["<CR>"] = cmp.mapping.confirm({ behavior = cmp.ConfirmBehavior.Insert, select = false }),
          ["<C-Space>"] = cmp.mapping.complete(),
        }),
        sources = cmp.config.sources({
          { name = "path",     max_item_count = 5 },
          { name = "nvim_lsp", max_item_count = 10, keyword_length = 1 },
          { name = "buffer",   max_item_count = 5, keyword_length = 3 },
          { name = "luasnip",  max_item_count = 5, keyword_length = 2 },
        }),
        snippet = {
          expand = function(args)
            require("luasnip").lsp_expand(args.body)
          end,
        },
      })

      cmp.setup.cmdline({ "/", "?" }, {
        mapping = cmp.mapping.preset.cmdline({
          ["<Up>"] = cmp.mapping(cmp.mapping.select_prev_item(), { "i", "c" }),
          ["<Down>"] = cmp.mapping(cmp.mapping.select_next_item(), { "i", "c" }),
        }),
        sources = cmp.config.sources({
          { name = "buffer", max_item_count = 10 },
        }),
      })

      cmp.setup.cmdline(":", {
        mapping = cmp.mapping.preset.cmdline({
          ["<Up>"] = cmp.mapping(cmp.mapping.select_prev_item(), { "i", "c" }),
          ["<Down>"] = cmp.mapping(cmp.mapping.select_next_item(), { "i", "c" }),
        }),
        sources = cmp.config.sources({
          { name = "cmdline", max_item_count = 10 },
        }),
      })
    end,
  }
}
