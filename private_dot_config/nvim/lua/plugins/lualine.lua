local function lualine_lsp()
  local lsp = {}
  local buf = vim.api.nvim_get_current_buf()
  local buf_ft = vim.api.nvim_get_option_value("filetype", { buf = buf })
  if buf_ft == "" then
    return "..."
  end
  local clients = vim.lsp.get_clients({ bufnr = buf })
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
end

return {
  "nvim-lualine/lualine.nvim",
  event = "BufRead",
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
          fmt = function(str)
            local mode = string.lower(str:sub(1, 1))
            local rec = vim.fn.reg_recording()
            if rec == "" then
              return mode
            else
              return mode .. "@"
            end
          end,
          separator = { left = "", right = "" },
        },
      },
      lualine_b = { "searchcount" },
      lualine_c = {},
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
        lualine_lsp,
      },
      lualine_z = {
        { "filename", path = 1 },
      },
    },
    inactive_sections = {
      lualine_a = {
        {
          "mode",
          fmt = function()
            return "."
          end,
          separator = { left = "", right = "" },
        },
      },
      lualine_b = {},
      lualine_c = {},
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
        lualine_lsp,
      },
      lualine_z = {
        { "filename", path = 1 },
      },
    },
  },
  config = function(_, opts)
    require("tokyonight.colors").setup()
    require("lualine").setup(opts)
  end,
}
