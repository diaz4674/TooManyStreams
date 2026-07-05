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
import { buildDuoFocusLayout, getFocusCanvas } from "../focusLayouts"
import { getWallLayout, isStreamChatCapable } from "../utils"
import { getActiveStreamCrop } from "../streamViews"
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
const FOCUS_MAX_STREAMS = 8
const FOCUS_OVERLAY_GAP_PX = 16
const FOCUS_STACKED_MIN_COMPANION_HEIGHT_PX = 148
const FOCUS_STACKED_MAX_RAIL_SLOTS = 4
const FOCUS_TRANSITION_DURATION_MS = 320
const FOCUS_OPACITY_TRANSITION_DURATION_MS = 220
const FOCUS_CHAT_DRAWER_GAP_PX = 24
const FOCUS_CHAT_DRAWER_WIDTH_PX = 384
const FOCUS_CHAT_DRAWER_MAX_HEIGHT_PX = 832
const FOCUS_CHAT_DRAWER_MIN_WIDTH_PX = 280
const FOCUS_CHAT_DRAWER_MIN_HEIGHT_PX = 240
const FOCUS_CHAT_RESIZE_HIT_SIZE_PX = 12
const PREVIEW_CHAT_PANEL_WIDTH_PX = 360
const PREVIEW_CHAT_PANEL_GAP_PX = 20
const PREVIEW_CHAT_MIN_VIEWPORT_WIDTH_PX = 1080
const PREVIEW_CHAT_MIN_CONTENT_WIDTH_PX = 480
const FOCUS_ADD_MENU_GAP_PX = 12
const FOCUS_ADD_MENU_MAX_WIDTH_PX = 420
const FOCUS_ADD_MENU_MIN_WIDTH_PX = 280
const FOCUS_ADD_MENU_MAX_HEIGHT_PX = 360
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
		<div className="absolute inset-0 z-[85] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(8,15,35,0.9))] px-4 pb-4 backdrop-blur-sm pointer-events-none">
			<div className="sticky top-6 flex justify-center pt-8 sm:top-8 sm:pt-10 lg:top-10 lg:pt-12">
				<div className="wall-loader-shell w-full max-w-[32rem] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/36 p-4 pt-3 shadow-[0_30px_90px_rgba(2,6,23,0.58)]">
					<div className="wall-loader-stage">
						<img
							src={loaderSrc}
							alt="Coots loading the wall"
							className="wall-loader-image block h-auto w-full"
						/>
					</div>
					<p className="mt-3 mb-0 text-center text-[0.72rem] font-bold uppercase tracking-[0.2em] text-cyan-100/76">
						Loading {loadingCount} stream{loadingCount === 1 ? "" : "s"}
					</p>
				</div>
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
		focusTilePlacement: focusFrame.placement ?? "main",
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

function getStackedRightRailCapacity({ viewportWidth, viewportHeight }) {
	const canvas = getFocusCanvas(viewportWidth, viewportHeight)
	const maxRailSlotsByHeight = Math.max(
		1,
		Math.floor(
			(canvas.height + FOCUS_OVERLAY_GAP_PX) /
				(FOCUS_STACKED_MIN_COMPANION_HEIGHT_PX + FOCUS_OVERLAY_GAP_PX),
		),
	)

	return clamp(maxRailSlotsByHeight, 1, FOCUS_STACKED_MAX_RAIL_SLOTS)
}

function getStackedBottomCapacity({ viewportWidth, viewportHeight }) {
	const canvas = getFocusCanvas(viewportWidth, viewportHeight)
	const railWidth = clamp(canvas.width * 0.26, 220, 320)
	const primaryWidth = Math.max(
		320,
		canvas.width - railWidth - FOCUS_OVERLAY_GAP_PX,
	)
	const minBottomWidth = FOCUS_STACKED_MIN_COMPANION_HEIGHT_PX * (16 / 9)

	return clamp(
		Math.floor(
			(primaryWidth + FOCUS_OVERLAY_GAP_PX) /
				(minBottomWidth + FOCUS_OVERLAY_GAP_PX),
		),
		1,
		FOCUS_MAX_STREAMS - 1,
	)
}

function buildHeroFocusSlotStyles({
	slotCount,
	viewportWidth,
	viewportHeight,
}) {
	const canvas = getFocusCanvas(viewportWidth, viewportHeight)
	const { left, top, width, height } = canvas

	if (slotCount === 1) {
		return [{ left, top, width, height }]
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

	if (slotCount === 3) {
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

	const bottomCount = slotCount - 3
	const bottomHeight = clamp(height * 0.24, 148, 210)
	const topHeight = height - bottomHeight - FOCUS_OVERLAY_GAP_PX
	const companionWidth = width - primaryWidth - FOCUS_OVERLAY_GAP_PX
	const companionHeight = (topHeight - FOCUS_OVERLAY_GAP_PX) / 2
	const bottomWidth =
		bottomCount === 1
			? width
			: (width - FOCUS_OVERLAY_GAP_PX * (bottomCount - 1)) / bottomCount

	return [
		{
			left,
			top,
			width: primaryWidth,
			height: topHeight,
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
		...Array.from({ length: bottomCount }, (_, index) => ({
			left: left + index * (bottomWidth + FOCUS_OVERLAY_GAP_PX),
			top: top + topHeight + FOCUS_OVERLAY_GAP_PX,
			width: bottomWidth,
			height: bottomHeight,
		})),
	]
}

function buildStackedFocusSlotStyles({
	slotCount,
	viewportWidth,
	viewportHeight,
}) {
	const canvas = getFocusCanvas(viewportWidth, viewportHeight)
	const { left, top, width, height } = canvas

	if (slotCount === 1) {
		return [{ left, top, width, height }]
	}

	const railWidth = clamp(width * 0.26, 220, 320)
	const primaryWidth = Math.max(320, width - railWidth - FOCUS_OVERLAY_GAP_PX)
	const rightRailMaxSlots = getStackedRightRailCapacity({
		viewportWidth,
		viewportHeight,
	})
	const rightRailCount = Math.min(rightRailMaxSlots, slotCount - 1)
	const bottomCount = Math.max(0, slotCount - 1 - rightRailCount)
	const idealBottomHeight = bottomCount > 0 ? clamp(height * 0.23, 142, 188) : 0
	const maxBottomWidth =
		bottomCount <= 1
			? primaryWidth
			: (primaryWidth - FOCUS_OVERLAY_GAP_PX * (bottomCount - 1)) / bottomCount
	const bottomWidth =
		bottomCount > 0 ? Math.min(maxBottomWidth, idealBottomHeight * (16 / 9)) : 0
	const bottomHeight = bottomWidth > 0 ? bottomWidth * (9 / 16) : 0
	const topHeight =
		bottomCount > 0 ? height - bottomHeight - FOCUS_OVERLAY_GAP_PX : height
	const companionLeft = left + primaryWidth + FOCUS_OVERLAY_GAP_PX
	const companionWidth = width - primaryWidth - FOCUS_OVERLAY_GAP_PX
	const railSlotHeight =
		rightRailCount > 1
			? (topHeight - FOCUS_OVERLAY_GAP_PX * (rightRailCount - 1)) /
				rightRailCount
			: topHeight
	const idealCompanionHeight = companionWidth * (9 / 16)
	const companionHeight = Math.min(railSlotHeight, idealCompanionHeight)
	const railContentHeight =
		rightRailCount > 0
			? rightRailCount * companionHeight +
				FOCUS_OVERLAY_GAP_PX * Math.max(0, rightRailCount - 1)
			: 0
	const railTop = top + Math.max(0, (topHeight - railContentHeight) / 2)
	const bottomRowWidth =
		bottomCount > 0
			? bottomCount * bottomWidth +
				FOCUS_OVERLAY_GAP_PX * Math.max(0, bottomCount - 1)
			: 0
	const bottomLeft =
		bottomCount > 0 ? left + (primaryWidth - bottomRowWidth) / 2 : left

	return [
		{
			left,
			top,
			width: primaryWidth,
			height: topHeight,
		},
		...Array.from({ length: rightRailCount }, (_, index) => ({
			left: companionLeft,
			top: railTop + index * (companionHeight + FOCUS_OVERLAY_GAP_PX),
			width: companionWidth,
			height: companionHeight,
		})),
		...Array.from({ length: bottomCount }, (_, index) => ({
			left: bottomLeft + index * (bottomWidth + FOCUS_OVERLAY_GAP_PX),
			top: top + topHeight + FOCUS_OVERLAY_GAP_PX,
			width: bottomWidth,
			height: bottomHeight,
		})),
	]
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

	if (focusLayout === "stacked") {
		return buildStackedFocusSlotStyles({
			slotCount,
			viewportWidth,
			viewportHeight,
		})
	}

	return buildHeroFocusSlotStyles({
		slotCount,
		viewportWidth,
		viewportHeight,
	})
}

function buildSingleFocusLayout({ viewportWidth, viewportHeight }) {
	const baseFrame =
		buildHeroFocusSlotStyles({
			slotCount: 1,
			viewportWidth,
			viewportHeight,
		})[0] ?? null

	if (!baseFrame) {
		return null
	}

	const shouldShowChatRail =
		viewportWidth >= PREVIEW_CHAT_MIN_VIEWPORT_WIDTH_PX &&
		baseFrame.width - PREVIEW_CHAT_PANEL_WIDTH_PX - PREVIEW_CHAT_PANEL_GAP_PX >=
			PREVIEW_CHAT_MIN_CONTENT_WIDTH_PX

	if (!shouldShowChatRail) {
		return {
			videoFrame: baseFrame,
			chatFrame: null,
		}
	}

	const chatWidth = Math.min(
		PREVIEW_CHAT_PANEL_WIDTH_PX,
		Math.max(FOCUS_CHAT_DRAWER_MIN_WIDTH_PX, baseFrame.width * 0.32),
	)
	const videoWidth = baseFrame.width - chatWidth - PREVIEW_CHAT_PANEL_GAP_PX

	return {
		videoFrame: {
			...baseFrame,
			width: videoWidth,
		},
		chatFrame: {
			left: baseFrame.left + videoWidth + PREVIEW_CHAT_PANEL_GAP_PX,
			top: baseFrame.top,
			width: chatWidth,
			height: baseFrame.height,
		},
	}
}

function getStackedFocusSlotCount({
	focusedCount,
	availableCount,
	overflowEnabled = false,
	rightRailMaxSlots,
	bottomMaxSlots = FOCUS_MAX_STREAMS - 1,
}) {
	if (focusedCount <= 0) {
		return 0
	}

	const companionCount = Math.max(0, focusedCount - 1)
	const rightCompanionCount = Math.min(rightRailMaxSlots, companionCount)
	const bottomCompanionCount = Math.max(0, companionCount - rightCompanionCount)
	const rightOpenSlotCount =
		companionCount < rightRailMaxSlots
			? Math.min(rightRailMaxSlots - companionCount, availableCount)
			: 0
	const remainingAvailableCount = Math.max(
		0,
		availableCount - rightOpenSlotCount,
	)
	const bottomOpenSlotCount =
		companionCount >= rightRailMaxSlots &&
		focusedCount < FOCUS_MAX_STREAMS &&
		bottomCompanionCount < bottomMaxSlots &&
		(bottomCompanionCount > 0 || overflowEnabled) &&
		remainingAvailableCount > 0
			? 1
			: 0

	return (
		1 +
		rightCompanionCount +
		bottomCompanionCount +
		rightOpenSlotCount +
		bottomOpenSlotCount
	)
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

function FocusAddSlot({ style, availableStreams, onAddCompanion, onDismiss }) {
	const [menuOpen, setMenuOpen] = useState(false)
	const slotRef = useRef(null)
	const menuRef = useRef(null)
	const buttonRef = useRef(null)
	const [menuStyle, setMenuStyle] = useState(null)

	const updateMenuPosition = useCallback(() => {
		const buttonNode = buttonRef.current
		if (!buttonNode) {
			return
		}

		const rect = buttonNode.getBoundingClientRect()
		const viewportPadding = 16
		const menuWidth = Math.min(
			Math.max(rect.width, FOCUS_ADD_MENU_MIN_WIDTH_PX),
			FOCUS_ADD_MENU_MAX_WIDTH_PX,
			window.innerWidth - viewportPadding * 2,
		)
		const maxHeight = Math.min(
			FOCUS_ADD_MENU_MAX_HEIGHT_PX,
			window.innerHeight - viewportPadding * 2,
		)
		const placeAbove =
			rect.bottom + FOCUS_ADD_MENU_GAP_PX + maxHeight >
				window.innerHeight - viewportPadding &&
			rect.top - FOCUS_ADD_MENU_GAP_PX - maxHeight >= viewportPadding
		const left = clamp(
			rect.left,
			viewportPadding,
			window.innerWidth - menuWidth - viewportPadding,
		)
		const top = placeAbove
			? Math.max(viewportPadding, rect.top - maxHeight - FOCUS_ADD_MENU_GAP_PX)
			: Math.min(
					rect.bottom + FOCUS_ADD_MENU_GAP_PX,
					window.innerHeight - maxHeight - viewportPadding,
				)

		setMenuStyle({
			left,
			top,
			width: menuWidth,
			maxHeight,
		})
	}, [])

	useEffect(() => {
		if (!menuOpen) {
			return undefined
		}

		const handlePointerDown = (event) => {
			if (
				slotRef.current?.contains(event.target) ||
				menuRef.current?.contains(event.target)
			) {
				return
			}

			setMenuOpen(false)
		}

		updateMenuPosition()
		document.addEventListener("pointerdown", handlePointerDown)
		window.addEventListener("resize", updateMenuPosition)
		window.addEventListener("scroll", updateMenuPosition, true)

		return () => {
			document.removeEventListener("pointerdown", handlePointerDown)
			window.removeEventListener("resize", updateMenuPosition)
			window.removeEventListener("scroll", updateMenuPosition, true)
		}
	}, [menuOpen, updateMenuPosition])

	if (!availableStreams.length) {
		return null
	}

	return (
		<>
			<div className="fixed z-[72]" style={style}>
				<div
					ref={slotRef}
					className="flex h-full min-h-0 flex-col justify-center rounded-[1.7rem] border border-dashed border-cyan-300/28 bg-slate-950/26 p-4 backdrop-blur-sm"
				>
					<div className="flex items-center justify-between gap-2">
						<div className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-cyan-100/70">
							Open Slot
						</div>
						{onDismiss && (
							<button
								type="button"
								onClick={onDismiss}
								aria-label="Dismiss open slot"
								title="Dismiss open slot"
								className="inline-flex h-7 w-7 items-center justify-center rounded-full border-0 bg-white/8 text-slate-200/80 transition-colors cursor-pointer hover:bg-white/14 hover:text-white"
							>
								<i className="fa-solid fa-xmark text-[0.72rem]" />
							</button>
						)}
					</div>
					<button
						ref={buttonRef}
						type="button"
						onClick={() => setMenuOpen((open) => !open)}
						className="mt-3 inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-cyan-400/18 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition-colors cursor-pointer hover:bg-white/12"
					>
						<i className="fa-solid fa-plus" />
						Add Companion
					</button>
				</div>
			</div>

			{menuOpen && menuStyle && (
				<div
					ref={menuRef}
					className="fixed z-[78] overflow-hidden rounded-[1.25rem] border border-cyan-400/18 bg-[linear-gradient(180deg,rgba(14,22,43,0.97),rgba(8,12,28,0.99))] shadow-[0_24px_70px_rgba(2,6,23,0.56)]"
					style={menuStyle}
				>
					<div className="flex items-center justify-between gap-3 border-b border-cyan-400/12 px-4 py-3">
						<div>
							<div className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-cyan-100/72">
								Project Streams
							</div>
							<div className="mt-1 text-sm font-semibold text-white">
								Add a companion to cinema mode
							</div>
						</div>
						<button
							type="button"
							onClick={() => setMenuOpen(false)}
							className="rounded-full border-0 bg-white/8 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white transition-colors cursor-pointer hover:bg-white/12"
						>
							Close
						</button>
					</div>

					<div
						className="overflow-y-auto p-2"
						style={{ maxHeight: menuStyle.maxHeight - 74 }}
					>
						<div className="space-y-1">
							{availableStreams.map((stream) => (
								<button
									key={stream.id}
									type="button"
									onClick={() => {
										onAddCompanion(stream.id)
										setMenuOpen(false)
									}}
									className="flex w-full items-center justify-between gap-3 rounded-xl border border-transparent bg-white/6 px-3 py-2.5 text-left text-sm text-white transition-colors cursor-pointer hover:border-cyan-400/14 hover:bg-white/10"
								>
									<span className="truncate">{stream.title}</span>
									<span className="shrink-0 text-[0.64rem] font-bold uppercase tracking-[0.14em] text-slate-300/60">
										{stream.platform}
									</span>
								</button>
							))}
						</div>
					</div>
				</div>
			)}
		</>
	)
}

function FocusOverlayChrome({
	hasMultiFocusExperience,
	hiddenCompanionCount,
	focusLayout,
	focusChatOpen,
	focusChatStreamId,
	focusedChatStreams,
	emptySlotStyles,
	availableCompanionStreams,
	viewportWidth,
	viewportHeight,
	onAddFocusCompanion,
	onSetFocusLayout,
	onToggleFocusChat,
	onSetFocusChatStream,
	onClearFocus,
	showLayoutControls = true,
	showChatControls = true,
	showEmptySlots = true,
	allowCompactEmptySlots = false,
	renderFloatingChat = true,
	badgeLabel = "Cinema Mode",
	cropAction = null,
	secondaryAction = null,
	primaryAction = null,
	onDismissOverflowSlot,
	overflowSlotDismissible = false,
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
					{badgeLabel}
				</div>

				<div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
					{showLayoutControls && (
						<div className="inline-flex items-center gap-1 rounded-full bg-slate-950/78 p-1 shadow-[0_10px_28px_rgba(2,6,23,0.34)] backdrop-blur">
							<button
								type="button"
								onClick={() => onSetFocusLayout("single")}
								className={`rounded-full px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] transition-colors cursor-pointer ${
									focusLayout === "single"
										? "bg-cyan-400/18 text-cyan-50"
										: "text-slate-200/78 hover:bg-white/8"
								}`}
							>
								Single
							</button>
							<button
								type="button"
								onClick={() => onSetFocusLayout("duo")}
								className={`rounded-full px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] transition-colors cursor-pointer ${
									focusLayout === "duo"
										? "bg-cyan-400/18 text-cyan-50"
										: "text-slate-200/78 hover:bg-white/8"
								}`}
							>
								Duo
							</button>
							<button
								type="button"
								onClick={() => onSetFocusLayout("stacked")}
								className={`rounded-full px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] transition-colors cursor-pointer ${
									focusLayout === "stacked"
										? "bg-cyan-400/18 text-cyan-50"
										: "text-slate-200/78 hover:bg-white/8"
								}`}
							>
								Stacked
							</button>
							{/* TODO: Implement Equal in phase 2 to cleanup */}
							{/* <button
								type="button"
								onClick={() => onSetFocusLayout("equal")}
								className={`rounded-full px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] transition-colors cursor-pointer ${
									focusLayout === "equal"
										? "bg-cyan-400/18 text-cyan-50"
										: "text-slate-200/78 hover:bg-white/8"
								}`}
							>
								Equal
							</button> */}
						</div>
					)}

					{showChatControls && focusedChatStreams.length > 0 && (
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

					{cropAction && (
						<button
							type="button"
							onClick={cropAction.onClick}
							title={cropAction.title}
							className="rounded-full bg-slate-950/78 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-100 shadow-[0_10px_28px_rgba(2,6,23,0.34)] backdrop-blur transition-colors cursor-pointer hover:bg-slate-900/92"
						>
							<i className="fa-solid fa-crop-simple mr-1.5 text-[0.62rem]" />
							Crop
						</button>
					)}

					{secondaryAction && (
						<button
							type="button"
							onClick={secondaryAction.onClick}
							disabled={secondaryAction.disabled}
							className={`rounded-full px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] shadow-[0_10px_28px_rgba(2,6,23,0.34)] backdrop-blur transition-colors ${
								secondaryAction.disabled
									? "cursor-not-allowed bg-white/8 text-slate-400"
									: "cursor-pointer bg-white/8 text-slate-100 hover:bg-white/12"
							}`}
						>
							{secondaryAction.label}
						</button>
					)}

					{primaryAction && (
						<button
							type="button"
							onClick={primaryAction.onClick}
							disabled={primaryAction.disabled}
							className={`rounded-full px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] shadow-[0_10px_28px_rgba(2,6,23,0.34)] backdrop-blur transition-colors ${
								primaryAction.disabled
									? "cursor-not-allowed bg-white/8 text-slate-400"
									: "cursor-pointer bg-cyan-400/18 text-cyan-50 hover:bg-cyan-400/26"
							}`}
						>
							{primaryAction.label}
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

			{showEmptySlots &&
				!hasMultiFocusExperience &&
				hiddenCompanionCount > 0 && (
					<div className="pointer-events-none fixed top-24 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-slate-950/78 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-100 shadow-[0_10px_28px_rgba(2,6,23,0.34)] backdrop-blur">
						Wider viewport restores {hiddenCompanionCount} companion
						{hiddenCompanionCount > 1 ? "s" : ""}
					</div>
				)}

			{showEmptySlots &&
				(hasMultiFocusExperience || allowCompactEmptySlots) &&
				emptySlotStyles.map((style, index) => (
					<FocusAddSlot
						key={`focus-slot-${index}`}
						style={style}
						availableStreams={availableCompanionStreams}
						onAddCompanion={onAddFocusCompanion}
						onDismiss={
							overflowSlotDismissible ? onDismissOverflowSlot : undefined
						}
					/>
				))}

			{renderFloatingChat &&
				showChatControls &&
				focusChatOpen &&
				focusedChatStreams.length > 0 && (
				<div
					className="pointer-events-none fixed z-[85]"
					style={{
						left: chatPosition.left,
						top: chatPosition.top,
						width: chatSize.width,
						height: chatSize.height,
					}}
				>
					<div className="pointer-events-auto relative flex h-full w-full flex-col overflow-hidden rounded-[1.7rem]  bg-[linear-gradient(180deg,rgba(12,18,36,0.96),rgba(8,12,28,0.98))]">
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
									{focusedChatStreams.find(
										(stream) => stream.id === focusChatStreamId,
									)?.title ?? focusedChatStreams[0]?.title}
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
								streams={focusedChatStreams}
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

function PreviewOverlayCard({
	stream,
	viewportWidth,
	viewportHeight,
	onClosePreview,
}) {
	const previewLayout = useMemo(() => {
		const baseFrame =
			buildHeroFocusSlotStyles({
				slotCount: 1,
				viewportWidth,
				viewportHeight,
			})[0] ?? null

		if (!baseFrame) {
			return null
		}

		const shouldShowChat =
			isStreamChatCapable(stream) &&
			viewportWidth >= PREVIEW_CHAT_MIN_VIEWPORT_WIDTH_PX &&
			baseFrame.width -
				PREVIEW_CHAT_PANEL_WIDTH_PX -
				PREVIEW_CHAT_PANEL_GAP_PX >=
				PREVIEW_CHAT_MIN_CONTENT_WIDTH_PX

		if (!shouldShowChat) {
			return {
				videoFrame: baseFrame,
				chatFrame: null,
			}
		}

		const chatWidth = Math.min(
			PREVIEW_CHAT_PANEL_WIDTH_PX,
			Math.max(FOCUS_CHAT_DRAWER_MIN_WIDTH_PX, baseFrame.width * 0.32),
		)
		const videoWidth = baseFrame.width - chatWidth - PREVIEW_CHAT_PANEL_GAP_PX

		return {
			videoFrame: {
				...baseFrame,
				width: videoWidth,
			},
			chatFrame: {
				left: baseFrame.left + videoWidth + PREVIEW_CHAT_PANEL_GAP_PX,
				top: baseFrame.top,
				width: chatWidth,
				height: baseFrame.height,
			},
		}
	}, [stream, viewportHeight, viewportWidth])

	if (!previewLayout) {
		return null
	}

	return (
		<>
			<div
				className="pointer-events-auto"
				style={{
					position: "fixed",
					left: previewLayout.videoFrame.left,
					top: previewLayout.videoFrame.top,
					width: previewLayout.videoFrame.width,
					height: previewLayout.videoFrame.height,
					zIndex: 70,
				}}
			>
				<StreamCard
					stream={stream}
					videoHeight={previewLayout.videoFrame.height}
					volume={100}
					onVolumeChange={() => {}}
					onRemove={() => {}}
					onEdit={() => {}}
					presentation="focus"
					focusTileRole="primary"
					onExitFocus={onClosePreview}
					loadSessionKey={stream.id}
				/>
			</div>

			{previewLayout.chatFrame && (
				<div
					className="pointer-events-auto fixed z-[72]"
					style={{
						left: previewLayout.chatFrame.left,
						top: previewLayout.chatFrame.top,
						width: previewLayout.chatFrame.width,
						height: previewLayout.chatFrame.height,
					}}
				>
					<StreamChatSidebar
						streams={[stream]}
						activeStreamId={stream.id}
						variant="overlay"
					/>
				</div>
			)}
		</>
	)
}

function SingleFocusChatRail({ stream, frame }) {
	if (!stream || !frame) {
		return null
	}

	return (
		<div
			className="pointer-events-auto fixed z-[72]"
			style={{
				left: frame.left,
				top: frame.top,
				width: frame.width,
				height: frame.height,
			}}
		>
			<StreamChatSidebar
				streams={[stream]}
				activeStreamId={stream.id}
				variant="overlay"
			/>
		</div>
	)
}

function DuoFocusChatRail({
	streams,
	activeStreamId,
	frame,
	onSelectStream,
}) {
	if (!frame || streams.length === 0) {
		return null
	}

	return (
		<div
			className="pointer-events-auto fixed z-[72]"
			style={{
				left: frame.left,
				top: frame.top,
				width: frame.width,
				height: frame.height,
			}}
		>
			<StreamChatSidebar
				streams={streams}
				activeStreamId={activeStreamId}
				onSelectStream={onSelectStream}
				variant="duoCenter"
			/>
		</div>
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
	onOpenViews,
	onSelectView,
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
				onOpenViews={onOpenViews}
				onSelectView={onSelectView}
				onPlayerReady={onPlayerReady}
				loadSessionKey={loadSessionKey}
				isFocused={isInFocusComposition}
				chatExpanded={chatExpanded}
				inlineChatHeight={INLINE_CHAT_PANEL_HEIGHT_PX}
				dragHandleAttributes={attributes}
				dragHandleListeners={listeners}
				fluidVideo={isInFocusComposition}
				preserveFullFrame={Boolean(focusFrame?.preserveFullFrame)}
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
	forceAllMuted = false,
	expandedCardChatStreamId = null,
	primaryFocusedStreamId = null,
	effectivePrimaryFocusedStreamId = null,
	focusPlaybackToken = 0,
	companionPlaybackToken = 0,
	primaryFocusTransitionKey = 0,
	onVolumeChange,
	onRemove,
	onEdit,
	onReorder,
	onToggleChat,
	onFocus,
	onOpenViews,
	onSelectView,
	focusFramesByStreamId = {},
	visibleFocusFramesByStreamId = {},
	hasActiveFocus = false,
	hasOverlayPresentation = false,
	hasPreviewOverlay = false,
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
				const streamFocusFrame = visibleFocusFramesByStreamId[stream.id] ?? null
				const isFocusCompanion =
					hasActiveFocus &&
					!hasPreviewOverlay &&
					streamFocusFrame?.role === "companion"
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
					// Silence the background wall behind an overlay (and every
					// non-preview tile during a discovery preview). Cinema
					// companions are exempt: they expose their own volume slider,
					// so hard-muting them would make that control do nothing.
					// forceAllMuted silences the whole wall (mobile feed behind
					// the floating mini player).
					forcedMuted:
						forceAllMuted ||
						(hasOverlayPresentation &&
							stream.id !== effectivePrimaryFocusedStreamId &&
							!isFocusCompanion)
							? true
							: undefined,
					playbackToken:
						hasActiveFocus &&
						!hasPreviewOverlay &&
						stream.id === primaryFocusedStreamId
							? focusPlaybackToken
							: isFocusCompanion
								? companionPlaybackToken
								: 0,
					primaryFocusTransitionKey:
						hasActiveFocus &&
						!hasPreviewOverlay &&
						stream.id === primaryFocusedStreamId
							? primaryFocusTransitionKey
							: 0,
					onVolumeChange,
					onRemove,
					onEdit,
					onToggleChat,
					onFocus,
					onOpenViews,
					onSelectView,
					focusFrame: streamFocusFrame,
					hasActiveFocus: hasOverlayPresentation,
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
						crop={getActiveStreamCrop(stream)}
						showTwitchControls
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
	forceAllMuted = false,
	previewStream = null,
	previewStreamAlreadyAdded = false,
	onAddPreviewStream,
	onClosePreview,
	onVolumeChange,
	onRemove,
	onEdit,
	onReorder,
	onOpenViews,
	onSelectView,
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
	const focusLayout = focusState?.focusLayout ?? "single"
	const focusChatOpen = focusState?.focusChatOpen ?? false
	const focusChatStreamId = focusState?.focusChatStreamId ?? null
	const [focusPlaybackToken, setFocusPlaybackToken] = useState(0)
	const [companionPlaybackToken, setCompanionPlaybackToken] = useState(0)
	const [primaryFocusTransitionKey, setPrimaryFocusTransitionKey] = useState(0)
	const [showWallLoader, setShowWallLoader] = useState(streams.length > 0)
	const [pendingStreamIds, setPendingStreamIds] = useState(
		() => new Set(streams.map((stream) => stream.id)),
	)
	const [stackedOverflowEnabled, setStackedOverflowEnabled] = useState(false)
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
					(stream) => `${stream.id}:${stream.platform}:${stream.channelName}`,
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

	// Nudge companion tiles to (muted) autoplay whenever the focused set changes.
	// A newly added companion reuses its grid player instance, which may be
	// paused, so without this nudge it stays frozen on its last frame.
	const focusedStreamIdsSignature = focusedStreamIds.join("|")
	useEffect(() => {
		if (focusedStreamIds.length <= 1) {
			return
		}

		setCompanionPlaybackToken((token) => token + 1)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [focusedStreamIdsSignature])

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

	useEffect(() => {
		if (focusedStreamIds.length === 0) {
			setStackedOverflowEnabled(false)
		}
	}, [focusedStreamIds.length])

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
	const hasPreviewOverlay = Boolean(previewStream)
	const hasOverlayPresentation = hasActiveFocus || hasPreviewOverlay
	const isSingleFocusLayout = focusLayout === "single"
	const isDuoFocusLayout = focusLayout === "duo"
	const isStackedFocusLayout = focusLayout === "stacked"
	const hasMultiFocusExperience =
		containerSize.viewportWidth >= FOCUS_WIDE_MIN_WIDTH_PX &&
		containerSize.viewportHeight >= FOCUS_WIDE_MIN_HEIGHT_PX
	const singleFocusLayout = useMemo(
		() =>
			isSingleFocusLayout && hasActiveFocus
				? buildSingleFocusLayout({
						viewportWidth: containerSize.viewportWidth,
						viewportHeight: containerSize.viewportHeight,
					})
				: null,
		[
			containerSize.viewportHeight,
			containerSize.viewportWidth,
			hasActiveFocus,
			isSingleFocusLayout,
		],
	)
	const duoFocusLayout = useMemo(
		() =>
			isDuoFocusLayout && hasActiveFocus
				? buildDuoFocusLayout({
						viewportWidth: containerSize.viewportWidth,
						viewportHeight: containerSize.viewportHeight,
						showChatRail:
							focusChatOpen &&
							focusedStreamIds.length > 0 &&
							streams.some(
								(stream) =>
									focusedStreamIds.includes(stream.id) &&
									isStreamChatCapable(stream),
							),
					})
				: null,
		[
			containerSize.viewportHeight,
			containerSize.viewportWidth,
			focusChatOpen,
			focusedStreamIds,
			hasActiveFocus,
			isDuoFocusLayout,
			streams,
		],
	)
	const hasSingleFocusRail = Boolean(singleFocusLayout?.chatFrame)
	const hasDuoChatRail = Boolean(duoFocusLayout?.chatFrame)
	const visibleFocusedStreamIds =
		isDuoFocusLayout
			? focusedStreamIds.slice(0, 2)
			: hasMultiFocusExperience && !isSingleFocusLayout
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
	const primaryFocusedStream = useMemo(
		() =>
			streams.find((stream) => stream.id === primaryFocusedStreamId) ?? null,
		[primaryFocusedStreamId, streams],
	)
	const availableCompanionStreams = useMemo(
		() =>
			isDuoFocusLayout
				? streams.filter((stream) => !focusedStreamIdSet.has(stream.id))
				: hasMultiFocusExperience && !isSingleFocusLayout
				? streams.filter((stream) => !focusedStreamIdSet.has(stream.id))
				: [],
		[
			focusedStreamIdSet,
			hasMultiFocusExperience,
			isDuoFocusLayout,
			isSingleFocusLayout,
			streams,
		],
	)
	const stackedRightRailMaxSlots = useMemo(
		() =>
			getStackedRightRailCapacity({
				viewportWidth: containerSize.viewportWidth,
				viewportHeight: containerSize.viewportHeight,
			}),
		[containerSize.viewportHeight, containerSize.viewportWidth],
	)
	const stackedBottomMaxSlots = useMemo(
		() =>
			getStackedBottomCapacity({
				viewportWidth: containerSize.viewportWidth,
				viewportHeight: containerSize.viewportHeight,
			}),
		[containerSize.viewportHeight, containerSize.viewportWidth],
	)
	const stackedFocusedCompanionCount = Math.max(
		0,
		visibleFocusedStreamIds.length - 1,
	)
	const stackedBottomCompanionCount = Math.max(
		0,
		stackedFocusedCompanionCount - stackedRightRailMaxSlots,
	)
	// Once the bottom row empties (last bottom companion removed), collapse the
	// revealed open slot so the placeholder disappears instead of lingering.
	const previousBottomCompanionCountRef = useRef(stackedBottomCompanionCount)
	useEffect(() => {
		if (
			previousBottomCompanionCountRef.current > 0 &&
			stackedBottomCompanionCount === 0
		) {
			setStackedOverflowEnabled(false)
		}
		previousBottomCompanionCountRef.current = stackedBottomCompanionCount
	}, [stackedBottomCompanionCount])
	const canRevealStackedOverflow =
		hasMultiFocusExperience &&
		isStackedFocusLayout &&
		stackedFocusedCompanionCount >= stackedRightRailMaxSlots &&
		stackedBottomCompanionCount === 0 &&
		availableCompanionStreams.length > 0 &&
		visibleFocusedStreamIds.length < FOCUS_MAX_STREAMS &&
		!stackedOverflowEnabled
	const canDismissStackedOverflow =
		isStackedFocusLayout &&
		stackedOverflowEnabled &&
		stackedBottomCompanionCount === 0
	const stackedFocusSlotCount = useMemo(
		() =>
			getStackedFocusSlotCount({
				focusedCount: visibleFocusedStreamIds.length,
				availableCount: availableCompanionStreams.length,
				overflowEnabled: stackedOverflowEnabled,
				rightRailMaxSlots: stackedRightRailMaxSlots,
				bottomMaxSlots: stackedBottomMaxSlots,
			}),
		[
			availableCompanionStreams.length,
			stackedBottomMaxSlots,
			stackedRightRailMaxSlots,
			stackedOverflowEnabled,
			visibleFocusedStreamIds.length,
		],
	)
	const focusSlotCount =
		visibleFocusedStreamIds.length === 0
			? 0
			: isDuoFocusLayout
				? 2
				: isSingleFocusLayout
				? 1
				: isStackedFocusLayout
					? stackedFocusSlotCount
					: hasMultiFocusExperience
						? Math.min(
								FOCUS_MAX_STREAMS,
								visibleFocusedStreamIds.length +
									availableCompanionStreams.length,
							)
						: 1
	const focusSlotStyles = useMemo(() => {
		if (focusSlotCount === 0) {
			return []
		}

		if (isSingleFocusLayout) {
			return singleFocusLayout?.videoFrame ? [singleFocusLayout.videoFrame] : []
		}

		if (isDuoFocusLayout) {
			return duoFocusLayout?.slotFrames ?? []
		}

		return buildFocusSlotStyles({
			focusLayout,
			slotCount: focusSlotCount,
			viewportWidth: containerSize.viewportWidth,
			viewportHeight: containerSize.viewportHeight,
		})
	}, [
		containerSize.viewportHeight,
		containerSize.viewportWidth,
		focusLayout,
		focusSlotCount,
		duoFocusLayout,
		isDuoFocusLayout,
		isSingleFocusLayout,
		isStackedFocusLayout,
		singleFocusLayout,
	])
	const focusFramesByStreamId = useMemo(
		() =>
			Object.fromEntries(
				visibleFocusedStreamIds
					.filter((_, index) => Boolean(focusSlotStyles[index]))
					.map((streamId, index) => [
						streamId,
						{
							...focusSlotStyles[index],
							role: index === 0 ? "primary" : "companion",
							placement:
								isDuoFocusLayout
									? index === 0
										? "left"
										: "right"
									: index === 0
									? "primary"
									: isStackedFocusLayout && index > stackedRightRailMaxSlots
										? "bottom"
										: "rail",
							preserveFullFrame: isDuoFocusLayout,
						},
					]),
			),
		[
			focusSlotStyles,
			isDuoFocusLayout,
			isStackedFocusLayout,
			stackedRightRailMaxSlots,
			visibleFocusedStreamIds,
		],
	)
	const emptySlotStyles = useMemo(
		() =>
			isSingleFocusLayout
				? []
				: focusSlotStyles.slice(visibleFocusedStreamIds.length),
		[focusSlotStyles, isSingleFocusLayout, visibleFocusedStreamIds.length],
	)
	const focusedChatStreamIds = isSingleFocusLayout
		? visibleFocusedStreamIds.slice(0, 1)
		: focusedStreamIds
	const focusedChatStreamIdSet = useMemo(
		() => new Set(focusedChatStreamIds),
		[focusedChatStreamIds],
	)
	const focusedChatStreams = useMemo(
		() =>
			streams.filter(
				(stream) =>
					focusedChatStreamIdSet.has(stream.id) && isStreamChatCapable(stream),
			),
		[focusedChatStreamIdSet, streams],
	)
	const effectiveFocusChatStreamId = isSingleFocusLayout
		? primaryFocusedStreamId
		: focusChatStreamId
	const visibleFocusFramesByStreamId = hasPreviewOverlay
		? {}
		: focusFramesByStreamId
	const effectivePrimaryFocusedStreamId = hasPreviewOverlay
		? null
		: primaryFocusedStreamId

	return (
		<section
			ref={containerRef}
			className={
				isMatrixMode
					? "relative h-full min-h-0 min-w-0 w-full flex-1 overflow-y-auto bg-black"
					: "relative min-h-[calc(100vh-13rem)] min-w-0 w-full flex-1 transition-opacity duration-300"
			}
		>
			{!isMatrixMode && hasPreviewOverlay && (
				<>
					<FocusOverlayChrome
						hasMultiFocusExperience={false}
						hiddenCompanionCount={0}
						focusLayout="stacked"
						focusChatOpen={false}
						focusChatStreamId={null}
						focusedChatStreams={[]}
						emptySlotStyles={[]}
						availableCompanionStreams={[]}
						viewportWidth={containerSize.viewportWidth}
						viewportHeight={containerSize.viewportHeight}
						onAddFocusCompanion={() => {}}
						onSetFocusLayout={() => {}}
						onToggleFocusChat={() => {}}
						onSetFocusChatStream={() => {}}
						onClearFocus={onClosePreview}
						showLayoutControls={false}
						showChatControls={false}
						showEmptySlots={false}
						primaryAction={{
							label: previewStreamAlreadyAdded ? "Added" : "Add",
							onClick: () => onAddPreviewStream?.(),
							disabled:
								previewStreamAlreadyAdded ||
								typeof onAddPreviewStream !== "function",
						}}
					/>
					<PreviewOverlayCard
						stream={previewStream}
						viewportWidth={containerSize.viewportWidth}
						viewportHeight={containerSize.viewportHeight}
						onClosePreview={onClosePreview}
					/>
				</>
			)}

			{!isMatrixMode && !hasPreviewOverlay && hasActiveFocus && (
				<>
					<FocusOverlayChrome
						hasMultiFocusExperience={hasMultiFocusExperience}
						hiddenCompanionCount={hiddenCompanionCount}
						focusLayout={focusLayout}
						focusChatOpen={focusChatOpen}
						focusChatStreamId={effectiveFocusChatStreamId}
						focusedChatStreams={focusedChatStreams}
						emptySlotStyles={emptySlotStyles}
						availableCompanionStreams={availableCompanionStreams}
						viewportWidth={containerSize.viewportWidth}
						viewportHeight={containerSize.viewportHeight}
						onAddFocusCompanion={onAddFocusCompanion}
						onSetFocusLayout={onSetFocusLayout}
						onToggleFocusChat={onToggleFocusChat}
						onSetFocusChatStream={onSetFocusChatStream}
						onClearFocus={onClearFocus}
						showChatControls={!hasSingleFocusRail}
						showEmptySlots={!isSingleFocusLayout}
						allowCompactEmptySlots={isDuoFocusLayout}
						renderFloatingChat={!hasDuoChatRail}
						cropAction={
							// Native-controls Twitch primaries render no app overlay
							// (anything over the iframe makes Twitch pause playback),
							// so their crop affordance lives up here instead.
							primaryFocusedStream?.platform === "twitch" &&
							typeof onOpenViews === "function"
								? {
										title: `Crop ${primaryFocusedStream.title}`,
										onClick: () => onOpenViews(primaryFocusedStream.id),
									}
								: null
						}
						secondaryAction={
							canRevealStackedOverflow
								? {
										label: "Add More",
										onClick: () => setStackedOverflowEnabled(true),
										disabled: false,
									}
								: null
						}
						overflowSlotDismissible={canDismissStackedOverflow}
						onDismissOverflowSlot={() => setStackedOverflowEnabled(false)}
					/>
					{hasSingleFocusRail && (
						<SingleFocusChatRail
							stream={primaryFocusedStream}
							frame={singleFocusLayout?.chatFrame ?? null}
						/>
					)}
					{hasDuoChatRail && (
						<DuoFocusChatRail
							streams={focusedChatStreams}
							activeStreamId={effectiveFocusChatStreamId}
							frame={duoFocusLayout?.chatFrame ?? null}
							onSelectStream={onSetFocusChatStream}
						/>
					)}
				</>
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
					forceAllMuted={forceAllMuted}
					expandedCardChatStreamId={expandedCardChatStreamId}
					primaryFocusedStreamId={primaryFocusedStreamId}
					effectivePrimaryFocusedStreamId={effectivePrimaryFocusedStreamId}
					focusPlaybackToken={focusPlaybackToken}
					companionPlaybackToken={companionPlaybackToken}
					primaryFocusTransitionKey={primaryFocusTransitionKey}
					onVolumeChange={onVolumeChange}
					onRemove={onRemove}
					onEdit={onEdit}
					onReorder={onReorder}
					onToggleChat={onToggleChat}
					onFocus={onEnterFocus}
					onOpenViews={onOpenViews}
					onSelectView={onSelectView}
					focusFramesByStreamId={visibleFocusFramesByStreamId}
					hasActiveFocus={hasOverlayPresentation}
					visibleFocusFramesByStreamId={visibleFocusFramesByStreamId}
					hasOverlayPresentation={hasOverlayPresentation}
					hasPreviewOverlay={hasPreviewOverlay}
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
