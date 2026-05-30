const FOCUS_WIDE_MIN_WIDTH_PX = 1280
const FOCUS_OVERLAY_PADDING_PX = 24
const FOCUS_OVERLAY_SMALL_PADDING_PX = 16
const FOCUS_TOOLBAR_OFFSET_PX = 68
const FOCUS_OVERLAY_GAP_PX = 16
const DUO_CHAT_MIN_WIDTH_PX = 320
const DUO_CHAT_MAX_WIDTH_PX = 360
const DUO_MIN_VIDEO_WIDTH_PX = 420

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max)
}

export function getFocusCanvas(viewportWidth, viewportHeight) {
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

export function buildDuoFocusLayout({
	viewportWidth,
	viewportHeight,
	showChatRail = false,
}) {
	const canvas = getFocusCanvas(viewportWidth, viewportHeight)
	const { left, top, width, height } = canvas
	const preferredChatWidth = clamp(
		Math.round(width * 0.24),
		DUO_CHAT_MIN_WIDTH_PX,
		DUO_CHAT_MAX_WIDTH_PX,
	)
	const maxChatWidth =
		width - FOCUS_OVERLAY_GAP_PX * 2 - DUO_MIN_VIDEO_WIDTH_PX * 2
	const canShowChatRail =
		showChatRail && maxChatWidth >= DUO_CHAT_MIN_WIDTH_PX
	const chatWidth = canShowChatRail
		? Math.min(preferredChatWidth, maxChatWidth, DUO_CHAT_MAX_WIDTH_PX)
		: 0
	const slotWidth = canShowChatRail
		? (width - chatWidth - FOCUS_OVERLAY_GAP_PX * 2) / 2
		: (width - FOCUS_OVERLAY_GAP_PX) / 2

	return {
		slotFrames: [
			{
				left,
				top,
				width: slotWidth,
				height,
			},
			{
				left: canShowChatRail
					? left + slotWidth + FOCUS_OVERLAY_GAP_PX + chatWidth + FOCUS_OVERLAY_GAP_PX
					: left + slotWidth + FOCUS_OVERLAY_GAP_PX,
				top,
				width: slotWidth,
				height,
			},
		],
		chatFrame: canShowChatRail
			? {
					left: left + slotWidth + FOCUS_OVERLAY_GAP_PX,
					top,
					width: chatWidth,
					height,
				}
			: null,
	}
}
