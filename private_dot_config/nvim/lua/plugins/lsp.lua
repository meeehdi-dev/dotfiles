local handler_opts = {
  ["cssls"] = {
    settings = {
      css = {
        validate = true,
        lint = {
          unknownAtRules = "ignore",
        },
      },
    },
  },
  ["ts_ls"] = {
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
  opts.capabilities = require("cmp_nvim_lsp").default_capabilities()

  if server_name == "ts_ls" then
    require("lspconfig")["volar"].setup({})
  end
  require("lspconfig")[server_name].setup(opts)
end

return {
  {
    "neovim/nvim-lspconfig",
    event = { "BufReadPost", "BufNewFile", "BufWritePre" },
    dependencies = {
      "hrsh7th/cmp-nvim-lsp",
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
        ensure_installed = {},
        automatic_installation = false,
        handlers = {
          function(server_name)
            setup_handler(server_name)
          end,
        },
      })
    end,
  },
}
