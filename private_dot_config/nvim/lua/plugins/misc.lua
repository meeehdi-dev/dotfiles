return {
  {
    "nvim-tree/nvim-tree.lua",
    dependencies = {
      "meeehdi-dev/win-picker.nvim",
    },
    opts = {
      actions = {
        open_file = {
          window_picker = {
            picker = function()
              return require("win-picker").pick_win({
                filter = function(id)
                  local buf_nr = vim.api.nvim_win_get_buf(id)
                  local ft = vim.api.nvim_buf_get_option(buf_nr, "filetype")
                  return not vim.tbl_contains(
                    { "noice", "notify", "NvimTree" },
                    ft
                  )
                end,
              })
            end,
          },
          quit_on_open = true,
        },
      },
    },
    keys = {
      {
        "<leader>e",
        function()
          require("nvim-tree.api").tree.toggle({
            find_file = true,
            focus = true,
          })
        end,
      },
    },
  },
  {
    "rmagatti/auto-session",
    opts = {
      auto_session_suppress_dirs = { "~/" },
    },
  },
  {
    "lukas-reineke/indent-blankline.nvim",
    main = "ibl",
    opts = {
      scope = {
        show_start = false,
      },
    },
  },
  {
    "chrisgrieser/nvim-early-retirement",
    opts = {
      retirementAgeMins = 5,
    },
  },
  {
    "github/copilot.vim",
    config = function()
      vim.keymap.set("i", "<C-Right>", "<Plug>(copilot-accept-word)")
      vim.keymap.set("i", "<M-Right>", "<Plug>(copilot-accept-line)")
    end,
  },
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
  },
  {
    "numToStr/Comment.nvim",
    config = true,
  },
  {
    "folke/noice.nvim",
    dependencies = {
      "MunifTanjim/nui.nvim",
    },
    opts = {
      lsp = {
        override = {
          ["vim.lsp.util.convert_input_to_markdown_lines"] = true,
          ["vim.lsp.util.stylize_markdown"] = true,
          ["cmp.entry.get_documentation"] = true,
        },
      },
    },
  },
  {
    "folke/todo-comments.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
    },
    opts = {
      signs = false,
    },
  },
  {
    "folke/flash.nvim",
    opts = {
      search = {
        multi_window = false,
        wrap = false,
      },
      jump = {
        nohlsearch = true,
      },
      modes = {
        char = {
          search = {
            wrap = false,
          },
          highlight = {
            backdrop = false,
          },
        },
      },
    },
  },
  {
    "lewis6991/gitsigns.nvim",
    config = true,
    keys = {
      {
        "<leader><Up>",
        function()
          require("gitsigns.actions").prev_hunk()
        end,
      },
      {
        "<leader><Down>",
        function()
          require("gitsigns.actions").next_hunk()
        end,
      },
      {
        "<leader>b",
        function()
          require("gitsigns.actions").blame_line()
        end,
      },
    },
  },
  {
    "kylechui/nvim-surround",
    config = true,
  },
  {
    "laytan/cloak.nvim",
    config = true,
  },
  {
    "stevearc/dressing.nvim",
    config = true,
  },
  {
    "meeehdi-dev/win-picker.nvim",
    opts = {
      hl_group = "lualine_a_normal",
      filter = function(id)
        local buf_nr = vim.api.nvim_win_get_buf(id)
        local ft = vim.api.nvim_buf_get_option(buf_nr, "filetype")
        return not vim.tbl_contains({ "noice", "notify" }, ft)
      end,
    },
    keys = {
      {
        "<leader>w",
        function()
          local win_id = require("win-picker").pick_win()
          if win_id then
            vim.api.nvim_set_current_win(win_id)
          end
        end,
      },
    },
  },
}
