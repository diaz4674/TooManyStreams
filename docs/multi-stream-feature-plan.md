# Multi-Stream Viewer Feature Plan

## Goal

Build a browser-based multi-stream viewer for Twitch and Kick that:

- shows many stream cards in a responsive full-width grid
- only mounts stream iframes when cards are near the viewport
- lets users select one or more "focus" streams
- visually emphasizes selected streams and dims the rest
- supports drag-and-drop reordering
- optionally enables audio from every stream

## Assumptions

- Frontend stack is React + Tailwind CSS or a similar component-based UI.
- Each stream is rendered in its own iframe.
- Twitch and Kick embeds are used directly.
- Initial scope is desktop-first, but the layout should still degrade cleanly on mobile.

## Important Platform Constraints

- Twitch embeds require a `parent` query parameter that matches the site domain.
- Twitch autoplay behavior depends on visibility and browser autoplay rules.
- Kick supports iframe embeds at `https://player.kick.com/{username}` and allows `autoplay` and `muted` query params.
- Browsers may block unmuted autoplay until the user interacts with the page.

Because of that, the app should assume:

- stream cards can render muted on first load
- audio state may only fully apply after a user click
- off-screen streams should not mount iframes at all

## Recommended UX Rules

### 1. Lazy loading

- Use one `IntersectionObserver` for all cards.
- Observer config:
  - `root: null`
  - `rootMargin: "100px 0px"`
  - `threshold: 0.01`
- When a card becomes visible, mount its iframe.
- When a card exits the viewport, keep the iframe mounted for a short grace period if audio is active, otherwise unmount it.
- Off-screen cards show a placeholder:
  - centered spinner or pulse block
  - text: `Loading stream...`

Recommendation:

- Do not immediately unmount selected or audible streams just because they scroll slightly out of view.
- Add a small rule:
  - if selected or currently audible, keep mounted until far off-screen or until deselected

That prevents audio popping and reload churn.

### 2. Grid layout

Let the user choose a global responsive maximum of `2`, `3`, or `4` cards
per row. Default to `4` so existing walls keep their current density. When
the viewport or chat sidebar reduces available width, fall back to fewer
columns rather than shrinking cards below the minimum usable width.

Implementation helper:

```ts
function getGridColumns(
	count: number,
	maxColumns: 2 | 3 | 4,
	containerWidth: number,
	gap = 16,
) {
	let columns = Math.min(count, maxColumns)
	while (columns > 1 && (containerWidth - gap * (columns - 1)) / columns < 260) {
		columns -= 1
	}
	return columns
}
```

Layout example:

```ts
const columns = getGridColumns(streams.length, savedPreference ?? 4, width)
```

All cards should:

- keep `aspect-video`
- fill available width
- use `gap-4`
- animate size/opacity changes with `duration-300`

### 3. Selection and focus

Rules:

- Clicking a card toggles selection.
- At least one stream must remain selected.
- Selected cards:
  - `scale-105`
  - full opacity
  - cyan neon border and glow
  - animated emphasis
- Unselected cards:
  - `scale-95`
  - `opacity-50`

State model:

- `selectedIds: string[]`
- initialize with the first added stream selected
- when deselecting the final selected stream, ignore the action or auto-select another stream

Recommendation:

- Treat selection as visual focus and audio permission together.
- Keep the behavior simple:
  - selected = emphasized
  - selected = allowed to play audio

### 4. Audio model

There is one product ambiguity to resolve:

- Your notes say `Audio plays from ALL selected streams simultaneously`.
- Then `chaos mode` says it turns on audio from all streams.

Those two rules overlap.

Recommended behavior:

- Normal mode:
  - only selected streams are unmuted
  - unselected streams stay muted
- `All Audio` mode:
  - every loaded stream is unmuted, regardless of selection
  - selection still controls sizing/glow only

Suggested names better than `Chaos Mode`:

- `All Audio`
- `Audio Storm`
- `Wall of Sound`

Best product label:

- `All Audio`

Best playful internal/marketing name:

- `Wall of Sound`

### 5. Drag and drop reordering

Recommended library:

- `@dnd-kit/core`
- `@dnd-kit/sortable`

Why:

- smoother card sorting than raw HTML5 drag and drop
- easier transform previews
- better control over drag overlays and collision handling

UX behavior:

- drag handle in the top-left corner only
- while dragging:
  - dragged card floats above the grid
  - target slot shows cyan highlight ring
  - neighboring cards shift smoothly into new positions
- on drop:
  - persist new stream order in state
  - optionally persist to local storage

## Visual Design

- background: dark gradient from `gray-900` to `purple-900`
- selected glow: cyan border plus animated shadow pulse
- title overlay: bottom gradient fade with stream title and platform label
- transitions: `duration-300`
- cards: rounded corners, subtle glass/dark chrome styling

Suggested Tailwind tokens:

```css
--bg-start: #111827;
--bg-end: #4c1d95;
--neon-cyan: #22d3ee;
--card-bg: rgba(17, 24, 39, 0.65);
```

Suggested selected card classes:

```txt
scale-105 opacity-100 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]
```

Suggested unselected card classes:

```txt
scale-95 opacity-50
```

## Suggested Component Breakdown

### `MultiStreamPage`

Owns:

- stream list
- selected IDs
- audio mode
- drag order

Renders:

- header / toolbar
- grid

### `StreamToolbar`

Controls:

- add stream
- toggle `All Audio`
- active audio count

### `StreamGrid`

Responsibilities:

- chooses column count from stream total
- hosts sortable context
- renders cards in current order

### `StreamCard`

Responsibilities:

- selection toggle
- drag handle
- title overlay
- selected/unselected styling
- remove button

### `LazyStreamEmbed`

Responsibilities:

## Theater Mode Extension

### Product decisions

- Theater mode starts from the current focused selection.
- If theater mode starts with one selected stream, render one featured full-width stage.
- If theater mode starts with exactly two selected streams, render a split dual-main stage.
- Remaining streams move into a bottom rail with previous/next arrow navigation.
- Promoting a rail card keeps theater mode active and swaps it into the stage.
- Theater mode is not persisted across refresh.

### Implementation notes

- Own theater state in `App.jsx` so the header and layout can respond together.
- Keep focus/audio selection separate from theater promotion so audio behavior stays predictable.
- Keep featured streams mounted even when they are outside the viewport.
- Disable drag-and-drop while theater mode is active in the first version.

### Manual verification

- Enter theater mode with one selected stream and confirm a single featured stage.
- Enter theater mode with two selected streams and confirm a split stage.
- Promote a rail card and confirm it becomes the active stage stream.
- Refresh while theater mode is active and confirm the app returns to the grid.

- intersection observer hookup
- placeholder rendering
- iframe mount/unmount logic
- provider-specific embed URL generation

## Suggested Data Model

```ts
type Platform = "twitch" | "kick"

type StreamItem = {
	id: string
	platform: Platform
	channelName: string
	title: string
	order: number
}

type ViewerState = {
	streams: StreamItem[]
	selectedIds: string[]
	allAudioEnabled: boolean
}
```

Derived helpers:

```ts
const isSelected = selectedIds.includes(stream.id)
const shouldPlayAudio = allAudioEnabled || isSelected
const shouldRenderGlow = isSelected
```

## Embed URL Strategy

### Twitch

Use iframe URL format:

```txt
https://player.twitch.tv/?channel={channel}&parent={domain}&muted={true|false}&autoplay={true|false}
```

Notes:

- `parent` must match the deployed domain.
- In local development, support `localhost`.

### Kick

Use iframe URL format:

```txt
https://player.kick.com/{channel}?muted={true|false}&autoplay={true|false}
```

Build a provider helper:

```ts
function getEmbedSrc(
	stream: StreamItem,
	opts: { muted: boolean; autoplay: boolean; parent?: string },
) {
	if (stream.platform === "twitch") {
		return `https://player.twitch.tv/?channel=${stream.channelName}&parent=${opts.parent}&muted=${opts.muted}&autoplay=${opts.autoplay}`
	}

	return `https://player.kick.com/${stream.channelName}?muted=${opts.muted}&autoplay=${opts.autoplay}`
}
```

## State and Interaction Flow

### Add stream

1. User adds Twitch or Kick channel.
2. Stream is appended to `streams`.
3. If this is the first stream, auto-select it.
4. Card starts as placeholder until visible.

### Select stream

1. User clicks card.
2. If currently unselected, add to `selectedIds`.
3. If currently selected and more than one stream is selected, remove it.
4. If it is the only selected stream, ignore the deselect.

### Toggle all-audio mode

1. User toggles `All Audio`.
2. If on, all loaded streams should become unmuted.
3. If off, only selected streams remain unmuted.
4. If the browser blocks autoplay audio, show a small inline hint:
   - `Click a stream to enable sound`

### Reorder

1. User drags a card using the handle.
2. Grid shows insertion target.
3. Other cards animate into shifted positions.
4. Drop updates `streams` order.

## Performance Notes

- Avoid rendering iframes for off-screen cards.
- Memoize derived grid classes if needed, but do not over-optimize early.
- Keep observer state separate from selection state.
- Consider a `mountedOnce` flag so previously seen streams can re-mount faster with a lighter placeholder.
- If many streams are active, expect CPU and network pressure even with lazy loading.

## Edge Cases

- User deselects the last selected stream:
  - block the action
- User enables `All Audio` with many streams:
  - browser may still block some unmuted playback
- Dragging a selected card:
  - selection should not change
- Stream removed while selected:
  - remove its ID from `selectedIds`
  - if selection becomes empty, auto-select the first remaining stream
- Off-screen selected stream:
  - decide whether audio should continue if scrolled away

Recommended rule:

- keep selected audible streams mounted while they remain selected

## Implementation Order

### Phase 1

- static page shell
- gradient background
- responsive grid
- mock cards with selected/unselected styling

### Phase 2

- stream state model
- add/remove streams
- enforced single-or-more selection rules
- `All Audio` toggle state

### Phase 3

- lazy iframe mounting with `IntersectionObserver`
- placeholders for off-screen cards
- provider-specific Twitch/Kick embed URLs

### Phase 4

- drag-and-drop reordering with `dnd-kit`
- target highlight and animated shifting

### Phase 5

- polish:
  - glow animation
  - audio hint states
  - local persistence
  - mobile cleanup

## Acceptance Criteria

- Only cards within viewport plus 100px mount iframes.
- Off-screen cards show a loading placeholder instead of an iframe.
- Grid columns change exactly by stream count rules.
- Cards maintain 16:9 ratio at all times.
- At least one stream is always selected.
- Selected cards are visually larger and brighter.
- Unselected cards are smaller and dimmed.
- Reordering visibly shifts neighboring cards before drop.
- `All Audio` mode unmutes every loaded stream.
- Twitch embeds include the correct `parent` domain.

## My Recommendation

The cleanest v1 is:

- React state for stream order, selection, and audio mode
- `dnd-kit` for sorting
- `IntersectionObserver` for iframe mount control
- selection drives both focus styling and default audio
- `All Audio` as the user-facing replacement for `Chaos Mode`

That gives you a polished first version without overcomplicating the rules.

## Sources

- Twitch embed docs: https://dev.twitch.tv/docs/embed/video-and-clips/
- Twitch embed overview: https://dev.twitch.tv/docs/embed/
- Kick embed help: https://help.kick.com/en/articles/8010826-how-to-embed-your-kick-livestream
