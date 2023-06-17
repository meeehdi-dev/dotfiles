local lsp = require("lsp-zero")
local telescope = require("telescope.builtin")
local cmp = require("cmp")
local tree = require("nvim-tree.api")
local cmp_autopairs = require("nvim-autopairs.completion.cmp")

require("copilot").setup({
  suggestion = { enabled = false },
  panel = { enabled = false },
})
require("copilot_cmp").setup()

lsp.preset("recommended")
lsp.ensure_installed({
  "tsserver",
})

cmp.event:on("confirm_done", cmp_autopairs.on_confirm_done())

local cmp_select = { behavior = cmp.SelectBehavior.Select }
local cmp_mappings = lsp.defaults.cmp_mappings({
  ["<Up>"] = cmp.mapping.select_prev_item(cmp_select),
  ["<Down>"] = cmp.mapping.select_next_item(cmp_select),
  ["<CR>"] = cmp.mapping.confirm({ select = false }),
  ["<C-Space>"] = cmp.mapping.complete(),
})

cmp_mappings["<Tab>"] = nil
cmp_mappings["<S-Tab>"] = nil

cmp.setup.cmdline({ "/", "?" }, {
  mapping = cmp.mapping.preset.cmdline({
    ["<Up>"] = cmp.mapping(cmp.mapping.select_prev_item(), { "i", "c" }),
    ["<Down>"] = cmp.mapping(cmp.mapping.select_next_item(), { "i", "c" }),
  }),
  sources = {
    { name = "buffer" }
  }
})

cmp.setup.cmdline(":", {
  mapping = cmp.mapping.preset.cmdline({
    ["<Up>"] = cmp.mapping(cmp.mapping.select_prev_item(), { "i", "c" }),
    ["<Down>"] = cmp.mapping(cmp.mapping.select_next_item(), { "i", "c" }),
  }),
  sources = cmp.config.sources({
    { name = "path" }
  }, {
    { name = "cmdline" }
  })
})

lsp.setup_nvim_cmp({
  mapping = cmp_mappings,
  sources = {
    { name = "copilot" },
    { name = "path" },
    { name = "nvim_lsp" },
    { name = "luasnip", keyword_length = 2 },
    { name = "nvim_lua" },
    { name = "buffer",  keyword_length = 3 },
  },
  snippet = {
    expand = function(args)
      require("luasnip").lsp_expand(args.body)
    end,
  },
})

lsp.on_attach(function(client, bufnr)
  local opts = { buffer = bufnr, remap = false }

  vim.keymap.set("n", "<F2>", vim.lsp.buf.rename, opts)
  vim.keymap.set("n", "gd", telescope.lsp_definitions, opts)
  vim.keymap.set("n", "gr", telescope.lsp_references, opts)
  vim.keymap.set("n", "gi", vim.lsp.buf.hover, opts)
  vim.keymap.set("n", "<C-a>", vim.lsp.buf.code_action, opts)
  vim.keymap.set("n", "<C-i>", function()
    vim.lsp.buf.execute_command({ command = "_typescript.organizeImports", arguments = { vim.api.nvim_buf_get_name(0) } })
  end, opts)

  vim.api.nvim_create_autocmd("BufWritePre", {
    pattern = { "*.ts", "*.tsx", "*.js", "*.jsx", "*.json" },
    -- buffer = bufnr,
    command = "EslintFixAll",
  })
  if client.supports_method "textDocument/documentHighlight" then
    vim.api.nvim_create_autocmd("CursorHold", {
      buffer = bufnr,
      callback = vim.lsp.buf.document_highlight,
    })
    vim.api.nvim_create_autocmd("CursorMoved", {
      buffer = bufnr,
      callback = vim.lsp.buf.clear_references,
    })
  end
end)

lsp.setup()

require("lspconfig").eslint.setup({
  filetypes = { "javascript", "javascriptreact", "typescript", "typescriptreact", "json" },
})


require("lspconfig").lua_ls.setup({
  settings = {
    Lua = {
      diagnostics = {
        globals = { "vim" }
      }
    }
  }
})
