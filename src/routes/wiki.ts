import { Router } from "express";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

/**
 * Player-facing docs: markdown files in `docs/wiki/` (one page per file, ordered by the
 * numeric prefix, slug = file name without the prefix) and `docs/CHANGELOG.md`.
 * The first `# Heading` of a file is the page title.
 */
const docsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docs");
const CHANGELOG_SLUG = "changelog";

interface WikiPage {
  slug: string;
  title: string;
  html: string;
}

function toPage(slug: string, markdown: string): WikiPage {
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1].trim() ?? slug;
  return { slug, title, html: marked.parse(markdown, { async: false }) };
}

async function loadPages(): Promise<WikiPage[]> {
  const files = (await readdir(path.join(docsDir, "wiki"))).filter((f) => f.endsWith(".md")).sort();
  const pages = await Promise.all(
    files.map(async (f) => toPage(f.replace(/^\d+-/, "").replace(/\.md$/, ""), await readFile(path.join(docsDir, "wiki", f), "utf8"))),
  );
  pages.push(toPage(CHANGELOG_SLUG, await readFile(path.join(docsDir, "CHANGELOG.md"), "utf8")));
  return pages;
}

// Docs only change with a deploy, so they are read once and cached.
let cache: Promise<WikiPage[]> | null = null;
const getPages = () => (cache ??= loadPages().catch((err) => { cache = null; throw err; }));

export const wikiRouter = Router();

/** Table of contents. Open without login. */
wikiRouter.get("/", async (_req, res) => {
  const pages = await getPages();
  res.json({ pages: pages.map(({ slug, title }) => ({ slug, title })), changelog: CHANGELOG_SLUG });
});

wikiRouter.get("/:slug", async (req, res) => {
  const page = (await getPages()).find((p) => p.slug === req.params.slug);
  if (!page) return res.status(404).json({ error: "Страница не найдена" });
  res.json(page);
});
