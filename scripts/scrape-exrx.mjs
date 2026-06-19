#!/usr/bin/env node
/**
 * Scrape ExRx.net exercise catalog into TrainForge data directory.
 *
 * Usage:
 *   node scripts/scrape-exrx.mjs discover
 *   node scripts/scrape-exrx.mjs scrape [--limit N] [--resume]
 *   node scripts/scrape-exrx.mjs all [--limit N]
 *
 * Output:
 *   data/exrx/urls.json          — discovered exercise URLs
 *   data/exrx/exercises.json     — scraped metadata
 *   data/exrx/progress.json      — resume checkpoint
 *   ../trainforge-web/public/exercises/media/ — downloaded thumbnails
 */

import { chromium } from "playwright";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(API_ROOT, "data", "exrx");
const MEDIA_DIR = path.resolve(API_ROOT, "..", "trainforge-web", "public", "exercises", "media");
const URLS_FILE = path.join(DATA_DIR, "urls.json");
const EXERCISES_FILE = path.join(DATA_DIR, "exercises.json");
const PROGRESS_FILE = path.join(DATA_DIR, "progress.json");

const LIST_SEEDS = [
  "https://exrx.net/XLists/ExList/NeckWt",
  "https://exrx.net/XLists/ExList/ShouldWt",
  "https://exrx.net/XLists/ExList/ArmWt",
  "https://exrx.net/XLists/ExList/ForeArmWt",
  "https://exrx.net/XLists/ExList/BackWt",
  "https://exrx.net/XLists/ExList/ChestWt",
  "https://exrx.net/XLists/ExList/WaistWt",
  "https://exrx.net/XLists/ExList/HipsWt",
  "https://exrx.net/XLists/ExList/ThighWt",
  "https://exrx.net/XLists/ExList/CalfWt",
  "https://exrx.net/Lists/ExList/CalfWt",
  "https://exrx.net/XLists/OlympicWeightlifting",
  "https://exrx.net/XLists/PowerExercises",
  "https://exrx.net/XLists/CardioExercises",
  "https://exrx.net/XLists/KettlebellExercises",
  "https://exrx.net/XLists/OtherExercises",
];

const EXERCISE_PATH_RE =
  /\/(WeightExercises|Plyometrics|Stretches|Aerobic|Kettlebell|OlympicLifts|Miscellaneous)\//;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function slugFromUrl(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  return parts.slice(-2).join("--");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDirs() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(MEDIA_DIR, { recursive: true });
}

async function readJson(file, fallback) {
  try {
    await access(file);
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function createBrowser() {
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  return { browser, page };
}

async function gotoAndWait(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(8000);
}

async function discoverUrls(page) {
  const discovered = new Map();

  for (const seed of LIST_SEEDS) {
    console.log(`Discovering from ${seed}`);
    await gotoAndWait(page, seed);

    const links = await page.evaluate((patternSource) => {
      const pattern = new RegExp(patternSource);
      const hrefs = new Set();
      for (const anchor of document.querySelectorAll("a[href]")) {
        const href = anchor.getAttribute("href");
        if (!href) continue;
        const full = new URL(href, location.href).href.split("#")[0];
        if (pattern.test(full)) hrefs.add(full);
      }
      return [...hrefs];
    }, EXERCISE_PATH_RE.source);

    for (const link of links) {
      if (!discovered.has(link)) {
        discovered.set(link, { url: link, slug: slugFromUrl(link), listSeed: seed });
      }
    }
    console.log(`  +${links.length} links (total unique: ${discovered.size})`);
  }

  const urls = [...discovered.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  await writeJson(URLS_FILE, { discoveredAt: new Date().toISOString(), count: urls.length, urls });
  console.log(`Saved ${urls.length} exercise URLs to ${URLS_FILE}`);
  return urls;
}

async function scrapeExercisePage(page, url) {
  await gotoAndWait(page, url);

  return page.evaluate(() => {
    const clean = (value) => value?.replace(/\s+/g, " ").trim() ?? "";

    const name = clean(document.querySelector("h1")?.textContent);
    const tableRows = [...document.querySelectorAll("table tr")].map((row) =>
      [...row.querySelectorAll("td, th")].map((cell) => clean(cell.textContent)),
    );

    const meta = {};
    for (const [label, value] of tableRows) {
      if (!label || !value) continue;
      const key = label.replace(":", "").toLowerCase();
      meta[key] = value;
    }

    const vimeoIframe = document.querySelector('iframe[src*="vimeo.com"]');
    const vimeoSrc = vimeoIframe?.getAttribute("src") ?? "";
    const vimeoMatch = vimeoSrc.match(/vimeo\.com\/video\/(\d+)/);
    const vimeoId = vimeoMatch?.[1] ?? null;

    const videoEl = document.querySelector("video");
    const videoUrl =
      videoEl?.querySelector("source")?.getAttribute("src") ?? videoEl?.getAttribute("src") ?? null;

    const thumbnails = [...document.querySelectorAll("img.ccm-output-thumbnail")]
      .map((img) => img.getAttribute("src"))
      .filter(Boolean);

    const isPremium = !!document.querySelector('img[alt="All Exercises"]');

    const blocks = [...document.querySelectorAll("h2, h3, h4, p, li")]
      .map((el) => ({ tag: el.tagName, text: clean(el.textContent) }))
      .filter((item) => item.text.length > 0);

    let preparation = "";
    let execution = "";
    const instructions = [];

    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (block.text === "Preparation" && blocks[i + 1]?.tag === "P") {
        preparation = blocks[i + 1].text;
      }
      if (block.text === "Execution" && blocks[i + 1]?.tag === "P") {
        execution = blocks[i + 1].text;
      }
    }

    if (execution) instructions.push(execution);
    if (preparation) instructions.unshift(preparation);

    const breadcrumb = clean(
      document.querySelector(".breadcrumb, nav")?.textContent?.slice(0, 200) ?? "",
    );

    const pathParts = location.pathname.split("/").filter(Boolean);
    const category = pathParts[0] ?? "Unknown";
    const muscleGroup = pathParts[1] ?? null;

    return {
      name,
      sourceUrl: location.href,
      category,
      muscleGroup,
      utility: meta.utility ?? null,
      mechanics: meta.mechanics ?? null,
      force: meta.force ?? null,
      preparation,
      execution,
      instructions,
      thumbnailUrl: thumbnails[0] ?? null,
      relatedThumbnails: thumbnails.slice(1),
      vimeoId,
      videoUrl,
      isPremium,
      breadcrumb,
    };
  });
}

async function downloadThumbnail(slug, thumbnailUrl, page) {
  if (!thumbnailUrl) return null;

  const extMatch = thumbnailUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
  const filename = `${slug}.${ext}`;
  const dest = path.join(MEDIA_DIR, filename);

  try {
    const response = await page.request.get(thumbnailUrl);
    if (!response.ok()) return null;
    const buffer = await response.body();
    await writeFile(dest, buffer);
    return `/exercises/media/${filename}`;
  } catch (error) {
    console.warn(`  thumbnail download failed for ${slug}:`, error.message);
    return null;
  }
}

async function scrapeExercises(page, { limit = Infinity, resume = false } = {}) {
  const urlBundle = await readJson(URLS_FILE, null);
  if (!urlBundle?.urls?.length) {
    throw new Error("No URLs found. Run `node scripts/scrape-exrx.mjs discover` first.");
  }

  const existing = resume ? await readJson(EXERCISES_FILE, { exercises: [] }) : { exercises: [] };
  const done = new Set(existing.exercises.map((item) => item.sourceUrl));
  const progress = resume ? await readJson(PROGRESS_FILE, { completed: 0 }) : { completed: 0 };

  const targets = urlBundle.urls.filter((item) => !done.has(item.url)).slice(0, limit);
  console.log(`Scraping ${targets.length} exercises (${done.size} already done, ${urlBundle.urls.length} total)`);

  for (const [index, item] of targets.entries()) {
    const label = `[${progress.completed + index + 1}/${urlBundle.urls.length}] ${item.slug}`;
    console.log(label);

    try {
      const scraped = await scrapeExercisePage(page, item.url);
      const localThumbnail = await downloadThumbnail(item.slug, scraped.thumbnailUrl, page);

      const record = {
        id: createHash("sha256").update(item.url).digest("hex").slice(0, 32),
        slug: item.slug,
        listSeed: item.listSeed,
        ...scraped,
        localThumbnail,
        scrapedAt: new Date().toISOString(),
      };

      existing.exercises.push(record);
      done.add(item.url);
      progress.completed += 1;
      progress.lastSlug = item.slug;
      progress.updatedAt = new Date().toISOString();

      if ((index + 1) % 10 === 0 || index === targets.length - 1) {
        await writeJson(EXERCISES_FILE, {
          scrapedAt: new Date().toISOString(),
          count: existing.exercises.length,
          exercises: existing.exercises,
        });
        await writeJson(PROGRESS_FILE, progress);
      }

      await sleep(1500);
    } catch (error) {
      console.error(`  failed: ${error.message}`);
      await writeJson(PROGRESS_FILE, {
        ...progress,
        lastError: { slug: item.slug, message: error.message, at: new Date().toISOString() },
      });
    }
  }

  await writeJson(EXERCISES_FILE, {
    scrapedAt: new Date().toISOString(),
    count: existing.exercises.length,
    exercises: existing.exercises,
  });
  await writeJson(PROGRESS_FILE, progress);
  console.log(`Done. ${existing.exercises.length} exercises saved to ${EXERCISES_FILE}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
  const resume = args.includes("--resume");

  await ensureDirs();
  const { browser, page } = await createBrowser();

  try {
    if (command === "discover") {
      await discoverUrls(page);
    } else if (command === "scrape") {
      await scrapeExercises(page, { limit, resume });
    } else if (command === "all") {
      await discoverUrls(page);
      await scrapeExercises(page, { limit, resume });
    } else {
      console.log(`Usage:
  node scripts/scrape-exrx.mjs discover
  node scripts/scrape-exrx.mjs scrape [--limit=N] [--resume]
  node scripts/scrape-exrx.mjs all [--limit=N] [--resume]`);
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
