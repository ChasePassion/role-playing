# Design Knowledge

## DropdownMenu (shadcn) sideOffset Behavior

`s ideOffset` controls the **vertical distance** between the trigger element and the dropdown menu, not the left margin.

| Property | Controls | Notes |
|----------|----------|-------|
| `side` | Position relative to trigger (top/bottom/left/right) | `side="top"` places menu above trigger |
| `sideOffset` | **Vertical** gap between trigger and menu | Increases = menu moves **down** when side=top |
| `align` | Horizontal alignment (start/center/end) | Controls left/right alignment |

Example:
- `side="top"` + `sideOffset={10}` = menu appears above trigger, 10px gap
- `sideOffset={6}` = smaller gap, menu closer to trigger
