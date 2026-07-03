import test from "node:test"
import assert from "node:assert/strict"
import {
	FULL_CROP,
	MIN_CROP_SIZE,
	areCropsEqual,
	getActiveStreamCrop,
	getCropFrameLayout,
	isFullCrop,
	normalizeCropRect,
	normalizeStreamViews,
} from "./streamViews.js"

test("normalizeCropRect clamps values into the video frame", () => {
	assert.deepEqual(
		normalizeCropRect({ x: -0.2, y: 0.5, width: 0.5, height: 2 }),
		{ x: 0, y: 0, width: 0.5, height: 1 },
	)
	assert.deepEqual(
		normalizeCropRect({ x: 0.9, y: 0.9, width: 0.4, height: 0.4 }),
		{ x: 0.6, y: 0.6, width: 0.4, height: 0.4 },
	)
})

test("normalizeCropRect enforces a minimum crop size", () => {
	const crop = normalizeCropRect({ x: 0.2, y: 0.2, width: 0.01, height: 0.01 })
	assert.equal(crop.width, MIN_CROP_SIZE)
	assert.equal(crop.height, MIN_CROP_SIZE)
})

test("normalizeCropRect rejects malformed rects", () => {
	assert.equal(normalizeCropRect(null), null)
	assert.equal(normalizeCropRect({ x: 0, y: 0, width: "1", height: 1 }), null)
	assert.equal(normalizeCropRect({ x: Number.NaN, y: 0, width: 1, height: 1 }), null)
})

test("isFullCrop treats missing and full-frame rects as full", () => {
	assert.equal(isFullCrop(null), true)
	assert.equal(isFullCrop(FULL_CROP), true)
	assert.equal(isFullCrop({ x: 0, y: 0, width: 0.9, height: 1 }), false)
})

test("normalizeStreamViews keeps untouched streams referentially stable", () => {
	const plainStream = {
		id: "stream-1",
		platform: "twitch",
		channelName: "tarik",
		title: "Tarik",
	}
	assert.equal(normalizeStreamViews(plainStream), plainStream)

	const streamWithViews = {
		...plainStream,
		views: [
			{
				id: "view-1",
				name: "Map",
				crop: { x: 0, y: 0, width: 0.25, height: 0.25 },
			},
		],
		activeViewId: "view-1",
	}
	assert.equal(normalizeStreamViews(streamWithViews), streamWithViews)
})

test("normalizeStreamViews drops invalid views and dangling active ids", () => {
	const stream = {
		id: "stream-1",
		platform: "twitch",
		channelName: "tarik",
		title: "Tarik",
		views: [
			{ id: "view-1", name: "Map", crop: { x: 0, y: 0, width: 0.3, height: 0.3 } },
			{ id: "view-2", name: "", crop: { x: 0, y: 0, width: 0.3, height: 0.3 } },
			{ id: "view-3", name: "Broken", crop: { x: 0, y: 0 } },
			{ id: "view-1", name: "Duplicate", crop: FULL_CROP },
		],
		activeViewId: "view-2",
	}

	const normalized = normalizeStreamViews(stream)
	assert.equal(normalized.views.length, 1)
	assert.equal(normalized.views[0].id, "view-1")
	assert.equal(normalized.activeViewId, null)
})

test("normalizeStreamViews strips empty view collections", () => {
	const stream = {
		id: "stream-1",
		platform: "twitch",
		channelName: "tarik",
		title: "Tarik",
		views: [],
		activeViewId: "gone",
	}

	const normalized = normalizeStreamViews(stream)
	assert.equal("views" in normalized, false)
	assert.equal("activeViewId" in normalized, false)
})

test("getActiveStreamCrop resolves the active view and ignores full-frame views", () => {
	const crop = { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }
	const stream = {
		views: [
			{ id: "view-1", name: "Corner", crop },
			{ id: "view-2", name: "Everything", crop: { ...FULL_CROP } },
		],
		activeViewId: "view-1",
	}

	assert.equal(getActiveStreamCrop(stream), crop)
	assert.equal(getActiveStreamCrop({ ...stream, activeViewId: "view-2" }), null)
	assert.equal(getActiveStreamCrop({ ...stream, activeViewId: null }), null)
})

test("getCropFrameLayout maps a quarter crop onto a matching container", () => {
	const layout = getCropFrameLayout({
		containerWidth: 960,
		containerHeight: 540,
		crop: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
	})

	assert.deepEqual(layout.content, { left: 0, top: 0, width: 960, height: 540 })
	assert.deepEqual(layout.frame, {
		left: -960,
		top: -540,
		width: 1920,
		height: 1080,
	})
})

test("getCropFrameLayout letterboxes crops that do not match the container", () => {
	// A full-width, quarter-height strip is very wide; a square-ish container
	// should pillar-box it vertically and keep the virtual frame at 16:9.
	const layout = getCropFrameLayout({
		containerWidth: 800,
		containerHeight: 800,
		crop: { x: 0, y: 0.75, width: 1, height: 0.25 },
	})

	assert.equal(layout.content.width, 800)
	assert.ok(Math.abs(layout.content.height - 800 / ((16 / 9) * 4)) < 0.001)
	assert.ok(Math.abs(layout.content.top - (800 - layout.content.height) / 2) < 0.001)
	assert.equal(layout.frame.width, 800)
	assert.ok(Math.abs(layout.frame.width / layout.frame.height - 16 / 9) < 0.001)
	assert.ok(Math.abs(layout.frame.top + 0.75 * layout.frame.height) < 0.001)
})

test("areCropsEqual compares by value", () => {
	const crop = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
	assert.equal(areCropsEqual(crop, { ...crop }), true)
	assert.equal(areCropsEqual(crop, { ...crop, x: 0.11 }), false)
	assert.equal(areCropsEqual(null, crop), false)
	assert.equal(areCropsEqual(null, null), true)
})
