local telescope = require("telescope.builtin")
local mason = require("mason")
local mason_lsp = require("mason-lspconfig")
local lspconfig = require('lspconfig')
local lsp_capabilities = require('cmp_nvim_lsp').default_capabilities()
local lsp_format = require("lsp-format")

mason.setup()
mason_lsp.setup({
  automatic_installation = true,
})

mason_lsp.setup_handlers({
  function(server_name)
    local opts = {
      capabilities = lsp_capabilities,
    }

    if server_name == "lua_ls" then
      opts.settings = {
        Lua = {
          diagnostics = {
            globals = { "vim" },
          },
        }
      }
    end

    lspconfig[server_name].setup(opts)
  end,
})

require("lsp-format").setup()

vim.api.nvim_create_autocmd('LspAttach', {
  callback = function(ev)
    local bufnr = ev.buf
    local opts = { buffer = bufnr, remap = false }

    vim.keymap.set("n", "<F2>", vim.lsp.buf.rename, opts)
    vim.keymap.set("n", "gd", telescope.lsp_definitions, opts)
    vim.keymap.set("n", "gr", telescope.lsp_references, opts)
    vim.keymap.set("n", "gi", vim.lsp.buf.hover, opts)
    vim.keymap.set("n", "<C-a>", vim.lsp.buf.code_action, opts)
    vim.keymap.set("n", "<C-S-i>", function()
      vim.lsp.buf.execute_command({ command = "_typescript.organizeImports", arguments = { vim.api.nvim_buf_get_name(0) } })
    end, opts)

    vim.api.nvim_create_autocmd("BufWritePre", {
      pattern = { "*.ts", "*.tsx", "*.js", "*.jsx", "*.json" },
      -- buffer = bufnr,
      command = "EslintFixAll",
    })

    vim.lsp.for_each_buffer_client(bufnr, function (client)
      lsp_format.on_attach(client)
      if client.supports_method('textDocument/documentHighlight') then
        if client.supports_method("textDocument/documentHighlight") then
          vim.api.nvim_create_autocmd("CursorHold", {
            buffer = bufnr,
            callback = vim.lsp.buf.document_highlight,
          })
          vim.api.nvim_create_autocmd("CursorMoved", {
            buffer = bufnr,
            callback = vim.lsp.buf.clear_references,
          })
        end
      end
    end)
  end
})
