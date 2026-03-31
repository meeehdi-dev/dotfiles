local util = require("util")

vim.api.nvim_create_autocmd("PackChanged", {
  callback = function(ev)
    local name, kind = ev.data.spec.name, ev.data.kind
    if
      name == "telescope-fzf-native.nvim"
      and (kind == "install" or kind == "update")
    then
      vim.system({ "make" }, { cwd = ev.data.path })
    end
  end,
})

vim.pack.add({
  util.gh("nvim-telescope/telescope.nvim"),
  util.gh("nvim-lua/plenary.nvim"),
  util.gh("nvim-treesitter/nvim-treesitter"),
  util.gh("nvim-tree/nvim-web-devicons"),
  util.gh("nvim-telescope/telescope-fzf-native.nvim"),
  util.gh("nvim-telescope/telescope-ui-select.nvim"),
})

local telescope = require("telescope")
local telescope_config = require("telescope.config")

local vimgrep_arguments = { unpack(telescope_config.values.vimgrep_arguments) }
table.insert(vimgrep_arguments, "--hidden")
table.insert(vimgrep_arguments, "--glob=!**/.git/*")

local opts = {
  extensions = {
    ["fzf"] = {},
    ["ui-select"] = { require("telescope.themes").get_dropdown({}) },
  },
  pickers = {
    find_files = {
      find_command = {
        "rg",
        "--files",
        "--color=never",
        "--hidden",
        "--glob=!**/.git/*",
        "--glob=!**/*.uid", -- ignore godot uid files
      },
    },
  },
  defaults = {
    vimgrep_arguments = vimgrep_arguments,
  },
}

telescope.setup(opts)
telescope.load_extension("fzf")
telescope.load_extension("ui-select")

local builtin = require("telescope.builtin")

vim.keymap.set("n", "<C-p>", builtin.find_files)
vim.keymap.set("n", "grd", builtin.lsp_definitions)
vim.keymap.set("n", "grr", builtin.lsp_references)
vim.keymap.set("n", "gri", builtin.lsp_implementations)
vim.keymap.set("n", "gO", builtin.lsp_document_symbols)
vim.keymap.set("n", "<C-f>", builtin.live_grep)
vim.keymap.set("v", "<C-f>", builtin.grep_string)
vim.keymap.set("n", "<leader><C-r>", builtin.resume)
vim.keymap.set("n", "<leader>gg", builtin.git_status)
