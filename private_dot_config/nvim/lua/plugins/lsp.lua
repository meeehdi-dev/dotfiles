local handler_opts = {
  ["eslint"] = {
    filetypes = {
      "javascript",
      "javascriptreact",
      "typescript",
      "typescriptreact",
    },
    root_dir = function(filename)
      -- https://github.com/neovim/nvim-lspconfig/blob/master/lua/lspconfig/server_configurations/eslint.lua
      return require("lspconfig").util.root_pattern(
        ".eslintrc",
        ".eslintrc.js",
        ".eslintrc.cjs",
        ".eslintrc.yaml",
        ".eslintrc.yml",
        ".eslintrc.json",
        "eslint.config.js",
        "eslint.config.mjs",
        "eslint.config.cjs",
        "package.json"
      )(filename)
    end,
  },
  ["tailwindcss"] = {
    filetypes = { "html", "javascriptreact", "typescriptreact", "css", "vue" },
  },
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
  -- ["volar"] = {
  --   filetypes = {
  --     "typescript",
  --     "vue",
  --   },
  --   init_options = {
  --     typescript = {
  --       -- TODO: better path handling + macos support
  --       tsdk = "/home/mhdmhr/.local/share/mise/installs/node/22.9.0/lib/node_modules/typescript/lib",
  --     },
  --   },
  -- },
  -- ["ts_ls"] = {
  --   filetypes = {
  --     "typescript",
  --     "vue",
  --   },
  --   init_options = {
  --     plugins = {
  --       {
  --         name = "@vue/typescript-plugin",
  --         -- TODO: better path handling + macos support
  --         location = "/home/mhdmhr/.local/share/mise/installs/node/22.9.0/lib/node_modules/@vue/typescript-plugin",
  --         languages = { "vue" },
  --       },
  --     },
  --   },
  -- },
}

local function setup_handler(server_name)
  local opts = handler_opts[server_name] or {}
  opts.capabilities = require("cmp_nvim_lsp").default_capabilities()
  local handler_on_attach = opts.on_attach
  opts.on_attach = function(client, bufnr)
    if handler_on_attach then
      handler_on_attach(client, bufnr)
    end

    if client.server_capabilities.documentHighlightProvider then
      vim.api.nvim_create_autocmd("CursorHold", {
        buffer = bufnr,
        callback = function()
          vim.lsp.buf.document_highlight()
        end,
      })
      vim.api.nvim_create_autocmd("CursorMoved", {
        buffer = bufnr,
        callback = vim.lsp.buf.clear_references,
      })
    end
  end

  require("lspconfig")[server_name].setup(opts)
end

return {
  {
    "folke/lazydev.nvim",
    ft = "lua",
    opts = {
      library = {
        -- See the configuration section for more details
        -- Load luvit types when the `vim.uv` word is found
        { path = "luvit-meta/library", words = { "vim%.uv" } },
      },
    },
  },
  { "Bilal2453/luvit-meta", lazy = true },
  {
    "neovim/nvim-lspconfig",
    event = "VeryLazy",
    dependencies = {
      {
        "williamboman/mason-lspconfig.nvim",
        dependencies = {
          {
            "williamboman/mason.nvim",
            build = ":MasonUpdate",
            opts = {},
          },
        },
        opts = {
          handlers = {
            setup_handler,
          },
        },
      },
      "hrsh7th/cmp-nvim-lsp",
      {
        "WhoIsSethDaniel/mason-tool-installer.nvim",
        dependencies = {
          {
            "williamboman/mason.nvim",
            build = ":MasonUpdate",
            opts = {},
          },
        },
        opts = {
          ensure_installed = {
            "css-lsp",
            "eslint-lsp",
            "gopls",
            "html-lsp",
            "json-lsp",
            "lua-language-server",
            "prettier",
            "prisma-language-server",
            "rust-analyzer",
            "stylua",
            "tailwindcss-language-server",
            "typescript-language-server",
            "yaml-language-server",
          },
          auto_update = true,
        },
      },
    },
  },
}
