return {
  {
    "nvim-lualine/lualine.nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    opts = {
      options = {
        theme = "tokyonight",
      },
      sections = {
        lualine_a = {
          { 'mode', fmt = function(str) return string.lower(str:sub(1, 1)) end }
        },
        lualine_b = {
          {
            'branch',
            fmt = function(str)
              local branch = str:sub(1, 10)
              if str:len() > 10 then
                branch = branch .. '...'
              end
              return branch
            end
          },
          {
            'diff',
            diff_color = {
              added = { fg = '#44cc44' },
              modified = { fg = '#cccc44' },
              removed = { fg = '#ff6666' },
            },
          },
          {
            'diagnostics',
            symbols = {
              error = ' ',
              warn = ' ',
              info = ' ',
              hint = ' ',
            },
            diagnostics_color = {
              error = { fg = "#ff6666" },
              warn = { fg = "#cccc44" },
              info = { fg = "#4444cc" },
              hint = { fg = "#44cccc" },
            },
          },
        },
        lualine_c = {
          { "filename", path = 1 }
        },
        lualine_x = {
          -- 'encoding', 'fileformat',
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
  },
}
