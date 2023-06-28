local handler_opts = {
  ["lua_ls"] = {
    settings = {
      Lua = {
        diagnostics = {
          globals = { "vim" },
        },
      }
    }
  },
  ["eslint"] = {
    filetypes = { "javascript", "javascriptreact", "javascript.jsx", "typescript", "typescriptreact",
      "typescript.tsx", "vue", "svelte", "astro", "json" }
  }
}

return {
  {
    "neovim/nvim-lspconfig",
    dependencies = {
      "williamboman/mason-lspconfig.nvim",
      "hrsh7th/cmp-nvim-lsp",
      {
        "williamboman/mason.nvim",
        build = ":MasonUpdate",
        config = true,
      }
    },
    config = function()
      local mason_lspconfig = require("mason-lspconfig")
      mason_lspconfig.setup({
        automatic_installation = true,
      })
      mason_lspconfig.setup_handlers({
        function(server_name)
          local opts = handler_opts[server_name] or {}
          opts.capabilities = require("cmp_nvim_lsp").default_capabilities()
          opts.on_attach = function(client, bufnr)
            vim.api.nvim_create_autocmd("BufWritePre", {
              buffer = bufnr,
              callback = function()
                if vim.fn.exists(":EslintFixAll") > 0 then
                  vim.cmd.EslintFixAll()
                end
              end
            })
            if client.server_capabilities.documentHighlightProvider then
              vim.api.nvim_create_autocmd("CursorHold", {
                buffer = bufnr,
                callback = function()
                  vim.lsp.buf.document_highlight()
                end
              })
              vim.api.nvim_create_autocmd("CursorMoved", {
                buffer = bufnr,
                callback = vim.lsp.buf.clear_references
              })
            end
          end

          require("lspconfig")[server_name].setup(opts)
        end,
      })
    end,
  },
}
