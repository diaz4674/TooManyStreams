import { useSyncExternalStore } from "react"

// Matches Tailwind's `md` breakpoint (768px): below it the app swaps to the
// mobile experience. Viewport-based on purpose — `isMobileWebBrowser()` stays
// reserved for genuinely UA-dependent checks (YouTube chat embeds).
const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)"

function subscribe(onStoreChange) {
	const mediaQueryList = window.matchMedia(MOBILE_VIEWPORT_QUERY)
	mediaQueryList.addEventListener("change", onStoreChange)
	return () => {
		mediaQueryList.removeEventListener("change", onStoreChange)
	}
}

function getSnapshot() {
	return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
}

function getServerSnapshot() {
	return false
}

export function useMobileViewport() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
