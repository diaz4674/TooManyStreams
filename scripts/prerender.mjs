// Post-build prerender step (runs via `npm run build`).
// For each SEO landing page it writes dist/<route>/index.html containing the
// route's real title/description/canonical/JSON-LD and the fully rendered
// page markup, so crawlers and social scrapers get everything without JS.
// The client app still takes over on load and re-renders the same content.
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { createServer } from "vite"

const SITE_ORIGIN = "https://toomanystreams.app"
const HEAD_REGION =
	/[ \t]*<!-- page-head:start[^>]*-->[\s\S]*?<!-- page-head:end -->/

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
}

function structuredDataScript(entry) {
	// The data attribute lets the client-side PageMeta component remove these
	// before inserting its own copy, avoiding duplicate JSON-LD blocks.
	const json = JSON.stringify(entry).replaceAll("<", "\\u003C")
	return `<script type="application/ld+json" data-page-meta-structured-data="true">${json}</script>`
}

function buildHead(seoPage) {
	const canonicalUrl = `${SITE_ORIGIN}${seoPage.path}`
	const previewUrl = `${SITE_ORIGIN}/preview.png`
	const title = escapeHtml(seoPage.metaTitle)
	const description = escapeHtml(seoPage.metaDescription)
	const structuredData = Array.isArray(seoPage.structuredData)
		? seoPage.structuredData
		: seoPage.structuredData
			? [seoPage.structuredData]
			: []

	const lines = [
		`<title>${title}</title>`,
		`<meta name="description" content="${description}" />`,
		`<meta name="robots" content="index, follow" />`,
		`<link rel="canonical" href="${canonicalUrl}" />`,
		`<meta property="og:title" content="${title}" />`,
		`<meta property="og:description" content="${description}" />`,
		`<meta property="og:image" content="${previewUrl}" />`,
		`<meta property="og:url" content="${canonicalUrl}" />`,
		`<meta property="og:type" content="website" />`,
		`<meta property="og:site_name" content="TooManyStreams" />`,
		`<meta name="twitter:card" content="summary_large_image" />`,
		`<meta name="twitter:title" content="${title}" />`,
		`<meta name="twitter:description" content="${description}" />`,
		`<meta name="twitter:image" content="${previewUrl}" />`,
		...structuredData.map(structuredDataScript),
	]

	return lines.map((line) => `\t\t${line}`).join("\n")
}

async function main() {
	const distDir = path.resolve("dist")
	const template = await readFile(path.join(distDir, "index.html"), "utf8")

	if (!HEAD_REGION.test(template)) {
		throw new Error(
			"dist/index.html is missing the <!-- page-head:start/end --> markers",
		)
	}

	const vite = await createServer({
		server: { middlewareMode: true },
		appType: "custom",
		logLevel: "error",
	})

	try {
		const { seoPages, renderPage } = await vite.ssrLoadModule(
			"/src/entry-prerender.jsx",
		)

		for (const seoPage of seoPages) {
			const html = template
				.replace(HEAD_REGION, buildHead(seoPage))
				.replace(
					'<div id="root"></div>',
					`<div id="root">${renderPage(seoPage)}</div>`,
				)

			const outDir = path.join(distDir, ...seoPage.path.split("/").filter(Boolean))
			await mkdir(outDir, { recursive: true })
			await writeFile(path.join(outDir, "index.html"), html)
			console.log(`prerendered ${seoPage.path}`)
		}
	} finally {
		await vite.close()
	}
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
