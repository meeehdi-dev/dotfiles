return {
  on_init = function(client)
    client.handlers["tsserver/request"] = function(_, result, context)
      local clients =
        vim.lsp.get_clients({ bufnr = context.bufnr, name = "ts_ls" })

      if #clients == 0 then
        vim.notify(
          "Could not find `ts_ls` lsp client, `vue_ls` would not work without it.",
          vim.log.levels.ERROR
        )
        return
      end
      local ts_client = clients[1]

      local param = unpack(result)
      local id, command, payload = unpack(param)

      ts_client:exec_cmd({
        title = "vue_request_forward",
        command = "typescript.tsserverRequest",
        arguments = {
          command,
          payload,
        },
      }, { bufnr = context.bufnr }, function(_, r)
        local response = r and r.body

        if response == nil then
          return
        end

        local response_data = { { id, response } }

        client:notify("tsserver/response", response_data)
      end)
    end
  end,
}
