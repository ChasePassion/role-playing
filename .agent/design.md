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

---

## Input Component: `focus` vs `focus-visible`

When customizing Input component focus styles, using `focus:` doesn't work because shadcn's Input uses `focus-visible:` instead.

```tsx
// src/components/ui/input.tsx default styles:
"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
```

**`focus` vs `focus-visible`:**
- `focus` — always triggers when element is focused
- `focus-visible` — only triggers when focused via keyboard (not mouse click)

**Incorrect (won't override default):**
```html
className="... focus:outline-none"
```

**Correct approach:**
```html
className="... focus-visible:outline-none focus-visible:ring-0 focus-visible:!border-gray-200"
```

The `!` is Tailwind's important flag to ensure the style has highest priority.

---

## Input Component: `::selection` with `bg-transparent`

When Input component has `bg-transparent` + Tailwind `selection:` utility, selection color may not show properly in Chrome 131+.

**Root cause:** Tailwind's `selection:` generates CSS variables that conflict with `bg-transparent` in modern Chrome.

**Incorrect (selection not showing):**
```html
className="... bg-transparent selection:bg-primary"
```

**Correct approach (use arbitrary variant):**
```html
className="... bg-transparent [&::selection]:bg-blue-500 [&::selection]:text-white"
```

**Why this works:**
- `[&::selection]` directly targets the `::selection` pseudo-element
- Bypasses Tailwind's CSS variable system
- Works consistently across browsers

---

## CSS `grid-template-rows: 0fr` Shows Thin Line Instead of Hiding

**Phenomenon:**
When setting `grid-template-rows: 0fr`, content is not fully hidden and only shows a thin line.

**Relevant Code:**
```tsx
style={{
    display: "grid",
    gridTemplateRows: "0fr",  // Bug: content visible, only shows thin line
    transition: "grid-template-rows 400ms ease",
}}
```

**Bug Explanation:**
Browsers resolve `0fr` to `0px`, which means the `grid-template-rows` track has no actual height for animation transition. When set to `0fr`, the grid track collapses to its minimum size (usually one line height) rather than fully collapsing to 0, so content remains visible.

**Solution (Actual Implementation):**
Use `max-height` instead of `grid-template-rows`:

```tsx
style={{
    maxHeight: isHovered ? "200px" : "42px",
    overflow: "hidden",
    transition: "max-height 400ms ease",
}}
```

---

## CSS `group-hover` Makes Card Disappear on Hover

**Phenomenon:**
When hovering over any card, that card completely disappears instead of only collapsing other cards.

**Relevant Code:**
```tsx
className={`
    group/card relative cursor-pointer
    flex-[1_1_0%] hover:flex-[1_0_100%]
    group-hover/list:flex-[0_0_0%]  /* Bug: causes current card to also collapse */
    group-hover/list:opacity-0        /* Bug: causes current card to also become transparent */
`}
```

**Bug Explanation:**
`group-hover/list` is a CSS group selector. When **any element within the group** is hovered, the rules apply to **all group members**. This means when hovering over the current card, its `flex` and `opacity` are also set to `0`, causing it to be completely invisible.

**Solution (Actual Implementation):**
Use React state to directly control styles instead of relying on CSS group-hover:

```tsx
function SuggestionCard({ ... }) {
    const [visible, setVisible] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                flex: isHovered ? "1 0 100%" : visible ? "1 1 0%" : "0 0 0%",
                opacity: visible ? 1 : 0,
                transition: "flex 500ms ease-out, max-height 400ms ease",
            }}
        >
            {/* content */}
        </div>
    );
}
```

**Key Points:**
- Remove `group-hover/list:flex-[0_0_0%]` and `group-hover/list:opacity-0`
- Use `isHovered` state to control current card's expand/collapse
- Use `visible` state to control entry animation opacity
