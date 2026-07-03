export function getEmbedSrc(stream, options) {
	if (stream.platform === "twitch") {
		const parent = getTwitchParent()
		const params = new URLSearchParams({
			channel: stream.channelName,
			parent,
			muted: String(options.muted),
			autoplay: String(options.autoplay),
		})
		return `https://player.twitch.tv/?${params.toString()}`
	}

	if (stream.platform === "youtube") {
		const target = getYouTubeTarget(stream.channelName)
		const params = new URLSearchParams({
			autoplay: String(options.autoplay),
			mute: options.muted ? "1" : "0",
			playsinline: "1",
		})

		if (options.apiEnabled) {
			params.set("enablejsapi", "1")
			params.set("origin", getCurrentOrigin())
		}

		if (target.kind === "channel") {
			params.set("channel", target.id)
			return `https://www.youtube.com/embed/live_stream?${params.toString()}`
		}

		return `https://www.youtube.com/embed/${encodeURIComponent(target.id)}?${params.toString()}`
	}

	return ""
}

export function getTwitchChannelUrl(stream) {
	if (stream?.platform !== "twitch" || typeof stream.channelName !== "string") {
		return null
	}

	const channel = stream.channelName.trim()
	if (!channel) {
		return null
	}

	return `https://www.twitch.tv/${encodeURIComponent(channel)}`
}

export function getTwitchChatSrc(stream, options = {}) {
	const params = new URLSearchParams({
		parent: getTwitchParent(),
	})
	const baseUrl = `https://www.twitch.tv/embed/${encodeURIComponent(stream.channelName)}/chat?${params.toString()}`

	return options.darkMode ? `${baseUrl}&darkpopout` : baseUrl
}

export function getYouTubeChatSrc(stream) {
	if (stream?.platform !== "youtube") {
		return null
	}

	const target = getYouTubeTarget(stream.channelName)
	if (target.kind !== "video") {
		return null
	}

	const params = new URLSearchParams({
		v: target.id,
		embed_domain: getChatEmbedHostname(),
	})

	return `https://www.youtube.com/live_chat?${params.toString()}`
}

export function isStreamChatCapable(stream) {
	if (!stream || typeof stream.channelName !== "string") {
		return false
	}

	if (stream.platform === "twitch") {
		return Boolean(stream.channelName.trim())
	}

	if (stream.platform === "youtube") {
		return getYouTubeTarget(stream.channelName).kind === "video"
	}

	return false
}

export function getStreamChatSrc(stream, options = {}) {
	if (!isStreamChatCapable(stream)) {
		return null
	}

	if (stream.platform === "twitch") {
		return getTwitchChatSrc(stream, options)
	}

	if (stream.platform === "youtube") {
		return getYouTubeChatSrc(stream)
	}

	return null
}

export function isMobileWebBrowser() {
	if (typeof navigator === "undefined") {
		return false
	}

	if (typeof navigator.userAgentData?.mobile === "boolean") {
		return navigator.userAgentData.mobile
	}

	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
		navigator.userAgent ?? "",
	)
}

export function getWallLayout({
	count,
	containerWidth,
	containerHeight,
	gap = 16,
	chromeHeight = 116,
	maxColumns = count,
}) {
	if (!count || containerWidth <= 0 || containerHeight <= 0) {
		return {
			columns: 1,
			rows: 1,
			cardWidth: 0,
			cardHeight: 0,
			videoHeight: 0,
			paddingTop: 0,
		}
	}

	const safeMaxColumns = Math.max(1, Math.min(count, maxColumns))
	const minimumCardWidth = 260
	let columns = safeMaxColumns

	while (columns > 1) {
		const candidateWidth = (containerWidth - gap * (columns - 1)) / columns
		if (candidateWidth >= minimumCardWidth) {
			break
		}

		columns -= 1
	}

	const rows = Math.ceil(count / columns)
	const cardWidth = Math.max(
		0,
		(containerWidth - gap * (columns - 1)) / columns,
	)
	const videoHeight = Math.max(0, cardWidth * (9 / 16))
	const cardHeight = Math.max(0, videoHeight + chromeHeight)

	return {
		columns,
		rows,
		cardWidth: Math.floor(cardWidth),
		cardHeight: Math.floor(cardHeight),
		videoHeight: Math.floor(videoHeight),
		paddingTop: 0,
	}
}

export function getTwitchParent() {
	const host = window.location.hostname
	if (!host || host === "") return "localhost"
	return host
}

function getChatEmbedHostname() {
	const host = window.location.hostname
	if (!host || host === "") {
		return "localhost"
	}

	return host
}

function getCurrentOrigin() {
	if (typeof window === "undefined") {
		return "http://localhost"
	}

	return window.location.origin && window.location.origin !== "null"
		? window.location.origin
		: "http://localhost"
}

export function getYouTubeTarget(value) {
	const trimmedValue = value.trim()

	try {
		const url = new URL(trimmedValue)
		const hostname = url.hostname.replace(/^www\./, "")

		if (hostname === "youtu.be") {
			const videoId = url.pathname.split("/").filter(Boolean)[0]
			if (videoId) {
				return { kind: "video", id: videoId }
			}
		}

		if (hostname === "youtube.com" || hostname === "m.youtube.com") {
			const watchId = url.searchParams.get("v")
			if (watchId) {
				return { kind: "video", id: watchId }
			}

			const liveMatch = url.pathname.match(/^\/live\/([A-Za-z0-9_-]{11})$/)
			if (liveMatch) {
				return { kind: "video", id: liveMatch[1] }
			}

			const embedMatch = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})$/)
			if (embedMatch) {
				return { kind: "video", id: embedMatch[1] }
			}

			const shortsMatch = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})$/)
			if (shortsMatch) {
				return { kind: "video", id: shortsMatch[1] }
			}

			const channelMatch = url.pathname.match(
				/^\/channel\/(UC[A-Za-z0-9_-]{20,})$/,
			)
			if (channelMatch) {
				return { kind: "channel", id: channelMatch[1] }
			}
		}
	} catch {
		// Fall back to raw value parsing.
	}

	if (/^UC[A-Za-z0-9_-]{20,}$/.test(trimmedValue)) {
		return { kind: "channel", id: trimmedValue }
	}

	if (/^[A-Za-z0-9_-]{11}$/.test(trimmedValue)) {
		return { kind: "video", id: trimmedValue }
	}

	return { kind: "video", id: trimmedValue }
}
