import { useCallback, useEffect, useRef, useState } from "react"
import StreamCard from "../StreamCard"

export const MOBILE_TOP_BAR_PX = 48
export const MOBILE_FRAME_BAR_PX = 36
export const PIP_MARGIN_PX = 12
export const PIP_MIN_WIDTH_PX = 180
const DOCK_DRAG_TO_PIP_THRESHOLD_PX = 80
const TAP_SLOP_PX = 6
const SNAP_TRANSITION_MS = 160
const VIDEO_ASPECT = 16 / 9

export function getPipFrameHeight(width) {
	return Math.round(width / VIDEO_ASPECT) + MOBILE_FRAME_BAR_PX
}

export function clampPipRect(rect, viewport) {
	const maxWidth = Math.max(
		PIP_MIN_WIDTH_PX,
		viewport.width - PIP_MARGIN_PX * 2,
	)
	const width = Math.min(Math.max(rect.width, PIP_MIN_WIDTH_PX), maxWidth)
	const height = getPipFrameHeight(width)
	const left = Math.min(
		Math.max(rect.left, PIP_MARGIN_PX),
		viewport.width - width - PIP_MARGIN_PX,
	)
	const top = Math.min(
		Math.max(rect.top, PIP_MARGIN_PX),
		Math.max(PIP_MARGIN_PX, viewport.height - height - PIP_MARGIN_PX),
	)
	return { left, top, width }
}

export function snapPipRect(rect, viewport) {
	const clamped = clampPipRect(rect, viewport)
	const snappedLeft =
		clamped.left + clamped.width / 2 < viewport.width / 2
			? PIP_MARGIN_PX
			: viewport.width - clamped.width - PIP_MARGIN_PX
	return { ...clamped, left: snappedLeft }
}

function FrameBarButton({ icon, label, onClick }) {
	return (
		<button
			type="button"
			data-frame-action
			onClick={onClick}
			aria-label={label}
			title={label}
			className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-0 bg-white/8 text-slate-100 cursor-pointer transition-colors hover:bg-white/16"
		>
			<i className={`fa-solid ${icon} text-[0.7rem]`} />
		</button>
	)
}

/**
 * The mobile main player: a single fixed-position frame that morphs between
 * the docked cinema slot (full width under the top bar) and a free-floating,
 * draggable + resizable mini player (PiP).
 *
 * All gestures start on the handle bar BELOW the video. Nothing may overlap
 * the player iframe — even a transparent element over a Twitch embed trips
 * Chrome's occlusion tracker and Twitch refuses playback (see
 * StreamCard.jsx). Moving via left/top and resizing the container are safe;
 * pinch-to-resize is deliberately not supported because the fingers would
 * land on the iframe itself.
 */
export default function MobileMainPlayerFrame({
	stream,
	pipMode,
	pipRect,
	viewport,
	playbackToken,
	volume,
	onVolumeChange,
	frameElRef,
	onEnterPip,
	onRestore,
	onClose,
	onCommitPipRect,
	onGestureSettled,
	onSelectView,
	onPlayerReady,
	loadSessionKey,
}) {
	// Transient gesture presentation:
	//   {type:"dockDrag", dy} | {type:"drag", left, top} | {type:"resize", left, width}
	const [gesture, setGesture] = useState(null)
	const dragRef = useRef(null)
	const resizeRef = useRef(null)

	// Remember the last audible level so tapping unmute restores it instead of
	// a hard-coded default (mirrors StreamCard).
	const lastNonZeroVolumeRef = useRef(volume > 0 ? volume : 100)
	useEffect(() => {
		if (volume > 0) {
			lastNonZeroVolumeRef.current = volume
		}
	}, [volume])
	const isMuted = volume === 0
	const handleToggleMute = () => {
		onVolumeChange(
			stream.id,
			isMuted ? lastNonZeroVolumeRef.current || 100 : 0,
		)
	}

	const endDrag = useCallback(() => {
		const drag = dragRef.current
		dragRef.current = null
		setGesture(null)
		if (!drag) {
			return
		}

		if (drag.mode === "dockDrag") {
			if (drag.moved && drag.lastDy >= DOCK_DRAG_TO_PIP_THRESHOLD_PX) {
				onEnterPip()
			}
			return
		}

		if (!drag.moved) {
			onRestore()
			return
		}

		onCommitPipRect(
			snapPipRect(
				{
					left: drag.baseLeft + drag.lastDx,
					top: drag.baseTop + drag.lastDy,
					width: drag.baseWidth,
				},
				viewport,
			),
		)
		onGestureSettled()
	}, [onCommitPipRect, onEnterPip, onGestureSettled, onRestore, viewport])

	const handleBarPointerDown = (event) => {
		if (event.target.closest("[data-frame-action]")) {
			return
		}
		if (event.pointerType === "mouse" && event.button !== 0) {
			return
		}

		event.currentTarget.setPointerCapture(event.pointerId)
		dragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			baseLeft: pipRect?.left ?? 0,
			baseTop: pipRect?.top ?? 0,
			baseWidth: pipRect?.width ?? viewport.width,
			mode: pipMode ? "drag" : "dockDrag",
			moved: false,
			lastDx: 0,
			lastDy: 0,
		}
	}

	const handleBarPointerMove = (event) => {
		const drag = dragRef.current
		if (!drag || drag.pointerId !== event.pointerId) {
			return
		}

		const dx = event.clientX - drag.startX
		const dy = event.clientY - drag.startY
		if (!drag.moved && Math.hypot(dx, dy) < TAP_SLOP_PX) {
			return
		}

		drag.moved = true
		drag.lastDx = dx
		drag.lastDy = dy

		if (drag.mode === "dockDrag") {
			setGesture({ type: "dockDrag", dy: Math.max(0, dy) })
			return
		}

		setGesture({
			type: "drag",
			left: drag.baseLeft + dx,
			top: drag.baseTop + dy,
		})
	}

	const handleBarPointerEnd = (event) => {
		const drag = dragRef.current
		if (!drag || drag.pointerId !== event.pointerId) {
			return
		}
		endDrag()
	}

	const handleBarPointerCancel = () => {
		dragRef.current = null
		setGesture(null)
	}

	const handleResizePointerDown = (event) => {
		event.stopPropagation()
		if (event.pointerType === "mouse" && event.button !== 0) {
			return
		}
		if (!pipRect) {
			return
		}

		event.currentTarget.setPointerCapture(event.pointerId)
		resizeRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			baseLeft: pipRect.left,
			baseTop: pipRect.top,
			baseWidth: pipRect.width,
			// Grow away from the snapped edge so the pip never has to leave the
			// screen mid-gesture: right-half pips keep their right edge pinned.
			anchorRight:
				pipRect.left + pipRect.width / 2 >= viewport.width / 2,
			lastWidth: pipRect.width,
			lastLeft: pipRect.left,
		}
	}

	const handleResizePointerMove = (event) => {
		const resize = resizeRef.current
		if (!resize || resize.pointerId !== event.pointerId) {
			return
		}

		const dx = event.clientX - resize.startX
		const dy = event.clientY - resize.startY
		const horizontalGrowth = resize.anchorRight ? -dx : dx
		const verticalGrowth = dy * VIDEO_ASPECT
		const growth =
			Math.abs(horizontalGrowth) >= Math.abs(verticalGrowth)
				? horizontalGrowth
				: verticalGrowth

		const baseRight = resize.baseLeft + resize.baseWidth
		const maxWidth = Math.min(
			viewport.width - PIP_MARGIN_PX * 2,
			resize.anchorRight
				? baseRight - PIP_MARGIN_PX
				: viewport.width - resize.baseLeft - PIP_MARGIN_PX,
			Math.max(
				PIP_MIN_WIDTH_PX,
				(viewport.height - resize.baseTop - PIP_MARGIN_PX - MOBILE_FRAME_BAR_PX) *
					VIDEO_ASPECT,
			),
		)
		const width = Math.round(
			Math.min(Math.max(resize.baseWidth + growth, PIP_MIN_WIDTH_PX), maxWidth),
		)
		const left = resize.anchorRight ? baseRight - width : resize.baseLeft

		resize.lastWidth = width
		resize.lastLeft = left
		setGesture({ type: "resize", left, width })
	}

	const handleResizePointerEnd = (event) => {
		const resize = resizeRef.current
		if (!resize || resize.pointerId !== event.pointerId) {
			return
		}

		resizeRef.current = null
		setGesture(null)
		onCommitPipRect(
			snapPipRect(
				{
					left: resize.lastLeft,
					top: resize.baseTop,
					width: resize.lastWidth,
				},
				viewport,
			),
		)
		onGestureSettled()
	}

	const handleResizePointerCancel = () => {
		resizeRef.current = null
		setGesture(null)
	}

	const isGesturing = gesture !== null

	let frameLeft = 0
	let frameTop = MOBILE_TOP_BAR_PX
	let frameWidth = viewport.width
	if (pipMode && pipRect) {
		frameLeft = pipRect.left
		frameTop = pipRect.top
		frameWidth = pipRect.width
		if (gesture?.type === "drag") {
			frameLeft = gesture.left
			frameTop = gesture.top
		} else if (gesture?.type === "resize") {
			frameLeft = gesture.left
			frameWidth = gesture.width
		}
	}
	const frameHeight = getPipFrameHeight(frameWidth)

	const frameStyle = {
		position: "fixed",
		left: `${frameLeft}px`,
		top: `${frameTop}px`,
		width: `${frameWidth}px`,
		height: `${frameHeight}px`,
		zIndex: 70,
		transform:
			gesture?.type === "dockDrag" ? `translateY(${gesture.dy}px)` : undefined,
		transition: isGesturing
			? "none"
			: `left ${SNAP_TRANSITION_MS}ms ease, top ${SNAP_TRANSITION_MS}ms ease, width ${SNAP_TRANSITION_MS}ms ease, height ${SNAP_TRANSITION_MS}ms ease, transform ${SNAP_TRANSITION_MS}ms ease`,
		willChange: "left, top, width, height",
	}

	return (
		<div ref={frameElRef} style={frameStyle} className="flex flex-col">
			<div className="min-h-0 flex-1">
				<StreamCard
					stream={stream}
					volume={volume}
					playbackToken={playbackToken}
					onVolumeChange={onVolumeChange}
					onSelectView={onSelectView}
					presentation="focus"
					focusTileRole="primary"
					fluidVideo
					onPlayerReady={onPlayerReady}
					loadSessionKey={loadSessionKey}
				/>
			</div>

			<div
				onPointerDown={handleBarPointerDown}
				onPointerMove={handleBarPointerMove}
				onPointerUp={handleBarPointerEnd}
				onPointerCancel={handleBarPointerCancel}
				className="flex shrink-0 touch-none select-none items-center gap-2 rounded-b-[0.9rem] border border-t-0 border-white/10 bg-slate-950/96 px-2"
				style={{ height: `${MOBILE_FRAME_BAR_PX}px`, cursor: "grab" }}
			>
				{pipMode ? (
					<>
						<i className="fa-solid fa-grip-lines shrink-0 pl-1 text-[0.7rem] text-slate-400/85" />
						<span className="min-w-0 flex-1 truncate text-[0.7rem] font-semibold text-slate-100">
							{stream.title}
						</span>
						<FrameBarButton
							icon="fa-up-right-and-down-left-from-center"
							label="Expand mini player"
							onClick={onRestore}
						/>
						<FrameBarButton
							icon="fa-xmark"
							label="Close mini player"
							onClick={onClose}
						/>
						<div
							onPointerDown={handleResizePointerDown}
							onPointerMove={handleResizePointerMove}
							onPointerUp={handleResizePointerEnd}
							onPointerCancel={handleResizePointerCancel}
							role="slider"
							aria-label={`Resize mini player for ${stream.title}`}
							aria-valuemin={PIP_MIN_WIDTH_PX}
							aria-valuemax={viewport.width - PIP_MARGIN_PX * 2}
							aria-valuenow={Math.round(frameWidth)}
							tabIndex={-1}
							className="flex h-full w-11 shrink-0 touch-none items-center justify-center text-slate-300/80"
							style={{ cursor: "nwse-resize" }}
						>
							<i className="fa-solid fa-up-right-and-down-left-from-center rotate-90 text-[0.72rem]" />
						</div>
					</>
				) : (
					<>
						<span
							className="flex shrink-0 items-center gap-2 pl-1 text-slate-400/75"
							title="Drag down for mini player"
						>
							<i className="fa-solid fa-grip-lines text-[0.72rem]" />
							<span className="text-[0.6rem] font-bold uppercase tracking-[0.12em] max-[360px]:hidden">
								Drag
							</span>
						</span>
						<button
							type="button"
							data-frame-action
							onClick={handleToggleMute}
							aria-label={
								isMuted ? `Unmute ${stream.title}` : `Mute ${stream.title}`
							}
							aria-pressed={isMuted}
							className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-0 bg-white/8 text-slate-100 cursor-pointer transition-colors hover:bg-white/16"
						>
							<i
								className={`fa-solid ${
									isMuted ? "fa-volume-xmark" : "fa-volume-low"
								} text-[0.72rem]`}
							/>
						</button>
						<input
							type="range"
							data-frame-action
							min="0"
							max="100"
							step="1"
							value={volume}
							onChange={(event) =>
								onVolumeChange(stream.id, Number(event.target.value))
							}
							aria-label={`Volume for ${stream.title}`}
							className="h-1.5 min-w-0 flex-1 accent-cyan-400"
						/>
						<span className="w-8 shrink-0 pr-1 text-right text-[0.66rem] font-bold uppercase tracking-[0.12em] text-slate-300/70">
							{volume}
						</span>
					</>
				)}
			</div>
		</div>
	)
}
