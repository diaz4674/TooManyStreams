import assert from "node:assert/strict"
import test from "node:test"
import { buildDuoFocusLayout, getFocusCanvas } from "./focusLayouts.js"

test("duo center chat appears only when each video pane can stay wide enough", () => {
	const layout = buildDuoFocusLayout({
		viewportWidth: 1600,
		viewportHeight: 900,
		showChatRail: true,
	})

	assert.ok(layout.chatFrame)
	assert.equal(layout.slotFrames.length, 2)
	assert.ok(layout.slotFrames[0].width >= 420)
	assert.ok(layout.slotFrames[1].width >= 420)
})

test("duo chat rail is dropped when the viewport cannot preserve the minimum video width", () => {
	const layout = buildDuoFocusLayout({
		viewportWidth: 1100,
		viewportHeight: 900,
		showChatRail: true,
	})

	assert.equal(layout.chatFrame, null)
	assert.equal(layout.slotFrames.length, 2)
})

test("duo without center chat splits the full canvas between both panes", () => {
	const viewportWidth = 1500
	const viewportHeight = 920
	const canvas = getFocusCanvas(viewportWidth, viewportHeight)
	const layout = buildDuoFocusLayout({
		viewportWidth,
		viewportHeight,
		showChatRail: false,
	})

	const combinedWidth =
		layout.slotFrames[0].width + 16 + layout.slotFrames[1].width

	assert.equal(layout.chatFrame, null)
	assert.equal(layout.slotFrames.length, 2)
	assert.equal(combinedWidth, canvas.width)
})
