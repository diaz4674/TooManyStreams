import { useMemo } from "react"
import EmbeddedStreamChat from "./EmbeddedStreamChat"

function StreamTab({ stream, isActive, onSelect }) {
	return (
		<button
			type="button"
			onClick={() => onSelect(stream.id)}
			className={`shrink-0 rounded-full px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] transition-colors cursor-pointer ${
				isActive
					? "bg-cyan-400/18 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
					: "bg-white/6 text-slate-200/80 hover:bg-white/10"
			}`}
		>
			{stream.title}
		</button>
	)
}

export default function StreamChatSidebar({
	streams,
	activeStreamId,
	variant = "page",
	onSelectStream,
	onClose,
}) {
	const activeStream = useMemo(
		() =>
			streams.find((stream) => stream.id === activeStreamId) ??
			streams[0] ??
			null,
		[activeStreamId, streams],
	)

	if (!activeStream) {
		return null
	}

	const isOverlay = variant === "overlay"
	const isMatrixDock = variant === "matrixDock"
	const isMatrixDrawer = variant === "matrixDrawer"
	const isImmersive = isMatrixDock || isMatrixDrawer
	const showTabs = streams.length > 1 && typeof onSelectStream === "function"
	const asideClassName = isImmersive
		? "flex h-full w-full flex-col overflow-hidden border-l border-white/10 bg-slate-950"
		: isOverlay
		? "flex h-full w-full flex-col overflow-hidden rounded-[1.6rem] border border-cyan-400/16 bg-[linear-gradient(180deg,rgba(14,22,43,0.95),rgba(9,13,29,0.98))] shadow-[0_28px_70px_rgba(2,6,23,0.42)]"
		: "sticky top-6 w-full max-w-[22rem] overflow-hidden rounded-[1.6rem] border border-cyan-400/16 bg-[linear-gradient(180deg,rgba(14,22,43,0.95),rgba(9,13,29,0.98))] shadow-[0_28px_70px_rgba(2,6,23,0.42)] max-xl:max-w-none"
	const frameClassName = isOverlay || isImmersive
		? "h-full min-h-0 w-full border-0 bg-slate-950"
		: "h-[calc(100vh-19rem)] min-h-[28rem] w-full border-0 bg-slate-950"

	return (
		<aside className={asideClassName}>
			{isMatrixDrawer && (
				<div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
					<span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-100">
						Stream Chat
					</span>
					<button
						type="button"
						onClick={onClose}
						className="rounded-full border-0 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white cursor-pointer hover:bg-white/16"
					>
						Close
					</button>
				</div>
			)}
			{showTabs && (
				<div className="flex shrink-0 gap-2 overflow-x-auto px-4 pt-4 pb-1">
					{streams.map((stream) => (
						<StreamTab
							key={stream.id}
							stream={stream}
							isActive={stream.id === activeStream.id}
							onSelect={onSelectStream}
						/>
					))}
				</div>
			)}

			<div
				className={`${showTabs ? "px-4 pt-3 pb-4" : "px-4 py-4"} ${
					isOverlay || isImmersive ? "flex min-h-0 flex-1 flex-col" : ""
				}`}
			>
				<div
					className={`overflow-hidden rounded-[1rem] border border-cyan-400/14 bg-slate-950 ${
						isOverlay || isImmersive ? "min-h-0 flex-1" : ""
					}`}
				>
					<EmbeddedStreamChat
						stream={activeStream}
						title={`${activeStream.title} chat`}
						iframeClassName={frameClassName}
						fallbackClassName={`${frameClassName} flex items-center justify-center px-5 text-center text-sm text-slate-300/82`}
					/>
				</div>
			</div>
		</aside>
	)
}
