# Design Knowledge

This is an AI role-playing English learning website aimed at consumers. Users can create characters on the platform and talk with them, learning music during the conversations.

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

## Text Selection Overlay: Avoid React State for Selection Buttons

When showing a floating action button after the user selects text, do not use React state just to reveal or position that button.

**Problem:**
- `mouseup` reads `window.getSelection()`
- calling `setState(...)` to show the button triggers a React re-render
- if the selected text lives inside React-managed content such as `react-markdown`, the underlying text nodes may be replaced during commit
- the browser selection is tied to those DOM nodes, so the highlight disappears even though the selected string was already captured

**Incorrect pattern:**
```tsx
const [selectionButton, setSelectionButton] = useState(null);

function handleTextSelection() {
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!range) return;

  setSelectionButton({
    top: range.getBoundingClientRect().bottom,
    left: range.getBoundingClientRect().left,
  });
}
```

**Recommended pattern:**
- keep the floating button mounted all the time in a portal
- store selection metadata in `useRef`, not `useState`
- update button position and visibility through the DOM node ref
- only enter the normal React state flow when the user actually clicks the button
- keep `onMouseDown(e => e.preventDefault())` on the button so clicking it does not clear the current selection

**Correct approach:**
```tsx
const buttonRef = useRef<HTMLButtonElement | null>(null);
const selectionDataRef = useRef<SelectionButtonData | null>(null);

function showSelectionButton(data: SelectionButtonData) {
  selectionDataRef.current = data;
  const button = buttonRef.current;
  if (!button) return;

  button.style.top = `${data.top}px`;
  button.style.left = `${data.left}px`;
  button.style.visibility = "visible";
  button.style.opacity = "1";
  button.style.pointerEvents = "auto";
}
```

**Rule of thumb:**
- if an interaction depends on preserving the browser's native selection, avoid re-rendering the selected content subtree
- for transient selection affordances, prefer `ref` + persistent overlay DOM over `state` + conditional rendering

---

## Async State Timing: Loading vs Active State

When implementing UI feedback for async operations (e.g., audio playback), distinguish between **loading state** and **active state**.

**Problem:**
- Click speaker button → UI immediately shows "playing" animation
- But audio actually starts later (network fetch + decode)
- User sees animation but no sound = confusing feedback

**Root cause:**
- The async operation has multiple phases (fetch → decode → play)
- UI state was set at the wrong phase (before audio actually started)

**Solution: Two-phase state management**

| State | When | Purpose |
|-------|------|---------|
| `loadingCandidateId` | Set immediately on click | Shows loading spinner |
| `playingCandidateId` | Set when `source.start()` is called | Shows active animation |

**Incorrect pattern:**
```tsx
async function playMessage(candidateId: string) {
  setPlayingId(candidateId);  // Set too early!
  const audioBuffer = await fetchAndDecode();
  source.start(0);  // Audio actually starts here, but UI already showing "playing"
}
```

**Correct pattern:**
```tsx
async function playMessage(candidateId: string) {
  // Don't set playing state here
  const audioBuffer = await fetchAndDecode();
  source.start(0);  // Audio actually starts
  setPlayingId(candidateId);  // Now UI matches reality
  onAudioReady?.(candidateId);
}
```

---

## Prop Chain Completeness Check

When adding a new prop that flows through multiple component layers (page → ChatThread → ChatMessage), always verify the prop is passed at **every level**.

**Problem:**
- Added `ttsLoadingCandidateId` state to page.tsx
- Passed it to ChatThread ✓
- Forgot to pass it from ChatThread to ChatMessage ✗
- Bug: loading spinner never showed up

**Lesson:**
- When creating a new prop, document which components need to receive it
- After implementation, verify the entire prop chain: grep for the prop name across all intermediate components
- Use TypeScript interface updates to catch missing props at compile time

**Verification checklist:**
```bash
# Search for prop usage across the chain
grep -n "ttsLoadingCandidateId" src/app/\(app\)/chat/\[id\]/page.tsx
grep -n "ttsLoadingCandidateId" src/components/chat/ChatThread.tsx
grep -n "ttsLoadingCandidateId" src/components/ChatMessage.tsx
```

---

## Speaker Button Wave Animation

Implement a speaker icon with animated sound waves, using inline SVG + CSS animations.

### SVG Structure

The speaker icon is an inline SVG with two parts: the speaker body and the wave arcs.

```tsx
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 20 20"
  fill="none"
  aria-hidden="true"
  className={`h-5 w-5 shrink-0${isSpeakerPlaying ? " speaker-playing" : ""}`}
>
  {/* Speaker body - filled path */}
  <path
    className="speaker-body"
    d="M9.751 4.092a.585.585 0 0 0-.907-.49l-.072.058-2.218 2.033a3.06 3.06 0 0 1-1.785.792l-.286.013c-.958 0-1.735.778-1.735 1.736v3.533c0 .958.777 1.734 1.735 1.734.766 0 1.506.288 2.071.806l2.218 2.033.072.057a.585.585 0 0 0 .907-.489zM11.081 15.908c0 1.615-1.859 2.483-3.091 1.512l-.118-.1-2.216-2.033a1.74 1.74 0 0 0-1.173-.456 3.065 3.065 0 0 1-3.065-3.064V8.234a3.065 3.065 0 0 1 3.065-3.066l.162-.008c.375-.035.73-.191 1.01-.448L7.873 2.68l.117-.1c1.233-.971 3.092-.102 3.092 1.512z"
    fill="currentColor"
  />

  {/* Wave arcs - stroke only, no fill */}
  <path className="speaker-wave wave1" d="M12.5 7.5Q14.5 10 12.5 12.5" />
  <path className="speaker-wave wave2" d="M14.0 6.0Q17.0 10 14.0 14.0" />
  <path className="speaker-wave wave3" d="M15.5 4.5Q19.5 10 15.5 15.5" />
</svg>
```

### Wave Path Design (Quadratic Bezier)

The waves use quadratic bezier curves (`Q` command) for smooth arcs:

```
d="M12.5 7.5Q14.5 10 12.5 12.5"
  ↑       ↑    ↑    ↑
 起点    控制点  终点
```

- **M**: Move to start point
- **Q**: Quadratic bezier to end point with control point
- Control point determines the curvature direction and amount

The three waves have increasing arc sizes:
- `wave1`: Smallest arc (closer to speaker body)
- `wave2`: Medium arc
- `wave3`: Largest arc (farthest from speaker)

### CSS Animation

```css
/* Base wave styles */
.speaker-wave {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 1;
  transform-origin: 10px 10px;
}

/* All waves visible when not playing */
.speaker-wave.wave1,
.speaker-wave.wave2,
.speaker-wave.wave3 {
  opacity: 1;
}

/* Playing state: staggered animations */
.speaker-playing .speaker-wave.wave1 {
  animation: speakerWaveShow 1s infinite;
  animation-delay: 0s;
}

.speaker-playing .speaker-wave.wave2 {
  animation: speakerWaveShow 1s infinite;
  animation-delay: 0.16s;
}

.speaker-playing .speaker-wave.wave3 {
  animation: speakerWaveShow 1s infinite;
  animation-delay: 0.32s;
}

@keyframes speakerWaveShow {
  0% {
    opacity: 0;
    transform: scale(0.92);
  }
  25% {
    opacity: 1;
    transform: scale(1);
  }
  65% {
    opacity: 1;
    transform: scale(1.03);
  }
  100% {
    opacity: 0;
    transform: scale(0.96);
  }
}
```

### Key Design Decisions

1. **Inline SVG over mask/image**
   - Inline SVG allows CSS control over individual paths
   - Can animate stroke, opacity, transform independently
   - Using `currentColor` makes it respect text color

2. **Transform-origin at speaker center**
   - `transform-origin: 10px 10px` (center of 20x20 viewBox)
   - Ensures waves scale from the speaker body outward

3. **Staggered animation delays**
   - Each wave starts 160ms after the previous
   - Creates the "wave appearing one by one" effect

4. **Animation loop structure**
   - `0%`: Fade in + scale up (invisible → visible, small → normal)
   - `25-65%`: Stay visible at full scale
   - `100%`: Fade out + scale down (preparing for next cycle)
   - `infinite` loop keeps the animation going

5. **Idle state: all waves visible**
   - When not playing, all three waves are static and visible
   - User can see the speaker icon clearly

6. **Three visual states**
   - Loading: Spinning circle (before audio ready)
   - Playing: Animated waves (audio playing)
   - Idle: Static waves (not playing)

---

好的，下面是英文版，可直接追加到 `design.md` 末尾：

````markdown
## Fixing the "Jumpy" Hover Expansion: CSS Grid Instead of `max-height`

### Problem

When a card expands on hover, using a `max-height` transition often causes a jumpy / unsmooth effect.

**Root cause:** `max-height` requires a value much larger than the actual content height (for example, 150px), but the real content may only be 80px tall. The browser calculates the animation speed based on 40→150px (110px), while the actual content reaches its final height at 40→80px (the first 36% of the duration). The remaining 64% of the animation is effectively "running in empty space" — visually, it looks like the content pops open instantly and then just sits there. The reverse collapse has the same issue: nothing appears to happen for the first 64%, then it suddenly shrinks at the end.

### Solution: CSS Grid `0fr → 1fr`

Use a `grid-template-rows` transition from `0fr` to `1fr` instead of `max-height`. The browser will calculate the real content height precisely and animate smoothly to exactly that height.

```html
<!-- Expandable content container -->
<div class="grid grid-rows-[0fr] group-hover/card:grid-rows-[1fr]
    transition-[grid-template-rows] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]">
    <!-- Must have overflow-hidden + min-h-0, otherwise 0fr cannot truly collapse to 0 -->
    <div class="overflow-hidden min-h-0">
        <div class="p-3">Actual content</div>
    </div>
</div>
````

**Key points:**

* The grid child must have `overflow: hidden` + `min-height: 0`, otherwise `0fr` cannot fully collapse the row to 0
* `transition-property` only needs `grid-template-rows`; do not use `transition-all` (to avoid interfering with other properties)
* The parent container does not need a fixed height; the height change of the grid child will naturally drive the parent to resize with it

**Comparison:**

| Approach       | Precision                                                                  | Animation Smoothness      | Browser Support   |
| -------------- | -------------------------------------------------------------------------- | ------------------------- | ----------------- |
| `max-height`   | Requires guessing a value; the larger the mismatch, the less even it feels | ❌ Severe dead-zone effect | ✅ Fully supported |
| Grid `0fr→1fr` | Browser calculates precisely                                               | ✅ Even throughout         | ✅ Modern browsers |

---

## Card Depth: Multi-layer Shadows + Directional Border

Create an embossed / dimensional card look using 4 layers of box-shadow plus differentiated border colors, without any images or extra DOM.

```css
.suggestion-card {
  background: #ffffff;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.06),      /* Outer shadow 1: close projection */
    0 2px 6px rgba(0, 0, 0, 0.03),      /* Outer shadow 2: ambient light */
    inset 0 1px 0 rgba(255,255,255,0.9), /* Inner top highlight */
    inset 0 -1px 0 rgba(0,0,0,0.04);    /* Inner bottom depth */
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-top-color: rgba(255, 255, 255, 0.7); /* Brighter top edge = light direction */
}
```

**Hover enhancement:** deepen the shadow + apply `translateY(-1px)` to simulate the card lifting slightly off the surface.

---

## Expansion Animation Rhythm: Staggered Layers with Delay

Expansion animation should feel layered. Do not start every property at the same time:

1. **Width change first** (`duration-700`) — the card takes up space
2. **Height expansion follows** (`duration-700`) — the Grid content expands in sync with width
3. **Text fade-in comes later** (`duration-400, delay-150`) — the content appears only after the container is ready

This layering avoids the stiff feeling of "everything popping out at once."

---

## Easing Curve Choice

| Curve                         | Effect                                                   | Best Use Case                              |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| `ease-out`                    | Linear deceleration, somewhat mechanical                 | Simple transitions                         |
| `cubic-bezier(0.32,0.72,0,1)` | Fast start → natural deceleration, slightly elastic feel | Expand / collapse animations (recommended) |
| `ease-in-out`                 | Slow → fast → slow                                       | Looping animations                         |

```

---

## Flex Squeeze Artifact: Ghost Border Stripe on Collapsed Siblings

### Problem

When one flex child expands via `hover:flex-[1_0_100%]`, the sibling cards get squeezed narrow. However, they never fully disappear — CSS flex layout preserves `min-width: auto` (the minimum content width), plus any `border`, `padding`, and `background` still render. The result is a thin **white stripe** at the edge where the sibling cards are crushed but still visible (a few pixels of border + white background + box-shadow).

### Solution

Add explicit "disappear" styles to siblings using Tailwind's `group-hover` on the parent list:

```html
group-hover/list:flex-[0_0_0%]    <!-- force flex-basis to 0 -->
group-hover/list:opacity-0        <!-- make completely transparent -->
group-hover/list:border-transparent  <!-- hide border color -->
```

The hovered card itself overrides these with `!important`:

```html
hover:flex-[1_0_100%]!   <!-- take full width -->
hover:opacity-100!       <!-- stay fully visible -->
```

**Why this works:** `flex-[0_0_0%]` sets `flex-grow: 0, flex-shrink: 0, flex-basis: 0%`, which tells the browser "this item should occupy zero space." Combined with `opacity-0`, even if a few sub-pixel remnants exist, they are invisible.

### Bonus: Separate Duration for Disappear vs Expand

The disappear animation should be **slower** than the expand animation to feel natural (the focus card opens quickly, while background cards fade out gently):

```html
transition-all duration-700 ease-[...]   <!-- base speed -->
group-hover/list:duration-1200           <!-- siblings disappear slowly -->
hover:duration-700!                      <!-- hovered card expands at normal speed -->
```

This works because:
1. When any card in the list is hovered, ALL cards receive `group-hover/list` styles, including the slower `duration-1200`
2. The actually-hovered card additionally matches `hover:`, and `hover:duration-700!` with `!important` overrides the group duration
3. Net result: hovered card = 700ms (expand), sibling cards = 1200ms (disappear)

---

## Elegant Sidebar Collapse Animation: Single DOM + Width Clipping

### Problem

When animating a sidebar collapsing from a full view (e.g., 256px with text) to a rail view (e.g., 56px icons only), using conditional rendering (`if (isCollapsed) return <Rail/> else return <Full/>`) or crossfading two separate DOM trees causes ugly visual artifacts:
1. **Timing Mismatch:** The parent container smoothly animates its width over 300ms, but React instantly swaps the DOM nodes. This creates a huge temporary blank space inside the shrinking wrapper.
2. **Crossfade Ghosting:** Even if two separate DOM trees position an identical icon in the exact same coordinates, fading one out (`opacity 1→0`) while fading the other in (`opacity 0→1`) simultaneously creates a noticeable "dip" in opacity (flicker) due to alpha blending math.

### Solution: Single Unified DOM

Instead of switching between two layouts, use a single fluid layout and leverage the parent container's width transition to physically clip the content.

```tsx
<!-- 1. Parent container controls the width transition -->
<aside className={`transition-all duration-300 overflow-hidden ${isCollapsed ? 'w-14' : 'w-64'}`}>
  
  <!-- 2. Single unified inner layout -->
  <div className="w-full flex flex-col whitespace-nowrap overflow-x-hidden">
    
    <button className="w-full flex items-center overflow-hidden">
      <!-- 3. The Anchor: Fixed size square with shrink-0 -->
      <div className="w-10 h-10 shrink-0 flex items-center justify-center">
        <Icon />
      </div>
      
      <!-- 4. The Tail: Text that fades out and gets clipped -->
      <div className={`min-w-[150px] transition-opacity duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
        <span>Text Content</span>
      </div>
    </button>

  </div>
</aside>
```

### Key Techniques

1. **Rigid Anchors (`shrink-0`):** The left-side icons are wrapped in fixed-width containers (e.g., `w-10 shrink-0`). When the parent shrink to 56px, these icon wrappers refuse to compress, staying perfectly anchored to the left.
2. **Physical Clipping (`overflow-hidden` + `whitespace-nowrap`):** As the container narrows, the text on the right cannot wrap to a new line. It simply overflows its parent and is forcefully clipped by the moving right edge, acting exactly like a closing sliding door.
3. **Fade-out Masking (`opacity-0`):** To prevent the text from looking harshly "chopped" in half during the collapse, a faster `transition-opacity` (`duration-200` vs the wrapper's `duration-300`) smoothly fades it out. The text becomes invisible naturally just as the clipping door slides over it.

This approach perfectly replicates the silky, jump-free sidebar animations seen in modern advanced UIs like ChatGPT and Notion, with zero React render thrashing.

---

## Context-Aware Component Scaling (Sidebar Geometry Transition)

### Problem

When building a collapsible sidebar (e.g., shrinking from a 256px expanded layout to a 56px collapsed rail), forcing the child elements to use the smallest common denominator size (e.g., using 40x40px rows and 32x32px avatars everywhere so they fit the collapsed rail) makes the expanded state look cramped, unbalanced, and visually unimpressive. 

### Solution: Synchronous Dimension Transitions

Do not compromise the expanded design. Instead, apply CSS transitions to the specific dimensions of the child components (`height`, `width`, `font-size`, `margin`, `border-radius`), triggered by the exact same boolean state (`isCollapsed`) and using the exact same `duration` and `easing` as the parent wrapper.

```tsx
<button className={`flex items-center w-full transition-all duration-300 ease-in-out
    ${isCollapsed ? 'h-10 rounded-lg' : 'h-[52px] rounded-xl'}`}>
    
    <div className="w-10 flex items-center justify-center shrink-0">
        <!-- Avatar scales smoothly in sync with the wrapper -->
        <Avatar className={`shrink-0 transition-all duration-300 ease-in-out
            ${isCollapsed ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl'}`}>
            <AvatarImage src="..." />
        </Avatar>
    </div>
    
    <!-- Text fades out and adjusts its relative layout -->
    <div className={`flex flex-col min-w-[150px] transition-all duration-300 ease-in-out
        ${isCollapsed ? 'opacity-0 ml-2' : 'opacity-100 ml-3'}`}>
        <span className={`transition-all duration-300 ease-in-out
            ${isCollapsed ? 'text-[13.5px]' : 'text-sm'}`}>
            Character Name
        </span>
    </div>
</button>
```

### Key Benefits & Techniques

1. **Perfect Proportions in Both States:** The expanded view remains generous and readable (52px row height, 40px avatars, larger text margins), while the collapsed view instantly and cleanly converts into a neat, squarified UI (40px row height, 32px avatars).
2. **"Breathing" Organism Effect:** As the sidebar drawer slides closed, the internal elements simultaneously shrink. Because the easing (`ease-in-out`) and duration (`300ms`) match the parent container's width animation perfectly, the elements appear to be reacting organically to spatial pressure rather than arbitrarily swapping sizes.
3. **Shape Consistency via Border Radius:** When scaling dimensions down dramatically (e.g., `48x40` rectangle down to `40x40` square), remember to also step down the `border-radius` (e.g., `rounded-xl` down to `rounded-lg`). Failing to do so can cause elements to look like pills rather than rounded boxes. Maintaining mathematical concentricity (Outer Radius = Inner Radius + Padding) across states prevents visual distortion.
