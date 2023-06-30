-- Hotkeys
hs.hotkey.bind("alt", "t", function()
  hs.application.launchOrFocus("WezTerm")
end)


-- Window management
local position = {
  left = hs.geometry(0, 0, .5, 1),
  right = hs.geometry(.5, 0, .5, 1),
  top = hs.geometry(0, 0, 1, .5),
  bottom = hs.geometry(0, .5, 1, .5),
  full = hs.geometry(0, 0, 1, 1),
  center = hs.geometry(.25, .25, .5, .5),
}

local function move(direction)
  local win = hs.window.focusedWindow()
  if win then
    win:move(position[direction])
  end
end

-- hs.window.animationDuration = 0

hs.hotkey.bind({ "alt", "shift" }, "left", function()
  move("left")
end)
hs.hotkey.bind({ "alt", "shift" }, "right", function()
  move("right")
end)
hs.hotkey.bind({ "alt", "shift" }, "up", function()
  move("full")
end)
hs.hotkey.bind({ "alt", "shift" }, "down", function()
  move("center")
end)
