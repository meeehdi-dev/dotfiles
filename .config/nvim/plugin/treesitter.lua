local util = require("util")

vim.api.nvim_create_autocmd("PackChanged", {
  callback = function(ev)
    local name, kind = ev.data.spec.name, ev.data.kind
    if
      name == "nvim-treesitter"
      and (kind == "install" or kind == "update")
    then
      vim.cmd(":TSUpdate")
    end
  end,
})

vim.pack.add({
  util.gh("nvim-treesitter/nvim-treesitter"),
  util.gh("lewis6991/ts-install.nvim"),
  util.gh("nvim-treesitter/nvim-treesitter-textobjects"),
  util.gh("nvim-treesitter/nvim-treesitter-context"),
})

require("ts-install").setup({
  auto_install = true,
  ensure_install = {
    "vim",
    "regex",
    "lua",
    "bash",
    "markdown",
    "markdown_inline",
  },
})

require("nvim-treesitter-textobjects").setup()

require("treesitter-context").setup({
  max_lines = 5,
})

-- FIXME: should be handled by either treesitter or ts-install
vim.api.nvim_create_autocmd({ "BufRead", "FileType" }, {
  desc = "Enable Treesitter",
  callback = function(event)
    local bufnr = event.buf
    local filetype = vim.api.nvim_get_option_value("filetype", { buf = bufnr })

    -- Skip if no filetype
    if filetype == "" then
      return
    end

    -- Get parser name based on filetype
    local parser_name = vim.treesitter.language.get_lang(filetype)
    if not parser_name then
      vim.notify(
        vim.inspect("No treesitter parser found for filetype: " .. filetype),
        vim.log.levels.WARN
      )
      return
    end

    -- Try to get existing parser
    local parser_configs = require("nvim-treesitter.parsers")
    if not parser_configs[parser_name] then
      return -- Parser not available, skip silently
    end

    -- Start treesitter for this buffer
    vim.notify(
      vim.inspect(
        "Starting treesitter parser "
          .. parser_name
          .. " for filetype: "
          .. filetype
      ),
      vim.log.levels.WARN
    )
    vim.treesitter.start(bufnr, parser_name)
    -- Use regex based syntax-highlighting as fallback as some plugins might need it
    vim.bo[bufnr].syntax = "ON"
    -- Use treesitter for indentation
    vim.bo[bufnr].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
  end,
})
