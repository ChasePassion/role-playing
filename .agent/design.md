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
