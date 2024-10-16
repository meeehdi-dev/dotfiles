return {
  {
    "hrsh7th/nvim-cmp",
    event = { "InsertEnter", "CmdlineEnter" },
    dependencies = {
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-buffer",
      "hrsh7th/cmp-path",
      "hrsh7th/cmp-cmdline",
      {
        "L3MON4D3/LuaSnip",
        build = "make install_jsregexp",
        dependencies = {
          "rafamadriz/friendly-snippets",
        },
      },
      "saadparwaiz1/cmp_luasnip",
    },
    config = function()
      local cmp = require("cmp")

      cmp.setup({
        mapping = cmp.mapping.preset.insert({
          ["<Up>"] = cmp.mapping.select_prev_item({
            behavior = cmp.SelectBehavior.Select,
          }),
          ["<Down>"] = cmp.mapping.select_next_item({
            behavior = cmp.SelectBehavior.Select,
          }),
          ["<CR>"] = cmp.mapping.confirm({
            behavior = cmp.ConfirmBehavior.Insert,
            select = false,
          }),
          ["<C-Space>"] = function()
            cmp.close()
            cmp.complete({
              config = {
                sources = {
                  { name = "lazydev", group_index = 0 },
                  { name = "nvim_lsp" },
                },
              },
            })
          end,
        }),
        sources = cmp.config.sources({
          { name = "lazydev", max_item_count = 5, group_index = 0 },
          { name = "path", max_item_count = 5 },
          { name = "nvim_lsp", max_item_count = 5 },
          { name = "luasnip", max_item_count = 5 },
          { name = "buffer", max_item_count = 5 },
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
          ["<Down>"] = cmp.mapping(
            cmp.mapping.select_next_item(),
            { "i", "c" }
          ),
        }),
        sources = cmp.config.sources({
          { name = "buffer", max_item_count = 10 },
        }),
      })

      cmp.setup.cmdline(":", {
        mapping = cmp.mapping.preset.cmdline({
          ["<Up>"] = cmp.mapping(cmp.mapping.select_prev_item(), { "i", "c" }),
          ["<Down>"] = cmp.mapping(
            cmp.mapping.select_next_item(),
            { "i", "c" }
          ),
        }),
        sources = cmp.config.sources({
          { name = "cmdline", max_item_count = 10 },
        }),
      })
    end,
  },
}
