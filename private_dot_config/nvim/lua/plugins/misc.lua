return {
  "tpope/vim-fugitive",
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
                  local bufid = vim.api.nvim_win_get_buf(id)
                  local ft = vim.api.nvim_buf_get_option(bufid, "filetype")
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
    config = true,
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
    config = true,
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
      retirementAgeMins = 10,
    },
  },
  {
    "zbirenbaum/copilot.lua",
    opts = {
      panel = {
        enabled = false,
      },
      suggestion = {
        enabled = true,
        auto_trigger = true,
        debounce = 500,
        keymap = {
          accept = "<Tab>",
          accept_word = "<C-Right>",
        },
      },
    },
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
      {
        "rcarriga/nvim-notify",
        opts = {
          render = "wrapped-compact",
          stages = "static",
        },
      },
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
    "norcalli/nvim-colorizer.lua",
    config = function()
      require("colorizer").setup({ "*" }, { css = true })
    end,
  },
  {
    "meeehdi-dev/win-picker.nvim",
    opts = {
      hl_group = "lualine_a_normal",
      filter = function(id)
        local bufid = vim.api.nvim_win_get_buf(id)
        local ft = vim.api.nvim_buf_get_option(bufid, "filetype")
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
