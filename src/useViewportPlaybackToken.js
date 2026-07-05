import { useEffect, useState } from "react"

// Chrome treats scrolled-out iframes as occluded, so Twitch pauses them and
// they need a muted play() nudge when they come back. Same threshold as the
// wall cards in StreamCard.jsx.
const VIEWPORT_AUTOPLAY_THRESHOLD = 0.6

/**
 * Bumps a numeric token every time the observed element scrolls into view
 * (>= 60% visible) or the tab becomes visible again while the element is on
 * screen. Feed the token into StreamPlayer's `playbackToken` to re-request
 * muted playback.
 */
export function useViewportPlaybackToken(targetRef, { enabled = true } = {}) {
	const [token, setToken] = useState(0)

	useEffect(() => {
		if (!enabled) {
			return undefined
		}

		const node = targetRef.current
		if (!node) {
			return undefined
		}

		if (typeof IntersectionObserver === "undefined") {
			setToken((current) => current + 1)
			return undefined
		}

		let wasVisible = false
		const observer = new IntersectionObserver(
			([entry]) => {
				const isVisible =
					entry.isIntersecting &&
					entry.intersectionRatio >= VIEWPORT_AUTOPLAY_THRESHOLD
				if (isVisible && !wasVisible) {
					setToken((current) => current + 1)
				}
				wasVisible = isVisible
			},
			{ threshold: [0, VIEWPORT_AUTOPLAY_THRESHOLD] },
		)

		observer.observe(node)

		const getVisibleRatio = () => {
			const rect = node.getBoundingClientRect()
			const totalArea = rect.width * rect.height
			if (totalArea <= 0) {
				return 0
			}
			const visibleWidth = Math.max(
				0,
				Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0),
			)
			const visibleHeight = Math.max(
				0,
				Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
			)
			return (visibleWidth * visibleHeight) / totalArea
		}

		const handleVisibilityChange = () => {
			if (
				document.visibilityState === "visible" &&
				getVisibleRatio() >= VIEWPORT_AUTOPLAY_THRESHOLD
			) {
				setToken((current) => current + 1)
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)
		window.addEventListener("focus", handleVisibilityChange)

		return () => {
			observer.disconnect()
			document.removeEventListener("visibilitychange", handleVisibilityChange)
			window.removeEventListener("focus", handleVisibilityChange)
		}
	}, [enabled, targetRef])

	return token
}
