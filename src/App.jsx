import { Link, Route, Routes } from "react-router-dom"
import { Analytics } from "@vercel/analytics/react"
import HomePage from "./HomePage"
import PageMeta from "./components/PageMeta"
import SeoPage from "./components/SeoPage"
import { seoPages } from "./seoPages"

function NotFoundPage() {
	return (
		<>
			<PageMeta
				title="Page Not Found - TooManyStreams"
				description="This page could not be found. TooManyStreams lets you watch multiple Twitch and YouTube streams at once in one browser tab."
				path="/"
				robots="noindex, follow"
			/>
			<main className="flex min-h-screen items-center justify-center px-6 py-12">
				<div className="mx-auto max-w-xl rounded-[2rem] border border-cyan-400/16 bg-slate-950/42 p-10 text-center shadow-[0_36px_90px_rgba(8,15,35,0.42)]">
					<p className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-300">
						404
					</p>
					<h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
						Page Not Found
					</h1>
					<p className="mt-4 text-slate-300/84">
						The page you are looking for does not exist. Head back to the
						stream wall and keep watching.
					</p>
					<div className="mt-7 flex justify-center">
						<Link
							to="/"
							className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 px-6 py-3.5 font-bold text-white shadow-[0_18px_30px_rgba(124,58,237,0.28)] transition-all duration-300 hover:-translate-y-px hover:shadow-[0_24px_40px_rgba(124,58,237,0.34)]"
						>
							<i className="fa-solid fa-play" />
							Back to TooManyStreams
						</Link>
					</div>
				</div>
			</main>
		</>
	)
}

export default function App() {
	return (
		<>
			<Routes>
				<Route path="/" element={<HomePage />} />
				{seoPages.map((seoPage) => (
					<Route
						key={seoPage.path}
						path={seoPage.path}
						element={
							<>
								<PageMeta
									title={seoPage.metaTitle}
									description={seoPage.metaDescription}
									path={seoPage.path}
									structuredData={seoPage.structuredData}
								/>
								<SeoPage {...seoPage.page} />
							</>
						}
					/>
				))}
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
			<Analytics />
		</>
	)
}
