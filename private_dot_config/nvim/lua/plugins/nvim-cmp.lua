return {
  {
    "hrsh7th/nvim-cmp",
    event = "VeryLazy",
    dependencies = {
      "neovim/nvim-lspconfig",
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-buffer",
      "hrsh7th/cmp-path",
      "hrsh7th/cmp-cmdline",
      "SirVer/ultisnips",
      "quangnguyen30192/cmp-nvim-ultisnips",
    },
    opts = {
      expand = function(args)
        vim.fn["UltiSnips#Anon"](args.body)
      end,
    },
    config = function(_, opts)
      local cmp = require("cmp")

      opts.sources = cmp.config.sources({
        { name = "nvim_lsp", max_item_count = 10 },
        { name = "ultisnips", max_item_count = 10 },
      }, {
        { name = "buffer", max_item_count = 10 },
      })

      opts.mapping = cmp.mapping.preset.insert({
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
          { name = "path", max_item_count = 10 },
        }, {
          { name = "cmdline", max_item_count = 10 },
        }),
        matching = { disallow_symbol_nonprefix_matching = false },
      })
    end,
  },
}
