import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	DndContext,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
} from "@dnd-kit/core"
import {
	SortableContext,
	rectSortingStrategy,
	useSortable,
} from "@dnd-kit/sortable"
import { useShallow } from "zustand/react/shallow"
import loaderSrc from "../../assets/loader.png"
import StreamCard from "./StreamCard"
import StreamPlayer from "./StreamPlayer"
import StreamChatSidebar from "./StreamChatSidebar"
import { getWallLayout } from "../utils"
import { AUTO_WALL_GAP_PX, STREAM_CARD_CHROME_PX } from "../layoutUtils"
import { useWallStore } from "../wallStore"

const AUTO_GRID_ROW_UNIT_PX = 8
const MATRIX_WALL_GAP_PX = 4
const INLINE_CHAT_PANEL_HEIGHT_PX = 348
const INLINE_CHAT_MARGIN_BOTTOM_PX = 12
const INLINE_CHAT_ADDED_HEIGHT_PX =
	INLINE_CHAT_PANEL_HEIGHT_PX + INLINE_CHAT_MARGIN_BOTTOM_PX
const FOCUS_WIDE_MIN_WIDTH_PX = 1280
const FOCUS_WIDE_MIN_HEIGHT_PX = 720
const FOCUS_MAX_STREAMS = 3
const FOCUS_OVERLAY_PADDING_PX = 24
const FOCUS_OVERLAY_SMALL_PADDING_PX = 16
const FOCUS_OVERLAY_GAP_PX = 16
const FOCUS_TOOLBAR_OFFSET_PX = 68
const FOCUS_TRANSITION_DURATION_MS = 320
const FOCUS_OPACITY_TRANSITION_DURATION_MS = 220
const FOCUS_CHAT_DRAWER_GAP_PX = 24
const FOCUS_CHAT_DRAWER_WIDTH_PX = 384
const FOCUS_CHAT_DRAWER_MAX_HEIGHT_PX = 832
const FOCUS_CHAT_DRAWER_MIN_WIDTH_PX = 280
const FOCUS_CHAT_DRAWER_MIN_HEIGHT_PX = 240
const FOCUS_CHAT_RESIZE_HIT_SIZE_PX = 12
const WALL_LOADER_TIMEOUT_MS = 7000

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max)
}

function getTransformStyle(transform) {
	if (!transform) {
		return undefined
	}

	return `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
}

function getGridRowSpan(heightPx, rowUnitPx, gapPx) {
	return Math.max(1, Math.ceil((heightPx + gapPx) / (rowUnitPx + gapPx)))
}

function WallLoaderOverlay({ loadingCount }) {
	return (
		<div className="absolute inset-0 z-[85] flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(8,15,35,0.9))] px-4 backdrop-blur-sm">
			<div className="wall-loader-shell w-full max-w-[32rem] rounded-[2rem] border border-white/10 bg-slate-950/36 p-4 shadow-[0_30px_90px_rgba(2,6,23,0.58)]">
				<img
					src={loaderSrc}
					alt="Coots loading the wall"
					className="wall-loader-image block h-auto w-full"
				/>
				<p className="mt-3 mb-0 text-center text-[0.72rem] font-bold uppercase tracking-[0.2em] text-cyan-100/76">
					Loading {loadingCount} stream{loadingCount === 1 ? "" : "s"}
				</p>
			</div>
		</div>
	)
}

function getFocusCardProps({
	streamId,
	focusFrame,
	onClearFocus,
	onPromoteFocusStream,
	onRemoveFocusCompanion,
}) {
	if (!focusFrame) {
		return {}
	}

	return {
		presentation: "focus",
		focusTileRole: focusFrame.role,
		onExitFocus: focusFrame.role === "primary" ? onClearFocus : undefined,
		onPromoteFocus:
			focusFrame.role === "companion"
				? () => onPromoteFocusStream(streamId)
				: undefined,
		onRemoveFromFocus:
			focusFrame.role === "companion"
				? () => onRemoveFocusCompanion(streamId)
				: undefined,
	}
}

function getFocusCanvas(viewportWidth, viewportHeight) {
	const padding =
		viewportWidth >= FOCUS_WIDE_MIN_WIDTH_PX
			? FOCUS_OVERLAY_PADDING_PX
			: FOCUS_OVERLAY_SMALL_PADDING_PX
	const left = padding
	const top = padding + FOCUS_TOOLBAR_OFFSET_PX
	const width = Math.max(320, viewportWidth - padding * 2)
	const height = Math.max(240, viewportHeight - top - padding)

	return {
		left,
		top,
		width,
		height,
	}
}

function buildFocusSlotStyles({
	focusLayout,
	slotCount,
	viewportWidth,
	viewportHeight,
}) {
	if (slotCount <= 0) {
		return []
	}

	const canvas = getFocusCanvas(viewportWidth, viewportHeight)
	const { left, top, width, height } = canvas

	if (slotCount === 1) {
		return [{ left, top, width, height }]
	}

	if (focusLayout === "equal") {
		const columnWidth =
			(width - FOCUS_OVERLAY_GAP_PX * (slotCount - 1)) / slotCount
		return Array.from({ length: slotCount }, (_, index) => ({
			left: left + index * (columnWidth + FOCUS_OVERLAY_GAP_PX),
			top,
			width: columnWidth,
			height,
		}))
	}

	const railWidth = clamp(width * 0.28, 236, 340)
	const primaryWidth = Math.max(320, width - railWidth - FOCUS_OVERLAY_GAP_PX)
	const companionLeft = left + primaryWidth + FOCUS_OVERLAY_GAP_PX

	if (slotCount === 2) {
		return [
			{
				left,
				top,
				width: primaryWidth,
				height,
			},
			{
				left: companionLeft,
				top,
				width: width - primaryWidth - FOCUS_OVERLAY_GAP_PX,
				height,
			},
		]
	}

	const companionWidth = width - primaryWidth - FOCUS_OVERLAY_GAP_PX
	const companionHeight = (height - FOCUS_OVERLAY_GAP_PX) / 2

	return [
		{
			left,
			top,
			width: primaryWidth,
			height,
		},
		{
			left: companionLeft,
			top,
			width: companionWidth,
			height: companionHeight,
		},
		{
			left: companionLeft,
			top: top + companionHeight + FOCUS_OVERLAY_GAP_PX,
			width: companionWidth,
			height: companionHeight,
		},
	]
}

function getFocusChatDrawerRect(viewportWidth, viewportHeight) {
	const width = Math.min(
		FOCUS_CHAT_DRAWER_WIDTH_PX,
		Math.max(280, viewportWidth - FOCUS_CHAT_DRAWER_GAP_PX * 2),
	)
	const height = Math.min(
		FOCUS_CHAT_DRAWER_MAX_HEIGHT_PX,
		Math.max(360, Math.floor(viewportHeight * 0.72)),
	)

	return {
		width,
		height,
		left: Math.max(
			FOCUS_CHAT_DRAWER_GAP_PX,
			viewportWidth - width - FOCUS_CHAT_DRAWER_GAP_PX,
		),
		top: Math.max(
			FOCUS_CHAT_DRAWER_GAP_PX,
			viewportHeight - height - FOCUS_CHAT_DRAWER_GAP_PX,
		),
	}
}

function clampFocusChatPosition(
	position,
	drawerRect,
	viewportWidth,
	viewportHeight,
) {
	const maxLeft = Math.max(
		FOCUS_CHAT_DRAWER_GAP_PX,
		viewportWidth - drawerRect.width - FOCUS_CHAT_DRAWER_GAP_PX,
	)
	const maxTop = Math.max(
		FOCUS_CHAT_DRAWER_GAP_PX,
		viewportHeight - drawerRect.height - FOCUS_CHAT_DRAWER_GAP_PX,
	)

	return {
		left: clamp(position.left, FOCUS_CHAT_DRAWER_GAP_PX, maxLeft),
		top: clamp(position.top, FOCUS_CHAT_DRAWER_GAP_PX, maxTop),
	}
}

function FocusChatResizeHandle({
	className,
	cursor,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onPointerCancel,
	style,
}) {
	return (
		<div
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerCancel}
			className={`pointer-events-auto absolute z-10 touch-none select-none ${className}`}
			style={{ cursor, ...style }}
		/>
	)
}

function FocusAddSlot({ style, availableStreams, onAddCompanion }) {
	const [menuOpen, setMenuOpen] = useState(false)
	const slotRef = useRef(null)

	useEffect(() => {
		if (!menuOpen) {
			return undefined
		}

		const handlePointerDown = (event) => {
			if (slotRef.current?.contains(event.target)) {
				return
			}

			setMenuOpen(false)
		}

		document.addEventListener("pointerdown", handlePointerDown)
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown)
		}
	}, [menuOpen])

	if (!availableStreams.length) {
		return null
	}

	return (
		<div className="fixed z-[72]" style={style}>
			<div
				ref={slotRef}
				className="flex h-full min-h-0 flex-col justify-center rounded-[1.7rem] border border-dashed border-cyan-300/28 bg-slate-950/26 p-4 backdrop-blur-sm"
			>
				<div className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-cyan-100/70">
					Open Slot
				</div>
				<button
					type="button"
					onClick={() => setMenuOpen((open) => !open)}
					className="mt-3 inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-cyan-400/18 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition-colors cursor-pointer hover:bg-white/12"
				>
					<i className="fa-solid fa-plus" />
					Add Companion
				</button>

				{menuOpen && (
					<div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-[1rem] border border-cyan-400/14 bg-slate-950/78 p-2">
						<div className="mb-2 px-2 text-[0.66rem] font-bold uppercase tracking-[0.16em] text-slate-300/58">
							Current project streams
						</div>
						<div className="space-y-1">
							{availableStreams.map((stream) => (
								<button
									key={stream.id}
									type="button"
									onClick={() => {
										onAddCompanion(stream.id)
										setMenuOpen(false)
									}}
									className="flex w-full items-center justify-between gap-3 rounded-xl border-0 bg-white/6 px-3 py-2 text-left text-sm text-white transition-colors cursor-pointer hover:bg-white/10"
								>
									<span className="truncate">{stream.title}</span>
									<span className="shrink-0 text-[0.64rem] font-bold uppercase tracking-[0.14em] text-slate-300/60">
										{stream.platform}
									</span>
								</button>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

function FocusOverlayChrome({
	hasMultiFocusExperience,
	hiddenCompanionCount,
	focusLayout,
	focusChatOpen,
	focusChatStreamId,
	focusedTwitchStreams,
	emptySlotStyles,
	availableCompanionStreams,
	viewportWidth,
	viewportHeight,
	onAddFocusCompanion,
	onSetFocusLayout,
	onToggleFocusChat,
	onSetFocusChatStream,
	onClearFocus,
}) {
	const drawerRect = useMemo(
		() => getFocusChatDrawerRect(viewportWidth, viewportHeight),
		[viewportHeight, viewportWidth],
	)
	const [chatPosition, setChatPosition] = useState(() => ({
		left: drawerRect.left,
		top: drawerRect.top,
	}))
	const [chatSize, setChatSize] = useState(() => ({
		width: drawerRect.width,
		height: drawerRect.height,
	}))
	const chatDragRef = useRef(null)
	const chatResizeRef = useRef(null)
	const minChatWidth = FOCUS_CHAT_DRAWER_MIN_WIDTH_PX
	const minChatHeight = FOCUS_CHAT_DRAWER_MIN_HEIGHT_PX

	useEffect(() => {
		setChatPosition((prev) => {
			const pos = prev ?? { left: drawerRect.left, top: drawerRect.top }
			return clampFocusChatPosition(
				pos,
				drawerRect,
				viewportWidth,
				viewportHeight,
			)
		})
		setChatSize((prev) => ({
			width: clamp(
				prev.width,
				minChatWidth,
				viewportWidth - FOCUS_CHAT_DRAWER_GAP_PX * 2,
			),
			height: Math.min(
				Math.max(prev.height, minChatHeight),
				viewportHeight - FOCUS_CHAT_DRAWER_GAP_PX * 2,
			),
		}))
	}, [drawerRect, minChatHeight, minChatWidth, viewportHeight, viewportWidth])

	const handleChatDragStart = useCallback(
		(event) => {
			if (event.button !== 0) return
			if (event.target instanceof Element) {
				const actionTarget = event.target.closest(
					'[data-focus-chat-action="true"]',
				)
				if (actionTarget) {
					return
				}
			}
			event.preventDefault()
			event.currentTarget.setPointerCapture(event.pointerId)
			chatDragRef.current = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				startLeft: chatPosition.left,
				startTop: chatPosition.top,
			}
		},
		[chatPosition.left, chatPosition.top],
	)

	const handleChatDragMove = useCallback(
		(event) => {
			const drag = chatDragRef.current
			if (!drag || event.pointerId !== drag.pointerId) return
			const nextLeft = drag.startLeft + (event.clientX - drag.startX)
			const nextTop = drag.startTop + (event.clientY - drag.startY)
			setChatPosition({
				left: clamp(
					nextLeft,
					FOCUS_CHAT_DRAWER_GAP_PX,
					viewportWidth - chatSize.width - FOCUS_CHAT_DRAWER_GAP_PX,
				),
				top: clamp(
					nextTop,
					FOCUS_CHAT_DRAWER_GAP_PX,
					viewportHeight - chatSize.height - FOCUS_CHAT_DRAWER_GAP_PX,
				),
			})
		},
		[chatSize.width, chatSize.height, viewportWidth, viewportHeight],
	)

	const handleChatDragEnd = useCallback((event) => {
		const drag = chatDragRef.current
		if (!drag || event.pointerId !== drag.pointerId) return
		chatDragRef.current = null
	}, [])

	const handleChatResizeStart = useCallback(
		(edges) => (event) => {
			if (event.button !== 0) return
			event.preventDefault()
			event.currentTarget.setPointerCapture(event.pointerId)
			chatResizeRef.current = {
				edges,
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				startLeft: chatPosition.left,
				startTop: chatPosition.top,
				startWidth: chatSize.width,
				startHeight: chatSize.height,
			}
		},
		[chatPosition.left, chatPosition.top, chatSize.width, chatSize.height],
	)

	const handleChatResizeMove = useCallback(
		(event) => {
			const resize = chatResizeRef.current
			if (!resize || event.pointerId !== resize.pointerId) return
			const deltaX = event.clientX - resize.startX
			const deltaY = event.clientY - resize.startY
			const nextRight = resize.startLeft + resize.startWidth
			const nextBottom = resize.startTop + resize.startHeight
			let nextLeft = resize.startLeft
			let nextTop = resize.startTop
			let nextWidth = resize.startWidth
			let nextHeight = resize.startHeight

			if (resize.edges.includes("right")) {
				nextWidth = clamp(
					resize.startWidth + deltaX,
					minChatWidth,
					viewportWidth - resize.startLeft - FOCUS_CHAT_DRAWER_GAP_PX,
				)
			}

			if (resize.edges.includes("bottom")) {
				nextHeight = clamp(
					resize.startHeight + deltaY,
					minChatHeight,
					viewportHeight - resize.startTop - FOCUS_CHAT_DRAWER_GAP_PX,
				)
			}

			if (resize.edges.includes("left")) {
				nextLeft = clamp(
					resize.startLeft + deltaX,
					FOCUS_CHAT_DRAWER_GAP_PX,
					nextRight - minChatWidth,
				)
				nextWidth = nextRight - nextLeft
			}

			if (resize.edges.includes("top")) {
				nextTop = clamp(
					resize.startTop + deltaY,
					FOCUS_CHAT_DRAWER_GAP_PX,
					nextBottom - minChatHeight,
				)
				nextHeight = nextBottom - nextTop
			}

			setChatPosition({ left: nextLeft, top: nextTop })
			setChatSize({ width: nextWidth, height: nextHeight })
		},
		[minChatHeight, minChatWidth, viewportHeight, viewportWidth],
	)

	const handleChatResizeEnd = useCallback((event) => {
		const resize = chatResizeRef.current
		if (!resize || event.pointerId !== resize.pointerId) return
		chatResizeRef.current = null
	}, [])

	return (
		<>
			<div
				className="fixed inset-0 z-[40] bg-slate-950/84 backdrop-blur-sm"
				onClick={onClearFocus}
			/>

			<div className="pointer-events-none fixed inset-x-6 top-6 z-[80] flex items-start justify-between gap-3 max-sm:inset-x-4">
				<div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-slate-950/78 px-4 py-2 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-cyan-50 shadow-[0_10px_28px_rgba(2,6,23,0.34)] backdrop-blur">
					<i className="fa-solid fa-film text-[0.72rem]" />
					Cinema Mode
				</div>

				<div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
					{hasMultiFocusExperience && (
						<div className="inline-flex items-center gap-1 rounded-full bg-slate-950/78 p-1 shadow-[0_10px_28px_rgba(2,6,23,0.34)] backdrop-blur">
							<button
								type="button"
								onClick={() => onSetFocusLayout("hero")}
								className={`rounded-full px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] transition-colors cursor-pointer ${
									focusLayout === "hero"
										? "bg-cyan-400/18 text-cyan-50"
										: "text-slate-200/78 hover:bg-white/8"
								}`}
							>
								Hero
							</button>
							<button
								type="button"
								onClick={() => onSetFocusLayout("equal")}
								className={`rounded-full px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] transition-colors cursor-pointer ${
									focusLayout === "equal"
										? "bg-cyan-400/18 text-cyan-50"
										: "text-slate-200/78 hover:bg-white/8"
								}`}
							>
								Equal
							</button>
						</div>
					)}

					{focusedTwitchStreams.length > 0 && (
						<button
							type="button"
							onClick={onToggleFocusChat}
							className={`rounded-full px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] shadow-[0_10px_28px_rgba(2,6,23,0.34)] backdrop-blur transition-colors cursor-pointer ${
								focusChatOpen
									? "bg-cyan-400/18 text-cyan-50"
									: "bg-slate-950/78 text-slate-100 hover:bg-slate-900/92"
							}`}
						>
							{focusChatOpen ? "Hide Chat" : "Open Chat"}
						</button>
					)}

					<button
						type="button"
						onClick={onClearFocus}
						className="rounded-full bg-slate-950/78 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-100 shadow-[0_10px_28px_rgba(2,6,23,0.34)] backdrop-blur transition-colors cursor-pointer hover:bg-slate-900/92"
					>
						Close
					</button>
				</div>
			</div>

			{!hasMultiFocusExperience && hiddenCompanionCount > 0 && (
				<div className="pointer-events-none fixed top-24 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-slate-950/78 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-100 shadow-[0_10px_28px_rgba(2,6,23,0.34)] backdrop-blur">
					Wider viewport restores {hiddenCompanionCount} companion
					{hiddenCompanionCount > 1 ? "s" : ""}
				</div>
			)}

			{hasMultiFocusExperience &&
				emptySlotStyles.map((style, index) => (
					<FocusAddSlot
						key={`focus-slot-${index}`}
						style={style}
						availableStreams={availableCompanionStreams}
						onAddCompanion={onAddFocusCompanion}
					/>
				))}

			{focusChatOpen && focusedTwitchStreams.length > 0 && (
				<div
					className="pointer-events-none fixed z-[85]"
					style={{
						left: chatPosition.left,
						top: chatPosition.top,
						width: chatSize.width,
						height: chatSize.height,
					}}
				>
					<div className="pointer-events-auto relative flex h-full w-full flex-col overflow-hidden rounded-[1.7rem]  bg-[linear-gradient(180deg,rgba(12,18,36,0.96),rgba(8,12,28,0.98))] shadow-[0_32px_90px_rgba(2,6,23,0.48)]">
						<div className="pointer-events-none absolute inset-0">
							<FocusChatResizeHandle
								className="inset-x-0 top-0"
								cursor="ns-resize"
								onPointerDown={handleChatResizeStart(["top"])}
								onPointerMove={handleChatResizeMove}
								onPointerUp={handleChatResizeEnd}
								onPointerCancel={handleChatResizeEnd}
								style={{ height: `${FOCUS_CHAT_RESIZE_HIT_SIZE_PX}px` }}
							/>
							<FocusChatResizeHandle
								className="inset-y-0 right-0"
								cursor="ew-resize"
								onPointerDown={handleChatResizeStart(["right"])}
								onPointerMove={handleChatResizeMove}
								onPointerUp={handleChatResizeEnd}
								onPointerCancel={handleChatResizeEnd}
								style={{ width: `${FOCUS_CHAT_RESIZE_HIT_SIZE_PX}px` }}
							/>
							<FocusChatResizeHandle
								className="inset-x-0 bottom-0"
								cursor="ns-resize"
								onPointerDown={handleChatResizeStart(["bottom"])}
								onPointerMove={handleChatResizeMove}
								onPointerUp={handleChatResizeEnd}
								onPointerCancel={handleChatResizeEnd}
								style={{ height: `${FOCUS_CHAT_RESIZE_HIT_SIZE_PX}px` }}
							/>
							<FocusChatResizeHandle
								className="inset-y-0 left-0"
								cursor="ew-resize"
								onPointerDown={handleChatResizeStart(["left"])}
								onPointerMove={handleChatResizeMove}
								onPointerUp={handleChatResizeEnd}
								onPointerCancel={handleChatResizeEnd}
								style={{ width: `${FOCUS_CHAT_RESIZE_HIT_SIZE_PX}px` }}
							/>
							<FocusChatResizeHandle
								className="top-0 left-0"
								cursor="nwse-resize"
								onPointerDown={handleChatResizeStart(["top", "left"])}
								onPointerMove={handleChatResizeMove}
								onPointerUp={handleChatResizeEnd}
								onPointerCancel={handleChatResizeEnd}
								style={{
									width: `${FOCUS_CHAT_RESIZE_HIT_SIZE_PX * 2}px`,
									height: `${FOCUS_CHAT_RESIZE_HIT_SIZE_PX * 2}px`,
								}}
							/>
							<FocusChatResizeHandle
								className="top-0 right-0"
								cursor="nesw-resize"
								onPointerDown={handleChatResizeStart(["top", "right"])}
								onPointerMove={handleChatResizeMove}
								onPointerUp={handleChatResizeEnd}
								onPointerCancel={handleChatResizeEnd}
								style={{
									width: `${FOCUS_CHAT_RESIZE_HIT_SIZE_PX * 2}px`,
									height: `${FOCUS_CHAT_RESIZE_HIT_SIZE_PX * 2}px`,
								}}
							/>
							<FocusChatResizeHandle
								className="right-0 bottom-0"
								cursor="nwse-resize"
								onPointerDown={handleChatResizeStart(["bottom", "right"])}
								onPointerMove={handleChatResizeMove}
								onPointerUp={handleChatResizeEnd}
								onPointerCancel={handleChatResizeEnd}
								style={{
									width: `${FOCUS_CHAT_RESIZE_HIT_SIZE_PX * 2}px`,
									height: `${FOCUS_CHAT_RESIZE_HIT_SIZE_PX * 2}px`,
								}}
							/>
							<FocusChatResizeHandle
								className="bottom-0 left-0"
								cursor="nesw-resize"
								onPointerDown={handleChatResizeStart(["bottom", "left"])}
								onPointerMove={handleChatResizeMove}
								onPointerUp={handleChatResizeEnd}
								onPointerCancel={handleChatResizeEnd}
								style={{
									width: `${FOCUS_CHAT_RESIZE_HIT_SIZE_PX * 2}px`,
									height: `${FOCUS_CHAT_RESIZE_HIT_SIZE_PX * 2}px`,
								}}
							/>
						</div>
						<div
							onPointerDown={handleChatDragStart}
							onPointerMove={handleChatDragMove}
							onPointerUp={handleChatDragEnd}
							onPointerCancel={handleChatDragEnd}
							className="flex cursor-grab items-center justify-between gap-3 border-b border-cyan-400/12 px-4 py-3 active:cursor-grabbing"
						>
							<div>
								<div className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-cyan-100/72">
									Focused Chat
								</div>
								<div className="mt-1 text-sm font-semibold text-white">
									{focusedTwitchStreams.find(
										(stream) => stream.id === focusChatStreamId,
									)?.title ?? focusedTwitchStreams[0]?.title}
								</div>
							</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									data-focus-chat-action="true"
									onPointerDown={(event) => event.stopPropagation()}
									onClick={onToggleFocusChat}
									className="rounded-full bg-white/8 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white transition-colors cursor-pointer hover:bg-white/12"
								>
									Close
								</button>
							</div>
						</div>

						<div className="min-h-0 flex-1 p-3 pt-0">
							<StreamChatSidebar
								streams={focusedTwitchStreams}
								activeStreamId={focusChatStreamId}
								onSelectStream={onSetFocusChatStream}
								variant="overlay"
							/>
						</div>

						{/* Resize handle */}
						<div
							onPointerDown={handleChatResizeStart(["bottom", "right"])}
							onPointerMove={handleChatResizeMove}
							onPointerUp={handleChatResizeEnd}
							onPointerCancel={handleChatResizeEnd}
							className="absolute right-0 bottom-0 z-10 flex h-7 w-7 cursor-se-resize items-center justify-center rounded-tl-lg touch-none select-none"
						>
							<svg
								width="12"
								height="12"
								viewBox="0 0 12 12"
								className="pointer-events-none text-white/50"
							>
								<path
									d="M11 1v10H1"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
								/>
								<path
									d="M11 5v6H5"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
								/>
							</svg>
						</div>
					</div>
				</div>
			)}
		</>
	)
}

function SortableStreamCard({
	stream,
	cardHeight,
	gridRowSpan = 1,
	videoHeight,
	volume,
	forcedMuted,
	playbackToken = 0,
	primaryFocusTransitionKey = 0,
	onVolumeChange,
	onRemove,
	onEdit,
	onToggleChat,
	onFocus,
	focusFrame = null,
	hasActiveFocus = false,
	onClearFocus,
	onPromoteFocusStream,
	onRemoveFocusCompanion,
	onPrimaryFocusTransitionSettled,
	onPlayerReady,
	loadSessionKey,
	chatExpanded = false,
	canManageStreamMembership = true,
	canReorderStreamMembership = true,
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: stream.id })
	const sizeTransition = `width ${FOCUS_TRANSITION_DURATION_MS}ms ease, height ${FOCUS_TRANSITION_DURATION_MS}ms ease`
	const mergedTransition = transition
		? `${transition}, ${sizeTransition}`
		: sizeTransition
	const isInFocusComposition = Boolean(focusFrame)
	const isPrimaryFocusTile = focusFrame?.role === "primary"
	const settledTransitionKeyRef = useRef(0)
	const transitionFallbackTimeoutRef = useRef(null)
	const focusCardProps = getFocusCardProps({
		streamId: stream.id,
		focusFrame,
		onClearFocus,
		onPromoteFocusStream,
		onRemoveFocusCompanion,
	})

	const firePrimaryFocusTransitionSettled = useCallback(() => {
		if (
			!isPrimaryFocusTile ||
			primaryFocusTransitionKey <= 0 ||
			typeof onPrimaryFocusTransitionSettled !== "function" ||
			settledTransitionKeyRef.current === primaryFocusTransitionKey
		) {
			return
		}

		settledTransitionKeyRef.current = primaryFocusTransitionKey
		window.clearTimeout(transitionFallbackTimeoutRef.current)
		transitionFallbackTimeoutRef.current = null
		onPrimaryFocusTransitionSettled(stream.id, primaryFocusTransitionKey)
	}, [
		isPrimaryFocusTile,
		onPrimaryFocusTransitionSettled,
		primaryFocusTransitionKey,
		stream.id,
	])

	const handleFocusTransitionEnd = useCallback(
		(event) => {
			if (
				event.target !== event.currentTarget ||
				!["top", "left", "width", "height"].includes(event.propertyName)
			) {
				return
			}

			firePrimaryFocusTransitionSettled()
		},
		[firePrimaryFocusTransitionSettled],
	)

	useEffect(() => {
		window.clearTimeout(transitionFallbackTimeoutRef.current)
		transitionFallbackTimeoutRef.current = null

		if (
			!isPrimaryFocusTile ||
			primaryFocusTransitionKey <= 0 ||
			typeof onPrimaryFocusTransitionSettled !== "function"
		) {
			return undefined
		}

		if (settledTransitionKeyRef.current === primaryFocusTransitionKey) {
			return undefined
		}

		transitionFallbackTimeoutRef.current = window.setTimeout(
			firePrimaryFocusTransitionSettled,
			FOCUS_TRANSITION_DURATION_MS,
		)

		return () => {
			window.clearTimeout(transitionFallbackTimeoutRef.current)
			transitionFallbackTimeoutRef.current = null
		}
	}, [
		firePrimaryFocusTransitionSettled,
		isPrimaryFocusTile,
		onPrimaryFocusTransitionSettled,
		primaryFocusTransitionKey,
	])

	return (
		<div
			ref={setNodeRef}
			onTransitionEnd={
				isPrimaryFocusTile ? handleFocusTransitionEnd : undefined
			}
			className={
				isInFocusComposition
					? "pointer-events-auto"
					: hasActiveFocus
						? "pointer-events-none opacity-20 saturate-50 transition-opacity duration-300"
						: undefined
			}
			style={
				isInFocusComposition
					? {
							position: "fixed",
							left: focusFrame.left,
							top: focusFrame.top,
							width: focusFrame.width,
							height: focusFrame.height,
							transition: `top ${FOCUS_TRANSITION_DURATION_MS}ms ease, left ${FOCUS_TRANSITION_DURATION_MS}ms ease, width ${FOCUS_TRANSITION_DURATION_MS}ms ease, height ${FOCUS_TRANSITION_DURATION_MS}ms ease, opacity ${FOCUS_OPACITY_TRANSITION_DURATION_MS}ms ease`,
							willChange: "top, left, width, height",
							zIndex: 70,
						}
					: {
							width: "100%",
							minWidth: 0,
							height: `${cardHeight}px`,
							gridRow: `span ${gridRowSpan}`,
							transform: getTransformStyle(transform),
							transition: mergedTransition,
							willChange: "transform",
							zIndex: isDragging ? 20 : undefined,
						}
			}
		>
			<StreamCard
				stream={stream}
				videoHeight={videoHeight}
				volume={volume}
				forcedMuted={forcedMuted}
				playbackToken={playbackToken}
				onVolumeChange={onVolumeChange}
				onRemove={onRemove}
				onEdit={onEdit}
				onToggleChat={onToggleChat}
				onFocus={onFocus}
				onPlayerReady={onPlayerReady}
				loadSessionKey={loadSessionKey}
				isFocused={isInFocusComposition}
				chatExpanded={chatExpanded}
				inlineChatHeight={INLINE_CHAT_PANEL_HEIGHT_PX}
				dragHandleAttributes={attributes}
				dragHandleListeners={listeners}
				fluidVideo={isInFocusComposition}
				isDragging={isDragging}
				canManageStreamMembership={canManageStreamMembership}
				canReorderStreamMembership={canReorderStreamMembership}
				{...focusCardProps}
			/>
		</div>
	)
}

function AutoStreamGrid({
	streams,
	streamVolumes,
	containerSize,
	maxColumns = 4,
	expandedCardChatStreamId = null,
	primaryFocusedStreamId = null,
	focusPlaybackToken = 0,
	primaryFocusTransitionKey = 0,
	onVolumeChange,
	onRemove,
	onEdit,
	onReorder,
	onToggleChat,
	onFocus,
	focusFramesByStreamId = {},
	hasActiveFocus = false,
	onClearFocus,
	onPromoteFocusStream,
	onRemoveFocusCompanion,
	onPrimaryFocusTransitionSettled,
	onPlayerReady,
	loadSessionKey,
	canManageStreamMembership = true,
	canReorderStreamMembership = true,
}) {
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
	)
	const layout = useMemo(
		() =>
			getWallLayout({
				count: streams.length,
				containerWidth: containerSize.width,
				containerHeight: containerSize.height,
				gap: AUTO_WALL_GAP_PX,
				chromeHeight: STREAM_CARD_CHROME_PX,
				maxColumns,
			}),
		[containerSize.height, containerSize.width, maxColumns, streams.length],
	)

	const handleDragEnd = useCallback(
		(event) => {
			const { active, over } = event
			if (!over || active.id === over.id) {
				return
			}

			onReorder(String(active.id), String(over.id))
		},
		[onReorder],
	)

	const gridMarkup = (
		<div
			className="grid min-w-0 items-start"
			style={{
				gap: `${AUTO_WALL_GAP_PX}px`,
				gridTemplateColumns:
					layout.cardWidth > 0
						? `repeat(${layout.columns}, minmax(0, 1fr))`
						: undefined,
				gridAutoRows: `${AUTO_GRID_ROW_UNIT_PX}px`,
				justifyContent: "center",
				paddingTop: `${layout.paddingTop}px`,
				transition: `grid-template-columns ${FOCUS_TRANSITION_DURATION_MS}ms ease, grid-auto-rows ${FOCUS_TRANSITION_DURATION_MS}ms ease, padding-top ${FOCUS_TRANSITION_DURATION_MS}ms ease`,
			}}
			aria-live="polite"
		>
			{streams.map((stream, index) => {
				const chatExpanded = expandedCardChatStreamId === stream.id
				const cardHeight =
					layout.cardHeight + (chatExpanded ? INLINE_CHAT_ADDED_HEIGHT_PX : 0)
				const sharedProps = {
					stream,
					cardHeight,
					gridRowSpan: getGridRowSpan(
						cardHeight,
						AUTO_GRID_ROW_UNIT_PX,
						AUTO_WALL_GAP_PX,
					),
					videoHeight: layout.videoHeight,
					volume: streamVolumes[stream.id] ?? 100,
					forcedMuted:
						hasActiveFocus && stream.id !== primaryFocusedStreamId
							? true
							: undefined,
					playbackToken:
						hasActiveFocus && stream.id === primaryFocusedStreamId
							? focusPlaybackToken
							: 0,
					primaryFocusTransitionKey:
						hasActiveFocus && stream.id === primaryFocusedStreamId
							? primaryFocusTransitionKey
							: 0,
					onVolumeChange,
					onRemove,
					onEdit,
					onToggleChat,
					onFocus,
					focusFrame: focusFramesByStreamId[stream.id] ?? null,
					hasActiveFocus,
					onClearFocus,
					onPromoteFocusStream,
					onRemoveFocusCompanion,
					onPrimaryFocusTransitionSettled,
					onPlayerReady,
					loadSessionKey,
					chatExpanded,
					canManageStreamMembership,
					canReorderStreamMembership,
				}

				return <SortableStreamCard key={stream.id} {...sharedProps} />
			})}
		</div>
	)

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragEnd={handleDragEnd}
		>
			<SortableContext
				items={streams.map((stream) => stream.id)}
				strategy={rectSortingStrategy}
			>
				{gridMarkup}
			</SortableContext>
		</DndContext>
	)
}

function MatrixStreamGrid({
	streams,
	streamVolumes,
	containerSize,
	maxColumns = 4,
	onPlayerReady,
	loadSessionKey,
}) {
	const layout = useMemo(
		() =>
			getWallLayout({
				count: streams.length,
				containerWidth: containerSize.width,
				containerHeight: containerSize.height,
				gap: MATRIX_WALL_GAP_PX,
				chromeHeight: 0,
				maxColumns,
			}),
		[containerSize.height, containerSize.width, maxColumns, streams.length],
	)

	return (
		<div
			className="grid min-w-0 items-start"
			style={{
				gap: `${MATRIX_WALL_GAP_PX}px`,
				gridTemplateColumns:
					layout.cardWidth > 0
						? `repeat(${layout.columns}, minmax(0, 1fr))`
						: undefined,
			}}
		>
			{streams.map((stream) => (
				<div
					key={stream.id}
					className="relative min-w-0 overflow-hidden bg-black"
					style={{ aspectRatio: "16 / 9" }}
				>
					<StreamPlayer
						stream={stream}
						volume={streamVolumes[stream.id] ?? 100}
						onReady={onPlayerReady}
						loadSessionKey={loadSessionKey}
					/>
				</div>
			))}
		</div>
	)
}

export default function StreamGrid({
	streams,
	layoutMode = "auto",
	maxColumns = 4,
	onVolumeChange,
	onRemove,
	onEdit,
	onReorder,
	expandedCardChatStreamId = null,
	focusState,
	onToggleChat,
	onEnterFocus,
	onAddFocusCompanion,
	onRemoveFocusCompanion,
	onPromoteFocusStream,
	onSetFocusLayout,
	onToggleFocusChat,
	onSetFocusChatStream,
	onClearFocus,
	canManageStreamMembership = true,
	canReorderStreamMembership = true,
}) {
	const containerRef = useRef(null)
	const [containerSize, setContainerSize] = useState({
		width: 0,
		height: 0,
		viewportWidth: typeof window === "undefined" ? 1440 : window.innerWidth,
		viewportHeight: typeof window === "undefined" ? 900 : window.innerHeight,
	})
	const streamVolumes = useWallStore(useShallow((state) => state.streamVolumes))
	const focusedStreamIds = focusState?.focusedStreamIds ?? []
	const focusLayout = focusState?.focusLayout ?? "hero"
	const focusChatOpen = focusState?.focusChatOpen ?? false
	const focusChatStreamId = focusState?.focusChatStreamId ?? null
	const [focusPlaybackToken, setFocusPlaybackToken] = useState(0)
	const [primaryFocusTransitionKey, setPrimaryFocusTransitionKey] = useState(0)
	const [showWallLoader, setShowWallLoader] = useState(streams.length > 0)
	const [pendingStreamIds, setPendingStreamIds] = useState(
		() => new Set(streams.map((stream) => stream.id)),
	)
	const primaryFocusedStreamId = focusedStreamIds[0] ?? null
	const primaryFocusedStreamIdRef = useRef(primaryFocusedStreamId)
	const primaryFocusTransitionKeyRef = useRef(primaryFocusTransitionKey)
	const activeLoadSessionKeyRef = useRef("")
	primaryFocusedStreamIdRef.current = primaryFocusedStreamId
	primaryFocusTransitionKeyRef.current = primaryFocusTransitionKey
	const loadSessionKey = useMemo(
		() =>
			streams
				.map(
					(stream) =>
						`${stream.id}:${stream.platform}:${stream.channelName}`,
				)
				.sort()
				.join("|"),
		[streams],
	)
	activeLoadSessionKeyRef.current = loadSessionKey

	useEffect(() => {
		const node = containerRef.current
		if (!node) {
			return undefined
		}

		const updateSize = () => {
			const rect = node.getBoundingClientRect()
			setContainerSize({
				width: Math.floor(rect.width),
				height: Math.max(360, Math.floor(window.innerHeight - rect.top - 24)),
				viewportWidth: window.innerWidth,
				viewportHeight: window.innerHeight,
			})
		}

		updateSize()

		const resizeObserver =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(() => updateSize())
		resizeObserver?.observe(node)
		window.addEventListener("resize", updateSize)

		return () => {
			resizeObserver?.disconnect()
			window.removeEventListener("resize", updateSize)
		}
	}, [])

	useEffect(() => {
		if (!primaryFocusedStreamId) {
			return
		}

		setFocusPlaybackToken((token) => token + 1)
		setPrimaryFocusTransitionKey((key) => key + 1)
	}, [primaryFocusedStreamId])

	const handlePrimaryFocusTransitionSettled = useCallback(
		(streamId, settledTransitionKey) => {
			if (
				primaryFocusedStreamIdRef.current !== streamId ||
				primaryFocusTransitionKeyRef.current !== settledTransitionKey
			) {
				return
			}

			setFocusPlaybackToken((token) =>
				primaryFocusedStreamIdRef.current === streamId &&
				primaryFocusTransitionKeyRef.current === settledTransitionKey
					? token + 1
					: token,
			)
		},
		[],
	)

	useEffect(() => {
		if (streams.length === 0) {
			setPendingStreamIds(new Set())
			setShowWallLoader(false)
			return undefined
		}

		setPendingStreamIds(new Set(streams.map((stream) => stream.id)))
		setShowWallLoader(true)

		const timeoutId = window.setTimeout(() => {
			if (activeLoadSessionKeyRef.current === loadSessionKey) {
				setShowWallLoader(false)
			}
		}, WALL_LOADER_TIMEOUT_MS)

		return () => {
			window.clearTimeout(timeoutId)
		}
	}, [loadSessionKey])

	useEffect(() => {
		if (pendingStreamIds.size === 0) {
			setShowWallLoader(false)
		}
	}, [pendingStreamIds])

	const handlePlayerReady = useCallback((streamId, readyLoadSessionKey) => {
		if (readyLoadSessionKey !== activeLoadSessionKeyRef.current) {
			return
		}

		setPendingStreamIds((current) => {
			if (!current.has(streamId)) {
				return current
			}

			const next = new Set(current)
			next.delete(streamId)
			return next
		})
	}, [])

	const isMatrixMode = layoutMode === "matrix"
	const hasActiveFocus = focusedStreamIds.length > 0
	const hasMultiFocusExperience =
		containerSize.viewportWidth >= FOCUS_WIDE_MIN_WIDTH_PX &&
		containerSize.viewportHeight >= FOCUS_WIDE_MIN_HEIGHT_PX
	const visibleFocusedStreamIds = hasMultiFocusExperience
		? focusedStreamIds
		: focusedStreamIds.slice(0, 1)
	const hiddenCompanionCount = Math.max(
		0,
		focusedStreamIds.length - visibleFocusedStreamIds.length,
	)
	const focusedStreamIdSet = useMemo(
		() => new Set(focusedStreamIds),
		[focusedStreamIds],
	)
	const availableCompanionStreams = useMemo(
		() =>
			hasMultiFocusExperience
				? streams.filter((stream) => !focusedStreamIdSet.has(stream.id))
				: [],
		[focusedStreamIdSet, hasMultiFocusExperience, streams],
	)
	const focusSlotCount =
		visibleFocusedStreamIds.length === 0
			? 0
			: hasMultiFocusExperience
				? Math.min(
						FOCUS_MAX_STREAMS,
						visibleFocusedStreamIds.length + availableCompanionStreams.length,
					)
				: 1
	const focusSlotStyles = useMemo(
		() =>
			buildFocusSlotStyles({
				focusLayout,
				slotCount: focusSlotCount,
				viewportWidth: containerSize.viewportWidth,
				viewportHeight: containerSize.viewportHeight,
			}),
		[
			containerSize.viewportHeight,
			containerSize.viewportWidth,
			focusLayout,
			focusSlotCount,
		],
	)
	const focusFramesByStreamId = useMemo(
		() =>
			Object.fromEntries(
				visibleFocusedStreamIds.map((streamId, index) => [
					streamId,
					{
						...focusSlotStyles[index],
						role: index === 0 ? "primary" : "companion",
					},
				]),
			),
		[focusSlotStyles, visibleFocusedStreamIds],
	)
	const emptySlotStyles = useMemo(
		() => focusSlotStyles.slice(visibleFocusedStreamIds.length),
		[focusSlotStyles, visibleFocusedStreamIds.length],
	)
	const focusedTwitchStreams = useMemo(
		() =>
			streams.filter(
				(stream) =>
					focusedStreamIdSet.has(stream.id) && stream.platform === "twitch",
			),
		[focusedStreamIdSet, streams],
	)

	return (
		<section
			ref={containerRef}
			className={
				isMatrixMode
					? "relative h-full min-h-0 min-w-0 w-full flex-1 overflow-y-auto bg-black"
					: "relative min-h-[calc(100vh-13rem)] min-w-0 w-full flex-1 transition-opacity duration-300"
			}
		>
			{hasActiveFocus && !isMatrixMode && (
				<FocusOverlayChrome
					hasMultiFocusExperience={hasMultiFocusExperience}
					hiddenCompanionCount={hiddenCompanionCount}
					focusLayout={focusLayout}
					focusChatOpen={focusChatOpen}
					focusChatStreamId={focusChatStreamId}
					focusedTwitchStreams={focusedTwitchStreams}
					emptySlotStyles={emptySlotStyles}
					availableCompanionStreams={availableCompanionStreams}
					viewportWidth={containerSize.viewportWidth}
					viewportHeight={containerSize.viewportHeight}
					onAddFocusCompanion={onAddFocusCompanion}
					onSetFocusLayout={onSetFocusLayout}
					onToggleFocusChat={onToggleFocusChat}
					onSetFocusChatStream={onSetFocusChatStream}
					onClearFocus={onClearFocus}
				/>
			)}

			{isMatrixMode ? (
				<MatrixStreamGrid
					streams={streams}
					streamVolumes={streamVolumes}
					containerSize={containerSize}
					maxColumns={maxColumns}
					onPlayerReady={handlePlayerReady}
					loadSessionKey={loadSessionKey}
				/>
			) : (
				<AutoStreamGrid
					streams={streams}
					streamVolumes={streamVolumes}
					containerSize={containerSize}
					maxColumns={maxColumns}
					expandedCardChatStreamId={expandedCardChatStreamId}
					primaryFocusedStreamId={primaryFocusedStreamId}
					focusPlaybackToken={focusPlaybackToken}
					primaryFocusTransitionKey={primaryFocusTransitionKey}
					onVolumeChange={onVolumeChange}
					onRemove={onRemove}
					onEdit={onEdit}
					onReorder={onReorder}
					onToggleChat={onToggleChat}
					onFocus={onEnterFocus}
					focusFramesByStreamId={focusFramesByStreamId}
					hasActiveFocus={hasActiveFocus}
					onClearFocus={onClearFocus}
					onPromoteFocusStream={onPromoteFocusStream}
					onRemoveFocusCompanion={onRemoveFocusCompanion}
					onPrimaryFocusTransitionSettled={handlePrimaryFocusTransitionSettled}
					onPlayerReady={handlePlayerReady}
					loadSessionKey={loadSessionKey}
					canManageStreamMembership={canManageStreamMembership}
					canReorderStreamMembership={canReorderStreamMembership}
				/>
			)}

			{showWallLoader && pendingStreamIds.size > 0 && (
				<WallLoaderOverlay loadingCount={pendingStreamIds.size} />
			)}
		</section>
	)
}
