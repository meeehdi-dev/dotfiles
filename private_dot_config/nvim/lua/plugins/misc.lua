return {
  "tpope/vim-fugitive",
  {
    "nvim-tree/nvim-tree.lua",
    dependencies = {
      {
        "meeehdi-dev/win-picker.nvim",
        dev = true,
        config = true,
      },
    },
    opts = {
      actions = {
        open_file = {
          window_picker = {
            picker = function()
              return require("win-picker").pick_win()
            end,
          },
          quit_on_open = true,
        },
      },
    },
    config = true,
    keys = {
      {
        "<C-e>",
        function()
          require("nvim-tree.api").tree.toggle({
            find_file = true,
            focus = true,
          })
        end
      }
    }
  },
  {
    "rmagatti/auto-session",
    config = true,
  },
  {
    "lukas-reineke/indent-blankline.nvim",
    opts = {
      show_current_context = true,
      show_current_context_start = true,
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
        enable = false,
      },
      suggestion = {
        auto_trigger = true,
        debounce = 100,
        keymap = {
          next = "<S-Tab>",
          accept = "<Tab>",
          accept_word = "<C-Right>",
        },
      },
    },
  },
  {
    "folke/trouble.nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    opts = {
      auto_close = true,
    },
    keys = {
      {
        "<C-t>",
        vim.cmd.TroubleToggle,
      }
    }
  },
  {
    "prettier/vim-prettier",
    build = "yarn install --frozen-lockfile --production",
    keys = {
      {
        "<leader>f",
        function()
          vim.g["prettier#quickfix_enabled"] = 0
          local rc = vim.fn.findfile(".prettierrc", ".;")
          local rcjson = vim.fn.findfile(".prettierrc.json", ".;")
          if rc == "" and rcjson == "" then
            vim.lsp.buf.format()
          else
            vim.cmd.Prettier()
          end
        end
      }
    }
  },
  {
    "numToStr/Comment.nvim",
    config = true,
  },
  {
    "folke/noice.nvim",
    config = true,
    dependencies = {
      "MunifTanjim/nui.nvim",
    }
  },
  {
    "folke/todo-comments.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
    },
    opts = {
      signs = false,
    },
    config = true,
  },
  {
    "folke/flash.nvim",
    opts = {
      search = {
        multi_window = false,
      },
      jump = {
        nohlsearch = true,
      },
      prompt = {
        enabled = false,
      },
      modes = {
        char = {
          enabled = false,
        },
      },
    },
  },
  {
    "mbbill/undotree",
    keys = {
      {
        "<leader>u",
        vim.cmd.UndotreeToggle,
      },
    },
  },
  "sindrets/diffview.nvim",
  "airblade/vim-gitgutter",
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
    end
  },
  {
    "meeehdi-dev/win-picker.nvim",
    -- dev = true,
    config = {
      hlgroup = "lualine_a_normal",
      filter = function(id)
        local bufid = vim.api.nvim_win_get_buf(id)
        local ft = vim.api.nvim_buf_get_option(bufid, "filetype")
        return not vim.tbl_contains({"noice", "notify"}, ft)
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
    }
  },
}
