export const MIN_CROP_SIZE = 0.1
export const VIDEO_ASPECT_RATIO = 16 / 9
export const FULL_CROP = Object.freeze({ x: 0, y: 0, width: 1, height: 1 })

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max)
}

function roundCropValue(value) {
	return Math.round(value * 10000) / 10000
}

function isFiniteNumber(value) {
	return typeof value === "number" && Number.isFinite(value)
}

export function isFullCrop(crop) {
	return (
		!crop ||
		(crop.x <= 0 && crop.y <= 0 && crop.width >= 1 && crop.height >= 1)
	)
}

export function areCropsEqual(left, right) {
	if (left === right) {
		return true
	}

	if (!left || !right) {
		return false
	}

	return (
		left.x === right.x &&
		left.y === right.y &&
		left.width === right.width &&
		left.height === right.height
	)
}

export function normalizeCropRect(rawCrop) {
	if (
		!rawCrop ||
		!isFiniteNumber(rawCrop.x) ||
		!isFiniteNumber(rawCrop.y) ||
		!isFiniteNumber(rawCrop.width) ||
		!isFiniteNumber(rawCrop.height)
	) {
		return null
	}

	const width = clamp(rawCrop.width, MIN_CROP_SIZE, 1)
	const height = clamp(rawCrop.height, MIN_CROP_SIZE, 1)

	return {
		x: roundCropValue(clamp(rawCrop.x, 0, 1 - width)),
		y: roundCropValue(clamp(rawCrop.y, 0, 1 - height)),
		width: roundCropValue(width),
		height: roundCropValue(height),
	}
}

function isNormalizedView(view) {
	if (
		!view ||
		typeof view.id !== "string" ||
		!view.id ||
		typeof view.name !== "string" ||
		!view.name.trim()
	) {
		return false
	}

	const crop = normalizeCropRect(view.crop)
	return Boolean(crop) && areCropsEqual(crop, view.crop)
}

function isAlreadyNormalized(stream) {
	if (!("views" in stream) && !("activeViewId" in stream)) {
		return true
	}

	if (!Array.isArray(stream.views) || stream.views.length === 0) {
		return false
	}

	const seenIds = new Set()
	for (const view of stream.views) {
		if (!isNormalizedView(view) || seenIds.has(view.id)) {
			return false
		}

		seenIds.add(view.id)
	}

	return (
		stream.activeViewId === null ||
		(typeof stream.activeViewId === "string" && seenIds.has(stream.activeViewId))
	)
}

export function normalizeStreamViews(stream) {
	if (!stream || isAlreadyNormalized(stream)) {
		return stream
	}

	const rawViews = Array.isArray(stream.views) ? stream.views : []
	const activeViewId =
		typeof stream.activeViewId === "string" ? stream.activeViewId : null
	const normalizedIds = new Set()
	const views = rawViews.flatMap((view) => {
		if (
			!view ||
			typeof view.id !== "string" ||
			!view.id ||
			normalizedIds.has(view.id) ||
			typeof view.name !== "string" ||
			!view.name.trim()
		) {
			return []
		}

		const crop = normalizeCropRect(view.crop)
		if (!crop) {
			return []
		}

		normalizedIds.add(view.id)
		return [{ id: view.id, name: view.name.trim(), crop }]
	})

	const normalizedActiveViewId =
		activeViewId && views.some((view) => view.id === activeViewId)
			? activeViewId
			: null

	const { views: _views, activeViewId: _activeViewId, ...rest } = stream
	if (views.length === 0) {
		return rest
	}

	return {
		...rest,
		views,
		activeViewId: normalizedActiveViewId,
	}
}

export function getStreamViews(stream) {
	return Array.isArray(stream?.views) ? stream.views : []
}

export function getActiveStreamView(stream) {
	if (!stream?.activeViewId) {
		return null
	}

	return (
		getStreamViews(stream).find((view) => view.id === stream.activeViewId) ??
		null
	)
}

export function getActiveStreamCrop(stream) {
	const view = getActiveStreamView(stream)
	if (!view || isFullCrop(view.crop)) {
		return null
	}

	return view.crop
}

// Maps a crop rect (fractions of the 16:9 video frame) onto a measured
// container: `content` is the letterboxed box the cropped region fills, and
// `frame` is the oversized virtual 16:9 video positioned so only the crop
// shows through `content`'s overflow clipping.
export function getCropFrameLayout({
	containerWidth,
	containerHeight,
	crop,
	aspectRatio = VIDEO_ASPECT_RATIO,
}) {
	if (
		!crop ||
		containerWidth <= 0 ||
		containerHeight <= 0 ||
		crop.width <= 0 ||
		crop.height <= 0
	) {
		return null
	}

	const cropAspectRatio = (crop.width / crop.height) * aspectRatio
	const containerAspectRatio = containerWidth / containerHeight
	const contentWidth =
		containerAspectRatio > cropAspectRatio
			? containerHeight * cropAspectRatio
			: containerWidth
	const contentHeight = contentWidth / cropAspectRatio
	const frameWidth = contentWidth / crop.width
	const frameHeight = contentHeight / crop.height

	return {
		content: {
			left: (containerWidth - contentWidth) / 2,
			top: (containerHeight - contentHeight) / 2,
			width: contentWidth,
			height: contentHeight,
		},
		frame: {
			left: -crop.x * frameWidth,
			top: -crop.y * frameHeight,
			width: frameWidth,
			height: frameHeight,
		},
	}
}
