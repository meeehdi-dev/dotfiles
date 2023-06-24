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
            local msg = "[None]"
            local buf_ft = vim.api.nvim_buf_get_option(0, "filetype")
            local clients = vim.lsp.get_active_clients()
            if next(clients) == nil then
              return msg
            end
            for _, client in ipairs(clients) do
              local filetypes = client.config.filetypes
              if filetypes and vim.fn.index(filetypes, buf_ft) ~= -1 then
                return buf_ft .. " [" .. client.name .. "]"
              end
            end
            return msg
          end,
        },
      },
      inactive_sections = {
        lualine_c = { { "filename", path = 1 } },
      },
    },
  },
}
