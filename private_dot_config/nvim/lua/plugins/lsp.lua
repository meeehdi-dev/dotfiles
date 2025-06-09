local handler_opts = {
  cssls = {
    settings = {
      css = {
        validate = true,
        lint = {
          unknownAtRules = "ignore",
        },
      },
    },
  },
  volar = {
    settings = {
      html = {
        format = {
          enable = false,
        },
      },
    },
  },
  ts_ls = {
    filetypes = {
      "javascript",
      "javascriptreact",
      "javascript.jsx",
      "typescript",
      "typescriptreact",
      "typescript.jsx",
      "vue",
    },
    init_options = {
      plugins = {
        {
          name = "@vue/typescript-plugin",
          location = vim.fn.expand(
            "$HOME/.local/share/nvim/mason/packages/vue-language-server/node_modules/@vue/language-server"
          ),
          languages = { "vue" },
        },
      },
    },
  },
}

local function setup_handler(server_name)
  local opts = handler_opts[server_name] or {}
  local capabilities = vim.tbl_deep_extend(
    "force",
    {},
    vim.lsp.protocol.make_client_capabilities(),
    require("blink.cmp").get_lsp_capabilities() or {},
    opts.capabilities or {}
  )
  opts.capabilities = capabilities

  require("lspconfig")[server_name].setup(opts)
end

return {
  {
    "neovim/nvim-lspconfig",
    dependencies = {
      "saghen/blink.cmp",
      {
        "williamboman/mason.nvim",
        cmd = { "Mason" },
        opts = {},
      },
      "williamboman/mason-lspconfig.nvim",
    },
    config = function()
      local mason = require("mason")
      local mason_lspconfig = require("mason-lspconfig")

      mason.setup()
      mason_lspconfig.setup({
        automatic_enable = true,
        automatic_installation = false,
        ensure_installed = {},
        handlers = {
          setup_handler,
        },
      })
    end,
  },
}
