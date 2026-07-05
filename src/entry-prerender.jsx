// Server-side entry used only by scripts/prerender.mjs at build time.
// Renders each SEO landing page to static HTML so crawlers see full content
// without executing JavaScript. Deliberately avoids importing HomePage or
// anything that touches browser APIs.
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import SeoPage from "./components/SeoPage"
import { seoPages } from "./seoPages"

export { seoPages }

export function renderPage(seoPage) {
	return renderToStaticMarkup(
		<MemoryRouter initialEntries={[seoPage.path]}>
			<SeoPage {...seoPage.page} />
		</MemoryRouter>,
	)
}
