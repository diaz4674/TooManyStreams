import { useEffect, useRef, useState } from "react"
import { Virtuoso } from "react-virtuoso"

export default function ProjectsDialog({
	projects,
	activeProjectId,
	onClose,
	onCreateProject,
	onOpenProject,
	onRenameProject,
	onShareProject,
	onDeleteProject,
	shareFeedback,
}) {
	const [newProjectName, setNewProjectName] = useState("")
	const [editingProjectId, setEditingProjectId] = useState("")
	const [editingName, setEditingName] = useState("")
	const backdropRef = useRef(null)

	useEffect(() => {
		const handleEsc = (event) => {
			if (event.key === "Escape") onClose()
		}
		document.addEventListener("keydown", handleEsc)
		return () => document.removeEventListener("keydown", handleEsc)
	}, [onClose])

	const handleBackdropClick = (event) => {
		if (event.target === backdropRef.current) onClose()
	}

	const handleCardOpen = (project, isActive) => {
		if (isActive) return
		onOpenProject(project)
	}

	return (
		<div
			ref={backdropRef}
			onClick={handleBackdropClick}
			className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm"
		>
			<div className="w-[min(42rem,calc(100vw-2rem))] rounded-[1.4rem] border border-slate-400/20 bg-slate-900/95 text-slate-50 shadow-[0_30px_70px_rgba(0,0,0,0.45)]">
				<div className="grid gap-5 p-5">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="m-0 text-sm font-bold uppercase tracking-[0.14em] text-violet-300">
								Projects
							</p>
							<h2 className="mt-1 mb-1">
								Switch and organize saved stream walls
							</h2>
							<p className="m-0 text-sm text-slate-300/75">
								Each project keeps its own stream order and preferred saved
								chat tab.
							</p>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="rounded-2xl border-0 bg-white/8 px-5 py-3.5 font-bold text-white transition-all duration-300 cursor-pointer hover:-translate-y-px hover:bg-white/12"
						>
							Close
						</button>
					</div>

					<section className="grid gap-3 rounded-[1.2rem] border border-cyan-400/16 bg-slate-950/45 p-4">
						<div>
							<p className="m-0 text-sm font-bold uppercase tracking-[0.14em] text-cyan-300">
								Create Project
							</p>
							<p className="mt-1 mb-0 text-sm text-slate-300/75">
								Start a fresh workspace for a tournament, game, or creator list.
							</p>
						</div>

						<div className="flex gap-3 max-[760px]:flex-col">
							<input
								type="text"
								value={newProjectName}
								onChange={(event) => setNewProjectName(event.target.value)}
								placeholder="Tournament"
								className="flex-1 rounded-[0.95rem] border border-slate-400/20 bg-slate-900/90 px-4 py-3.5 text-slate-50 focus:outline-2 focus:outline-cyan-400/75 focus:outline-offset-2"
							/>
							<button
								type="button"
								onClick={() => {
									if (!newProjectName.trim()) return
									onCreateProject(newProjectName)
									setNewProjectName("")
								}}
								className="rounded-2xl border-0 bg-gradient-to-br from-fuchsia-600 to-violet-600 px-5 py-3.5 font-bold text-white shadow-[0_18px_30px_rgba(124,58,237,0.28)] transition-all duration-300 cursor-pointer hover:-translate-y-px hover:shadow-[0_24px_40px_rgba(124,58,237,0.34)]"
							>
								Create Project
							</button>
						</div>
					</section>

					<section className="h-[min(24rem,50vh)]">
						<Virtuoso
							data={projects}
							itemContent={(_, project) => {
								const isActive = project.id === activeProjectId
								const isEditing = project.id === editingProjectId
								const canDelete = projects.length > 1
								const projectShareFeedback =
									shareFeedback?.projectId === project.id ? shareFeedback : null

								return (
									<div className="pb-3 last:pb-0">
										<div
											className={`rounded-[1.2rem] my-3 border p-4 transition-all duration-200 ${
												isActive
													? "border-cyan-400/30 bg-cyan-400/10"
													: "cursor-pointer border-white/8 bg-white/5 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/8 hover:shadow-[0_18px_40px_rgba(8,145,178,0.18)]"
											}`}
											onClick={() => handleCardOpen(project, isActive)}
											onKeyDown={(event) => {
												if (event.key === "Enter" || event.key === " ") {
													event.preventDefault()
													handleCardOpen(project, isActive)
												}
											}}
											role="button"
											tabIndex={isActive ? -1 : 0}
										>
											<div className="flex items-start justify-between gap-4 max-[760px]:flex-col">
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-2">
														<h3 className="m-0 truncate text-lg font-semibold">
															{project.name}
														</h3>
														{isActive && (
															<span className="rounded-full bg-cyan-400/16 px-2.5 py-1 text-[0.72rem] font-bold uppercase tracking-wide text-cyan-200">
																Active
															</span>
														)}
													</div>
													<p className="mt-1 mb-0 text-sm text-slate-300/70">
														{project.streamIds.length}{" "}
														{project.streamIds.length === 1
															? "stream"
															: "streams"}{" "}
														|{" "}
														{project.activeChatStreamId
															? "Saved chat tab"
															: "Video wall only"}
													</p>
												</div>

												<div className="flex flex-wrap gap-2">
													<button
														type="button"
														onClick={(event) => {
															event.stopPropagation()
															setEditingProjectId(project.id)
															setEditingName(project.name)
														}}
														className="rounded-xl border-0 bg-white/8 px-4 py-2.5 font-bold text-white transition-all duration-200 cursor-pointer hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
													>
														Rename
													</button>
													<button
														type="button"
														onClick={(event) => {
															event.stopPropagation()
															onShareProject(project.id)
														}}
														className="rounded-xl border-0 bg-cyan-500/18 px-4 py-2.5 font-bold text-white shadow-[0_0_0_1px_rgba(34,211,238,0.14)] transition-all duration-200 cursor-pointer hover:bg-cyan-500/24"
													>
														Share Project
													</button>
													<button
														type="button"
														onClick={(event) => {
															event.stopPropagation()
															onDeleteProject(project.id)
														}}
														disabled={!canDelete}
														className="rounded-xl border-0 bg-rose-500/75 px-4 py-2.5 font-bold text-white transition-all duration-200 cursor-pointer hover:bg-rose-500/85 disabled:cursor-not-allowed disabled:opacity-50"
													>
														Delete
													</button>
												</div>
											</div>

											{projectShareFeedback?.message && (
												<p
													className={`mt-3 mb-0 text-sm ${
														projectShareFeedback.tone === "success"
															? "text-cyan-200"
															: "text-amber-200"
													}`}
												>
													{projectShareFeedback.message}
												</p>
											)}

											{isEditing && (
												<div className="mt-3 flex gap-3 max-[760px]:flex-col">
													<input
														type="text"
														value={editingName}
														onClick={(event) => event.stopPropagation()}
														onChange={(event) =>
															setEditingName(event.target.value)
														}
														className="flex-1 rounded-[0.95rem] border border-slate-400/20 bg-slate-900/90 px-4 py-3 text-slate-50 focus:outline-2 focus:outline-cyan-400/75 focus:outline-offset-2"
													/>
													<div className="flex gap-2">
														<button
															type="button"
															onClick={(event) => {
																event.stopPropagation()
																onRenameProject(project.id, editingName)
																setEditingProjectId("")
																setEditingName("")
															}}
															className="rounded-xl border-0 bg-cyan-500/20 px-4 py-3 font-bold text-white shadow-[0_0_0_1px_rgba(34,211,238,0.16)] transition-all duration-200 cursor-pointer hover:bg-cyan-500/24"
														>
															Save
														</button>
														<button
															type="button"
															onClick={(event) => {
																event.stopPropagation()
																setEditingProjectId("")
																setEditingName("")
															}}
															className="rounded-xl border-0 bg-white/8 px-4 py-3 font-bold text-white transition-all duration-200 cursor-pointer hover:bg-white/12"
														>
															Cancel
														</button>
													</div>
												</div>
											)}
										</div>
									</div>
								)
							}}
						/>
					</section>
				</div>
			</div>
		</div>
	)
}
