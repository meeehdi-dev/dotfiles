return {
  {
    "nvim-lualine/lualine.nvim",
    opts = {
      options = {
        icons_enabled = false,
      },
      sections = {
        lualine_c = { { "filename", path = 1 } },
        lualine_x = {
          'encoding', 'fileformat',
          function()
            local lsp = {}
            local buf_ft = vim.api.nvim_buf_get_option(0, "filetype")
            if buf_ft == "" then
              return "..."
            end
            local clients = vim.lsp.get_active_clients()
            if next(clients) ~= nil then
              for _, client in ipairs(clients) do
                local filetypes = client.config.filetypes
                if filetypes and vim.fn.index(filetypes, buf_ft) ~= -1 then
                  table.insert(lsp, client.name)
                end
              end
            end
            if lsp.length == 0 then
              table.insert(lsp, "None")
            end
            return buf_ft .. " [" .. table.concat(lsp, ", ") .. "]"
          end,
        },
      },
      inactive_sections = {
        lualine_c = { { "filename", path = 1 } },
      },
    },
  },
}
