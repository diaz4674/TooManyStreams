const STORAGE_KEY = "multiwatch.wall.focus"
const STORAGE_VERSION = 1
const VALID_FOCUS_LAYOUTS = new Set(["single", "stacked", "equal", "duo"])

function getStorage() {
	try {
		return typeof window !== "undefined" ? window.localStorage : null
	} catch {
		return null
	}
}

function sanitizeArrangement(arrangement) {
	if (!arrangement || typeof arrangement !== "object") {
		return null
	}

	const focusedStreamIds = Array.isArray(arrangement.focusedStreamIds)
		? [
				...new Set(
					arrangement.focusedStreamIds.filter(
						(id) => typeof id === "string" && id,
					),
				),
			]
		: []

	if (focusedStreamIds.length === 0) {
		return null
	}

	const focusLayout = VALID_FOCUS_LAYOUTS.has(arrangement.focusLayout)
		? arrangement.focusLayout
		: "single"

	return { focusedStreamIds, focusLayout }
}

function sanitizeProjectFocus(rawByPrimaryId) {
	if (!rawByPrimaryId || typeof rawByPrimaryId !== "object") {
		return {}
	}

	const entries = Object.entries(rawByPrimaryId).flatMap(
		([primaryId, arrangement]) => {
			if (typeof primaryId !== "string" || !primaryId) {
				return []
			}

			const sanitized = sanitizeArrangement(arrangement)
			// Keep only arrangements whose primary is the first focused stream.
			if (!sanitized || sanitized.focusedStreamIds[0] !== primaryId) {
				return []
			}

			return [[primaryId, sanitized]]
		},
	)

	return Object.fromEntries(entries)
}

function readAll() {
	const storage = getStorage()
	if (!storage) {
		return {}
	}

	try {
		const parsed = JSON.parse(storage.getItem(STORAGE_KEY))
		if (
			!parsed ||
			parsed.version !== STORAGE_VERSION ||
			!parsed.byProjectId ||
			typeof parsed.byProjectId !== "object"
		) {
			return {}
		}

		return parsed.byProjectId
	} catch {
		return {}
	}
}

// Returns the saved cinema arrangements for a project, keyed by primary stream
// id. Returns an empty object when nothing is stored or persistence is
// unavailable (e.g. server-side or test environments).
export function loadProjectFocus(projectId) {
	if (typeof projectId !== "string" || !projectId) {
		return {}
	}

	return sanitizeProjectFocus(readAll()[projectId])
}

// Writes the saved cinema arrangements for a single project, merging with the
// arrangements stored for other projects. A no-op when persistence is
// unavailable.
export function persistProjectFocus(projectId, savedFocusByPrimaryId) {
	const storage = getStorage()
	if (!storage || typeof projectId !== "string" || !projectId) {
		return
	}

	const byProjectId = { ...readAll() }
	const sanitized = sanitizeProjectFocus(savedFocusByPrimaryId)

	if (Object.keys(sanitized).length === 0) {
		delete byProjectId[projectId]
	} else {
		byProjectId[projectId] = sanitized
	}

	try {
		storage.setItem(
			STORAGE_KEY,
			JSON.stringify({ version: STORAGE_VERSION, byProjectId }),
		)
	} catch {
		// Ignore quota or serialization failures — persistence is best-effort.
	}
}
