import assert from "node:assert/strict"
import test from "node:test"
import { loadProjectFocus, persistProjectFocus } from "./wallPersistence.js"

function installLocalStorage() {
	const store = new Map()
	globalThis.window = {
		localStorage: {
			getItem(key) {
				return store.has(key) ? store.get(key) : null
			},
			setItem(key, value) {
				store.set(key, String(value))
			},
			removeItem(key) {
				store.delete(key)
			},
		},
	}
	return store
}

test("persist and load round-trips a project's cinema arrangements", () => {
	installLocalStorage()

	persistProjectFocus("project-1", {
		a: { focusedStreamIds: ["a", "b"], focusLayout: "stacked" },
	})

	assert.deepEqual(loadProjectFocus("project-1"), {
		a: { focusedStreamIds: ["a", "b"], focusLayout: "stacked" },
	})

	delete globalThis.window
})

test("arrangements are isolated per project", () => {
	installLocalStorage()

	persistProjectFocus("project-1", {
		a: { focusedStreamIds: ["a", "b"], focusLayout: "duo" },
	})
	persistProjectFocus("project-2", {
		c: { focusedStreamIds: ["c", "d"], focusLayout: "equal" },
	})

	assert.deepEqual(loadProjectFocus("project-1"), {
		a: { focusedStreamIds: ["a", "b"], focusLayout: "duo" },
	})
	assert.deepEqual(loadProjectFocus("project-2"), {
		c: { focusedStreamIds: ["c", "d"], focusLayout: "equal" },
	})

	delete globalThis.window
})

test("persisting an empty arrangement clears the project entry", () => {
	installLocalStorage()

	persistProjectFocus("project-1", {
		a: { focusedStreamIds: ["a", "b"], focusLayout: "stacked" },
	})
	persistProjectFocus("project-1", {})

	assert.deepEqual(loadProjectFocus("project-1"), {})

	delete globalThis.window
})

test("invalid arrangements are dropped on load", () => {
	installLocalStorage()

	persistProjectFocus("project-1", {
		a: { focusedStreamIds: ["a", "b"], focusLayout: "stacked" },
		b: { focusedStreamIds: ["a", "b"], focusLayout: "stacked" }, // primary mismatch
		c: { focusedStreamIds: [], focusLayout: "single" }, // empty
		d: { focusedStreamIds: ["d"], focusLayout: "bogus" }, // bad layout -> single
	})

	assert.deepEqual(loadProjectFocus("project-1"), {
		a: { focusedStreamIds: ["a", "b"], focusLayout: "stacked" },
		d: { focusedStreamIds: ["d"], focusLayout: "single" },
	})

	delete globalThis.window
})

test("load returns empty without a storage backend", () => {
	delete globalThis.window
	assert.deepEqual(loadProjectFocus("project-1"), {})
})
