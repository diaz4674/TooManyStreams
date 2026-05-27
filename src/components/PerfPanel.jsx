import { useShallow } from "zustand/react/shallow"
import { getPlaybackStats, useWallStore } from "../wallStore"

export default function PerfPanel({ streamIds }) {
	const { perfEnabled, lastFocusLatency, lastInteractionRenderCount, live, preview, suspended } =
		useWallStore(
			useShallow((state) => ({
				perfEnabled: state.perfEnabled,
				lastFocusLatency: state.lastFocusLatency,
				lastInteractionRenderCount: state.lastInteractionRenderCount,
				...getPlaybackStats(state, streamIds),
			})),
		)

	if (!perfEnabled) {
		return null
	}

	return (
		<aside className="mb-4 rounded-[1.35rem] border border-amber-300/25 bg-amber-400/8 px-4 py-3 text-amber-50 shadow-[0_18px_44px_rgba(120,53,15,0.22)]">
			<p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-amber-200/90">
				Perf Panel
			</p>
			<div className="mt-2 grid gap-2 text-sm text-amber-50/88 md:grid-cols-5">
				<p className="m-0">
					<strong>Live:</strong> {live}
				</p>
				<p className="m-0">
					<strong>Preview:</strong> {preview}
				</p>
				<p className="m-0">
					<strong>Suspended:</strong> {suspended}
				</p>
				<p className="m-0">
					<strong>Focus to paint:</strong> {Math.round(lastFocusLatency)}ms
				</p>
				<p className="m-0">
					<strong>Card renders:</strong> {lastInteractionRenderCount}
				</p>
			</div>
		</aside>
	)
}
