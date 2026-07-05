const STORAGE_KEY = "multiwatch.mobile.pip"

const DEFAULT_PREFS = {
	widthFraction: 0.6,
	snapSide: "right",
}

export function loadPipPrefs() {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY)
		if (!raw) {
			return { ...DEFAULT_PREFS }
		}

		const parsed = JSON.parse(raw)
		const widthFraction = Number(parsed?.widthFraction)
		return {
			widthFraction:
				Number.isFinite(widthFraction) && widthFraction > 0
					? Math.min(Math.max(widthFraction, 0.3), 1)
					: DEFAULT_PREFS.widthFraction,
			snapSide: parsed?.snapSide === "left" ? "left" : "right",
		}
	} catch {
		return { ...DEFAULT_PREFS }
	}
}

export function savePipPrefs(prefs) {
	try {
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				widthFraction: prefs.widthFraction,
				snapSide: prefs.snapSide,
			}),
		)
	} catch {
		// Storage unavailable (private mode/quota) — the pip just won't remember
		// its size, which is fine.
	}
}
