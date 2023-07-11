return {
  "tpope/vim-fugitive",
  {
    "nvim-tree/nvim-tree.lua",
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
        "<C-h>",
        vim.cmd.UndotreeToggle,
      },
    },
  },
  "sindrets/diffview.nvim",
  "airblade/vim-gitgutter",
}
