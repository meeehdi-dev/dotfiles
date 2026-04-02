local npm_root = vim.fn.system("npm root -g")
npm_root = vim.trim(npm_root)

return {
  filetypes = {
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
    "vue",
  },
  init_options = {
    plugins = {
      {
        name = "@vue/typescript-plugin",
        location = npm_root .. "/@vue/language-server",
        languages = { "vue" },
      },
    },
  },
}
