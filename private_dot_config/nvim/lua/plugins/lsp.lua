local handler_opts = {
  ["eslint"] = {
    filetypes = {
      "javascript",
      "javascriptreact",
      "typescript",
      "typescriptreact",
      "json",
    },
    root_dir = function(filename, buf_nr)
      -- ignore json files that are not i18n
      local buf_ft = vim.api.nvim_get_option_value("filetype", { buf = buf_nr })
      if buf_ft == "json" and vim.fn.matchstr(filename, "i18n") == "" then
        return nil
      end

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
    filetypes = { "html", "javascriptreact", "typescriptreact", "css" },
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
    "neovim/nvim-lspconfig",
    event = "BufRead",
    dependencies = {
      {
        "williamboman/mason-lspconfig.nvim",
        dependencies = {
          {
            "williamboman/mason.nvim",
            build = ":MasonUpdate",
            config = true,
          },
          {
            "folke/neodev.nvim",
            config = true,
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
            config = true,
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
