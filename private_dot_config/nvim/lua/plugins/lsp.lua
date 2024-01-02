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
        "package.json"
      )(filename)
    end,
    on_attach = function(_, bufnr)
      vim.api.nvim_create_autocmd("BufWritePre", {
        buffer = bufnr,
        callback = function()
          if vim.fn.exists(":EslintFixAll") > 0 then
            vim.cmd.EslintFixAll()
          end
        end,
      })
    end,
  },
  ["tailwindcss"] = {
    filetypes = { "html", "javascriptreact", "typescriptreact", "css" },
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
          ensure_installed = { "lua_ls", "tsserver", "eslint" },
          automatic_installation = true,
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
          start_delay = 5000,
        },
      },
    },
    keys = {
      {

        "<leader>oi",
        function()
          local buf_nr = vim.api.nvim_get_current_buf()
          local clients =
            vim.lsp.get_clients({ bufnr = buf_nr, name = "tsserver" })
          if next(clients) == nil then
            return
          end

          vim.lsp.buf.execute_command({
            command = "_typescript.organizeImports",
            arguments = { vim.api.nvim_buf_get_name(0) },
          })
        end,
      },
    },
  },
}
