local json_ft = { "json", "jsonc" }
local function format()
  local formatted = require("conform").format()
  if not formatted then
    vim.lsp.buf.format()
  end
end

return {
  {
    "stevearc/conform.nvim",
    opts = {
      formatters_by_ft = {
        lua = { "stylua" },
        css = { "prettier" },
        javascript = { "prettier" },
        javascriptreact = { "prettier" },
        typescript = { "prettier" },
        typescriptreact = { "prettier" },
      },
    },
    keys = {
      {
        "<leader>f",
        function()
          local buf_ft = vim.api.nvim_get_option_value("filetype", {})
          if buf_ft == "json" then
            vim.cmd(":%!jq '.'")
          else
            format()
          end
        end,
      },
      {
        "<leader>fs",
        function()
          local buf_ft = vim.api.nvim_get_option_value("filetype", {})
          if json_ft[buf_ft] then
            vim.cmd(":%!jq --sort-keys '.'")
          else
            format()
          end
        end,
      },
    },
  },
}
