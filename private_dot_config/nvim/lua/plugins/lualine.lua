return {
  "nvim-lualine/lualine.nvim",
  dependencies = { "nvim-tree/nvim-web-devicons", "folke/tokyonight.nvim" },
  opts = {
    options = {
      component_separators = "",
    },
    sections = {
      lualine_a = {
        {
          "mode",
          fmt = function(str) return string.lower(str:sub(1, 1)) end,
          separator = { left = "", right = "" },
        },
        {
          "",
          separator = { left = "", right = "" },
          color = { bg = "#212736" },
          draw_empty = true,
        },
      },
      lualine_b = {
        {
          "branch",
          fmt = function(str)
            local branch = str:sub(1, 10)
            if str:len() > 10 then
              branch = branch .. "..."
            end
            return branch
          end,
          draw_empty = true,
        },
        {
          "diff",
          diff_color = {
            added = "DiffAdd",
            modified = "DiffChange",
            removed = "DiffDelete",
          },
          symbols = {
            added = " ",
            modified = " ",
            removed = " ",
          }
        },
      },
      lualine_c = {
        {
          "diagnostics",
          symbols = {
            error = "󰀨 ",
            warn = " ",
            info = " ",
            hint = " ",
          },
        },
        { "filename", path = 1 },
      },
      lualine_x = {
        function()
          local lsp = {}
          local buf_ft = vim.api.nvim_buf_get_option(0, "filetype")
          if buf_ft == "" then
            return "..."
          end
          local clients = vim.lsp.buf_get_clients()
          if next(clients) ~= nil then
            for _, client in pairs(clients) do
              local filetypes = client.config.filetypes
              if filetypes and vim.fn.index(filetypes, buf_ft) ~= -1 then
                table.insert(lsp, client.name)
              end
            end
          end
          if #lsp == 0 then
            table.insert(lsp, "None")
          end
          return " " .. table.concat(lsp, ", ")
        end,
      },
      lualine_y = {},
    },
    inactive_sections = {
      lualine_c = {
        { "filename", path = 1 },
      },
    },
  },
  config = function(_, opts)
    require("tokyonight.colors").setup()
    require("lualine").setup(opts)
  end
}
