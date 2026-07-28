import { Link } from "react-router-dom"

const useCases = [
	"Watch multiple Twitch streams at once",
	"Follow YouTube live streams in one browser tab",
	"Create a stream wall for esports tournaments",
	"Watch multiple POVs during creator events",
	"Monitor several creators at the same time",
	"Multiwatch Twitch and YouTube together, free",
]

const faqs = [
	{
		question: "Can I watch multiple Twitch streams at once?",
		answer:
			"Yes. TooManyStreams lets you add multiple Twitch streams to one browser view so you can watch several creators at the same time.",
	},
	{
		question: "What is a multiwatch tool?",
		answer:
			"A multiwatch tool lets you watch several live streams together in one place instead of switching between tabs. TooManyStreams is a free multiwatch tool for Twitch and YouTube.",
	},
	{
		question: "Is TooManyStreams a MultiTwitch alternative?",
		answer:
			"Yes. TooManyStreams is a free, independent alternative to MultiTwitch that also supports YouTube, drag-and-drop layouts, and shareable stream walls. It is not affiliated with multitwitch.tv.",
	},
	{
		question: "Can I watch Twitch and YouTube streams together?",
		answer:
			"Yes. TooManyStreams is designed to help you watch multiple live streams from platforms like Twitch and YouTube in one layout.",
	},
	{
		question: "Can I control which stream has audio?",
		answer:
			"Yes. You can select a main stream so the primary audio comes from the stream you are focused on while the rest stay visible.",
	},
	{
		question: "How can I contact you?",
		answer: (
			<>
				You can email me at{" "}
				<a
					href="mailto:brnt.marshmllow@gmail.com"
					className="font-semibold text-cyan-200 transition-colors hover:text-cyan-100"
				>
					brnt.marshmllow@gmail.com
				</a>
				.
			</>
		),
	},
]

export default function HomepageSeoSections() {
	return (
		<div className="mt-8 grid gap-8">
			<section className="mx-auto w-full max-w-5xl rounded-[2rem] border border-cyan-400/16 bg-slate-950/42 px-6 py-10 shadow-[0_36px_90px_rgba(8,15,35,0.42)]">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div className="max-w-3xl">
						<h2 className="text-2xl font-bold text-white">
							A Better Multi-Stream Viewer
						</h2>
						<p className="mt-3 text-slate-300/82">
							TooManyStreams helps you watch multiple live streams at once
							without opening a bunch of tabs. Add Twitch or YouTube streams,
							rearrange your layout, choose which stream has the main audio,
							and follow multiple POVs during live events from one browser tab.
						</p>
					</div>
					<div className="flex flex-wrap gap-3">
						<Link
							to="/watch-multiple-twitch-streams"
							className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-5 py-3 font-bold text-white transition-colors hover:bg-white/12"
						>
							<i className="fa-brands fa-twitch text-cyan-300" />
							Watch Multiple Twitch Streams
						</Link>
						<Link
							to="/multistream-viewer"
							className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-5 py-3 font-bold text-white transition-colors hover:bg-white/12"
						>
							<i className="fa-solid fa-layer-group text-cyan-300" />
							Multistream Viewer
						</Link>
						<Link
							to="/multiwatch"
							className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-5 py-3 font-bold text-white transition-colors hover:bg-white/12"
						>
							<i className="fa-solid fa-table-cells text-cyan-300" />
							Multiwatch Streams
						</Link>
						<Link
							to="/multitwitch-alternative"
							className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-5 py-3 font-bold text-white transition-colors hover:bg-white/12"
						>
							<i className="fa-brands fa-twitch text-cyan-300" />
							MultiTwitch Alternative
						</Link>
					</div>
				</div>

				<h2 className="mt-8 text-2xl font-bold text-white">
					Popular Use Cases
				</h2>
				<ul className="mt-4 list-disc space-y-2 pl-6 text-slate-300/82">
					{useCases.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</section>

			<section className="mx-auto w-full max-w-5xl rounded-[2rem] border border-cyan-400/16 bg-slate-950/42 px-6 py-10 shadow-[0_36px_90px_rgba(8,15,35,0.42)]">
				<h2 className="text-2xl font-bold text-white">
					Frequently Asked Questions
				</h2>

				<div className="mt-6 grid gap-5">
					{faqs.map((faq) => (
						<div
							key={faq.question}
							className="rounded-[1.4rem] border border-white/8 bg-white/4 p-5"
						>
							<h3 className="font-semibold text-white">{faq.question}</h3>
							<p className="mt-2 text-slate-300/82">{faq.answer}</p>
						</div>
					))}
				</div>
			</section>
		</div>
	)
}
