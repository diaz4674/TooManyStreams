import { Link } from "react-router-dom"

export default function SeoPage({ title, description, sections = [] }) {
	return (
		<main className="min-h-screen px-6 py-12 max-md:px-4">
			<div className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-cyan-400/16 bg-slate-950/42 p-8 shadow-[0_36px_90px_rgba(8,15,35,0.42)]">
				<p className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-300">
					TooManyStreams
				</p>
				<h1 className="mt-3 text-[clamp(2.4rem,5vw,4rem)] font-bold leading-[0.95] tracking-tight text-white">
					{title}
				</h1>
				<p className="mt-4 max-w-3xl text-lg text-slate-300/84">
					{description}
				</p>

				<div className="mt-7 flex flex-wrap gap-3">
					<Link
						to="/"
						className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 px-6 py-3.5 font-bold text-white shadow-[0_18px_30px_rgba(124,58,237,0.28)] transition-all duration-300 hover:-translate-y-px hover:shadow-[0_24px_40px_rgba(124,58,237,0.34)]"
					>
						<i className="fa-solid fa-play" />
						Start Watching
					</Link>
					<Link
						to="/multistream-viewer"
						className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-5 py-3.5 font-bold text-white transition-colors hover:bg-white/12"
					>
						<i className="fa-solid fa-layer-group text-cyan-300" />
						Explore Multistream Viewer
					</Link>
				</div>

				<div className="mt-10 grid gap-6">
					{sections.map((section) => (
						<section
							key={section.heading}
							className="rounded-[1.6rem] border border-white/8 bg-white/4 p-6"
						>
							<h2 className="text-2xl font-bold text-white">
								{section.heading}
							</h2>
							<p className="mt-3 leading-7 text-slate-300/82">
								{section.body}
							</p>
						</section>
					))}
				</div>
			</div>
		</main>
	)
}
