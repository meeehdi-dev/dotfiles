return {
  "nvim-lualine/lualine.nvim",
  dependencies = { "folke/tokyonight.nvim" },
  opts = {
    options = {
      icons_enabled = false,
      section_separators = { left = "", right = "" },
      component_separators = { left = "", right = "" },
    },
    sections = {
      lualine_a = {
        {
          "mode",
          fmt = function(str) return string.lower(str:sub(1, 1)) end,
          separator = { left = "", right = "" },
        },
      },
      lualine_b = {
        {
          "branch",
          fmt = function(str)
            if str:len() == 0 then
              return "󱓌"
            end
            local branch = str:sub(1, 10)
            if str:len() > 10 then
              branch = branch .. "..."
            end
            return "󰘬 " .. branch
          end,
        },
      },
      lualine_c = {
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
          },
        }
      },
      lualine_x = {
        {
          "diagnostics",
          symbols = {
            error = " ",
            warn = " ",
            info = " ",
            hint = " ",
          },
        },
      },
      lualine_y = {
        function()
          local lsp = {}
          local buf_ft = vim.api.nvim_buf_get_option(0, "filetype")
          if buf_ft == "" then
            return "..."
          end
          local clients = vim.lsp.get_active_clients()
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
          return table.concat(lsp, ",")
        end,
      },
      lualine_z = {
        { "filename", path = 1, shorting_target = 80 },
      },
    },
    inactive_sections = {
      lualine_c = {},
      lualine_x = {},
      lualine_z = {
        { "filename", path = 1 },
      }
    },
  },
  config = function(_, opts)
    require("tokyonight.colors").setup()
    require("lualine").setup(opts)
  end
}
