import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import StreamGrid from "../StreamGrid"
import MobileCinemaView from "./MobileCinemaView"
import MobileMainPlayerFrame, {
	MOBILE_FRAME_BAR_PX,
	PIP_MARGIN_PX,
	PIP_MIN_WIDTH_PX,
	clampPipRect,
	getPipFrameHeight,
} from "./MobileMainPlayerFrame"
import { MAX_FOCUSED_STREAMS, useWallStore } from "../../wallStore"
import { isStreamChatCapable } from "../../utils"
import { loadPipPrefs, savePipPrefs } from "../../mobilePipStorage"

/**
 * Mobile (viewport < 768px) presentation of the wall. Three states:
 *
 * 1. No focused stream — the plain feed (one-column StreamGrid).
 * 2. Focused, docked — a YouTube-style cinema view: pinned main player up
 *    top, Chat / Streams / Multiview tabs below. The feed is unmounted to
 *    save mobile bandwidth.
 * 3. Focused, mini player (PiP) — the main player floats over the feed;
 *    feed cards are force-muted behind it.
 *
 * Focus state itself lives in the wall store (same as desktop cinema mode),
 * so companion arrangements persist per main stream via
 * multiwatch.wall.focus. pip/tab state is presentation-only and stays local.
 */
export default function MobileHomeView({
	streams,
	maxColumns,
	expandedCardChatStreamId,
	previewStream,
	previewStreamAlreadyAdded,
	onAddPreviewStream,
	onClosePreview,
	focusedStreamIds,
	focusChatStreamId,
	onVolumeChange,
	onRemove,
	onEdit,
	onOpenViews,
	onSelectView,
	onReorder,
	onToggleChat,
	onEnterFocus,
	onAddFocusCompanion,
	onRemoveFocusCompanion,
	onPromoteFocusStream,
	onSetFocusChatStream,
	onClearFocus,
}) {
	const streamVolumes = useWallStore(useShallow((state) => state.streamVolumes))
	const [viewport, setViewport] = useState(() => ({
		width: typeof window === "undefined" ? 390 : window.innerWidth,
		height: typeof window === "undefined" ? 844 : window.innerHeight,
	}))
	const [pipMode, setPipMode] = useState(false)
	const [pipRect, setPipRect] = useState(null)
	const [activeTab, setActiveTab] = useState("chat")
	const [mainPlaybackToken, setMainPlaybackToken] = useState(0)
	const [companionPlaybackToken, setCompanionPlaybackToken] = useState(0)
	const frameElRef = useRef(null)

	const primaryStreamId = focusedStreamIds[0] ?? null
	const streamsById = useMemo(
		() => new Map(streams.map((stream) => [stream.id, stream])),
		[streams],
	)
	const primaryStream = primaryStreamId
		? (streamsById.get(primaryStreamId) ?? null)
		: null
	const hasFocus = Boolean(primaryStream)
	const showCinema = hasFocus && !pipMode
	const focusedStreamIdSet = useMemo(
		() => new Set(focusedStreamIds),
		[focusedStreamIds],
	)
	const companionStreams = useMemo(
		() =>
			focusedStreamIds
				.slice(1)
				.map((id) => streamsById.get(id))
				.filter(Boolean),
		[focusedStreamIds, streamsById],
	)
	const otherStreams = useMemo(
		() => streams.filter((stream) => !focusedStreamIdSet.has(stream.id)),
		[focusedStreamIdSet, streams],
	)
	const chatStreams = useMemo(
		() =>
			focusedStreamIds
				.map((id) => streamsById.get(id))
				.filter((stream) => stream && isStreamChatCapable(stream)),
		[focusedStreamIds, streamsById],
	)
	// While the mini player floats, the feed behind it drops the focused
	// streams (no double-mounting the same channel) and plays muted.
	const feedStreams = pipMode && hasFocus ? otherStreams : streams

	useEffect(() => {
		const updateViewport = () => {
			setViewport({ width: window.innerWidth, height: window.innerHeight })
		}
		window.addEventListener("resize", updateViewport)
		return () => {
			window.removeEventListener("resize", updateViewport)
		}
	}, [])

	// Keep the mini player on screen when the viewport changes (rotation,
	// browser chrome collapsing).
	useEffect(() => {
		setPipRect((current) => {
			if (!current) {
				return current
			}
			const clamped = clampPipRect(current, {
				width: window.innerWidth,
				height: window.innerHeight,
			})
			return clamped.left === current.left &&
				clamped.top === current.top &&
				clamped.width === current.width
				? current
				: clamped
		})
	}, [viewport.width, viewport.height])

	// A new main stream always opens the full cinema view (matches YouTube:
	// picking a new video from the feed expands the mini player).
	useEffect(() => {
		if (!primaryStreamId) {
			return
		}
		setPipMode(false)
		setMainPlaybackToken((token) => token + 1)
	}, [primaryStreamId])

	// Leaving cinema mode entirely resets presentation state.
	useEffect(() => {
		if (!primaryStreamId) {
			setPipMode(false)
			setPipRect(null)
		}
	}, [primaryStreamId])

	// Pick the landing tab once per cinema entry: chat when the main stream
	// has one, otherwise the stream switcher. Swaps keep the current tab.
	const hadFocusRef = useRef(hasFocus)
	useEffect(() => {
		if (hasFocus && !hadFocusRef.current) {
			setActiveTab(
				primaryStream && isStreamChatCapable(primaryStream)
					? "chat"
					: "streams",
			)
		}
		hadFocusRef.current = hasFocus
	}, [hasFocus, primaryStream])

	// Nudge companion players whenever the focused set changes (a re-added
	// companion may be paused on its last frame).
	const focusedStreamIdsSignature = focusedStreamIds.join("|")
	useEffect(() => {
		if (focusedStreamIds.length > 1) {
			setCompanionPlaybackToken((token) => token + 1)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [focusedStreamIdsSignature])

	// The cinema view is a fixed overlay; stop the page behind it from
	// scrolling underneath.
	useEffect(() => {
		if (!showCinema) {
			return undefined
		}
		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = "hidden"
		return () => {
			document.body.style.overflow = previousOverflow
		}
	}, [showCinema])

	const bumpMainPlayback = useCallback(() => {
		setMainPlaybackToken((token) => token + 1)
	}, [])

	const handleEnterPip = useCallback(() => {
		const prefs = loadPipPrefs()
		const vw = window.innerWidth
		const vh = window.innerHeight
		const width = Math.round(
			Math.min(
				Math.max(vw * prefs.widthFraction, PIP_MIN_WIDTH_PX),
				vw - PIP_MARGIN_PX * 2,
			),
		)
		const height = getPipFrameHeight(width)
		setPipRect(
			clampPipRect(
				{
					left:
						prefs.snapSide === "left"
							? PIP_MARGIN_PX
							: vw - width - PIP_MARGIN_PX,
					// Land above the bottom edge where mobile browser chrome and
					// gesture bars live.
					top: vh - height - PIP_MARGIN_PX - 72,
					width,
				},
				{ width: vw, height: vh },
			),
		)
		setPipMode(true)
		bumpMainPlayback()
	}, [bumpMainPlayback])

	const handleRestoreFromPip = useCallback(() => {
		setPipMode(false)
		bumpMainPlayback()
	}, [bumpMainPlayback])

	const handleCommitPipRect = useCallback((rect) => {
		setPipRect(rect)
		const vw = window.innerWidth
		savePipPrefs({
			widthFraction: rect.width / vw,
			snapSide: rect.left + rect.width / 2 < vw / 2 ? "left" : "right",
		})
	}, [])

	// Saved desktop arrangements can carry the two-stream "duo" layout, whose
	// companion cap would block mobile multiview adds; mobile has a single
	// presentation, so widen to the stacked cap first.
	const handleAddCompanion = useCallback(
		(streamId) => {
			const wallState = useWallStore.getState()
			if (wallState.focusLayout === "duo") {
				wallState.setFocusLayout("stacked")
			}
			onAddFocusCompanion(streamId)
		},
		[onAddFocusCompanion],
	)

	const canFullscreen =
		typeof document !== "undefined" &&
		Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled)

	const handleFullscreen = useCallback(() => {
		const node = frameElRef.current
		if (!node) {
			return
		}
		try {
			const request =
				node.requestFullscreen?.bind(node) ??
				node.webkitRequestFullscreen?.bind(node)
			const result = request?.()
			// Landscape is the natural orientation for a fullscreen stream;
			// lock is best-effort (Android Chrome only — iOS throws).
			result
				?.then?.(() => {
					window.screen?.orientation?.lock?.("landscape")?.catch?.(() => {})
				})
				?.catch?.(() => {})
		} catch {
			// Fullscreen unavailable — the button is hidden when unsupported, so
			// this is just belt-and-braces.
		}
	}, [])

	useEffect(() => {
		const handleFullscreenChange = () => {
			if (!document.fullscreenElement && !document.webkitFullscreenElement) {
				// Twitch often pauses across the fullscreen exit relayout.
				setMainPlaybackToken((token) => token + 1)
			}
		}
		document.addEventListener("fullscreenchange", handleFullscreenChange)
		document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange)
			document.removeEventListener(
				"webkitfullscreenchange",
				handleFullscreenChange,
			)
		}
	}, [])

	const dockedFrameHeight = getPipFrameHeight(viewport.width)

	return (
		<>
			{(!hasFocus || pipMode) && (
				<div className="flex min-w-0 items-start">
					<StreamGrid
						streams={feedStreams}
						layoutMode="auto"
						maxColumns={Math.min(maxColumns ?? 1, 1)}
						expandedCardChatStreamId={expandedCardChatStreamId}
						previewStream={previewStream}
						previewStreamAlreadyAdded={previewStreamAlreadyAdded}
						onAddPreviewStream={onAddPreviewStream}
						onClosePreview={onClosePreview}
						forceAllMuted={pipMode}
						onVolumeChange={onVolumeChange}
						onRemove={onRemove}
						onEdit={onEdit}
						onOpenViews={onOpenViews}
						onSelectView={onSelectView}
						onReorder={onReorder}
						onToggleChat={onToggleChat}
						onEnterFocus={onEnterFocus}
					/>
				</div>
			)}

			{showCinema && (
				<MobileCinemaView
					primaryStream={primaryStream}
					frameHeight={dockedFrameHeight}
					activeTab={activeTab}
					onSelectTab={setActiveTab}
					chatStreams={chatStreams}
					activeChatStreamId={focusChatStreamId}
					onSelectChatStream={onSetFocusChatStream}
					otherStreams={otherStreams}
					onWatchStream={onEnterFocus}
					companionStreams={companionStreams}
					availableStreams={otherStreams}
					canAddCompanion={focusedStreamIds.length < MAX_FOCUSED_STREAMS}
					streamVolumes={streamVolumes}
					companionPlaybackToken={companionPlaybackToken}
					onAddCompanion={handleAddCompanion}
					onRemoveCompanion={onRemoveFocusCompanion}
					onPromoteCompanion={onPromoteFocusStream}
					onVolumeChange={onVolumeChange}
					onClose={onClearFocus}
					onEnterPip={handleEnterPip}
					onFullscreen={handleFullscreen}
					canFullscreen={canFullscreen}
				/>
			)}

			{hasFocus && (
				<MobileMainPlayerFrame
					key={`main-${primaryStream.id}`}
					stream={primaryStream}
					pipMode={pipMode}
					pipRect={pipRect}
					viewport={viewport}
					playbackToken={mainPlaybackToken}
					volume={streamVolumes[primaryStream.id] ?? 100}
					onVolumeChange={onVolumeChange}
					frameElRef={frameElRef}
					onEnterPip={handleEnterPip}
					onRestore={handleRestoreFromPip}
					onClose={onClearFocus}
					onCommitPipRect={handleCommitPipRect}
					onGestureSettled={bumpMainPlayback}
					onSelectView={onSelectView}
				/>
			)}
		</>
	)
}
