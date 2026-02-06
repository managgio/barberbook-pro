import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(frontendDir, "..");
const distDir = path.join(frontendDir, "dist");
const docsPerfDir = path.join(repoRoot, "docs", "perf");
const reportJsonPath = path.join(docsPerfDir, "bundle-report.json");
const reportMdPath = path.join(docsPerfDir, "PERF_BASELINE.md");

const ensureExists = (targetPath, label) => {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found at ${targetPath}. Run "npm run build:perf" first.`);
  }
};

const sizeOf = (targetPath) => fs.statSync(targetPath).size;
const gzipSizeOf = (targetPath) => zlib.gzipSync(fs.readFileSync(targetPath)).length;
const kb = (bytes) => Number((bytes / 1024).toFixed(2));

const parseAssetPathFromHtml = (html, type) => {
  const regex = type === "js"
    ? /<script[^>]+src="\/(assets\/[^"]+\.js)"/i
    : /<link[^>]+href="\/(assets\/[^"]+\.css)"/i;
  const match = html.match(regex);
  return match ? match[1] : null;
};

const packageNameFromSourcePath = (sourcePath) => {
  const split = sourcePath.split("node_modules/");
  if (split.length < 2) return null;
  const pkgPath = split[1];
  const parts = pkgPath.split("/");
  if (parts[0].startsWith("@")) return `${parts[0]}/${parts[1] || ""}`;
  return parts[0] || null;
};

const topEntries = (map, limit = 10) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, bytes]) => ({ name, bytes, kb: kb(bytes) }));

const buildSourcemapInsights = (mapPaths) => {
  if (!Array.isArray(mapPaths) || mapPaths.length === 0) {
    return {
      sourceMapFound: false,
      analyzedChunkCount: 0,
      topNodeModulesBySourceBytes: [],
      topSourceFilesBySourceBytes: [],
      topSourceAreasBySourceBytes: [],
    };
  }

  const pkgBytes = new Map();
  const srcFileBytes = new Map();
  const srcAreaBytes = new Map();
  let analyzedChunkCount = 0;

  mapPaths.forEach((mapPath) => {
    if (!fs.existsSync(mapPath)) return;
    analyzedChunkCount += 1;
    const raw = fs.readFileSync(mapPath, "utf8");
    const sourceMap = JSON.parse(raw);

    for (let i = 0; i < sourceMap.sources.length; i += 1) {
      const sourcePath = sourceMap.sources[i] || "";
      const sourceContent = (sourceMap.sourcesContent && sourceMap.sourcesContent[i]) || "";
      const bytes = Buffer.byteLength(sourceContent, "utf8");

      const pkg = packageNameFromSourcePath(sourcePath);
      if (pkg) {
        pkgBytes.set(pkg, (pkgBytes.get(pkg) || 0) + bytes);
      }

      const srcSplit = sourcePath.split("/src/");
      if (!pkg && srcSplit.length > 1) {
        const relativeSource = srcSplit[1];
        srcFileBytes.set(relativeSource, (srcFileBytes.get(relativeSource) || 0) + bytes);

        const area = relativeSource.includes("/") ? relativeSource.split("/")[0] : relativeSource;
        srcAreaBytes.set(area, (srcAreaBytes.get(area) || 0) + bytes);
      }
    }
  });

  return {
    sourceMapFound: analyzedChunkCount > 0,
    analyzedChunkCount,
    topNodeModulesBySourceBytes: topEntries(pkgBytes, 15),
    topSourceFilesBySourceBytes: topEntries(srcFileBytes, 15),
    topSourceAreasBySourceBytes: topEntries(srcAreaBytes, 10),
  };
};

const collectImageStats = (assetsDir) => {
  const imageExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg", ".ico"]);
  const files = fs.readdirSync(assetsDir, { withFileTypes: true })
    .filter((item) => item.isFile())
    .map((item) => item.name)
    .filter((name) => imageExt.has(path.extname(name).toLowerCase()))
    .map((name) => {
      const absolute = path.join(assetsDir, name);
      return {
        name,
        bytes: sizeOf(absolute),
        kb: kb(sizeOf(absolute)),
      };
    })
    .sort((a, b) => b.bytes - a.bytes);

  return {
    files,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    largestFileBytes: files[0]?.bytes || 0,
  };
};

const toBudgetStatus = (actualBytes, maxBytes) => ({
  actualBytes,
  maxBytes,
  pass: actualBytes <= maxBytes,
});

const renderMarkdown = (report) => {
  const lines = [];
  lines.push("# PERF_BASELINE");
  lines.push("");
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push("");
  lines.push("## Build Summary");
  lines.push("");
  lines.push(`- Entry JS: ${report.entry.js.file} (${report.entry.js.rawBytes} B raw, ${report.entry.js.gzipBytes} B gzip)`);
  lines.push(`- Entry CSS: ${report.entry.css.file} (${report.entry.css.rawBytes} B raw, ${report.entry.css.gzipBytes} B gzip)`);
  lines.push(`- Total image bytes in dist/assets: ${report.images.totalBytes} B`);
  lines.push(`- Largest image in dist/assets: ${report.images.files[0]?.name || "n/a"} (${report.images.largestFileBytes} B)`);
  if (report.sourcemap.sourceMapFound) {
    lines.push(`- Sourcemap chunks analyzed: ${report.sourcemap.analyzedChunkCount}`);
  }
  lines.push("");
  lines.push("## Top Node Modules By Source Bytes");
  lines.push("");
  lines.push("| Package | Bytes |");
  lines.push("|---|---:|");
  report.sourcemap.topNodeModulesBySourceBytes.forEach((item) => {
    lines.push(`| ${item.name} | ${item.bytes} |`);
  });
  lines.push("");
  lines.push("## Top Source Files By Source Bytes");
  lines.push("");
  lines.push("| File | Bytes |");
  lines.push("|---|---:|");
  report.sourcemap.topSourceFilesBySourceBytes.forEach((item) => {
    lines.push(`| ${item.name} | ${item.bytes} |`);
  });
  lines.push("");
  lines.push("## Top Source Areas By Source Bytes");
  lines.push("");
  lines.push("| Area | Bytes |");
  lines.push("|---|---:|");
  report.sourcemap.topSourceAreasBySourceBytes.forEach((item) => {
    lines.push(`| ${item.name} | ${item.bytes} |`);
  });
  lines.push("");
  lines.push("## Budget Snapshot");
  lines.push("");
  lines.push("| Metric | Actual (bytes) | Max (bytes) | Pass |");
  lines.push("|---|---:|---:|:---:|");
  Object.entries(report.budgets).forEach(([key, value]) => {
    lines.push(`| ${key} | ${value.actualBytes} | ${value.maxBytes} | ${value.pass ? "yes" : "no"} |`);
  });
  lines.push("");
  lines.push("## Largest Images");
  lines.push("");
  lines.push("| Asset | Bytes |");
  lines.push("|---|---:|");
  report.images.files.slice(0, 10).forEach((item) => {
    lines.push(`| ${item.name} | ${item.bytes} |`);
  });
  lines.push("");
  return lines.join("\n");
};

const run = () => {
  ensureExists(distDir, "dist directory");
  const indexHtmlPath = path.join(distDir, "index.html");
  ensureExists(indexHtmlPath, "dist/index.html");
  const assetsDir = path.join(distDir, "assets");
  ensureExists(assetsDir, "dist/assets");

  const budgetsPath = path.join(frontendDir, "perf-budgets.json");
  ensureExists(budgetsPath, "perf-budgets.json");
  const budgetsConfig = JSON.parse(fs.readFileSync(budgetsPath, "utf8"));

  const html = fs.readFileSync(indexHtmlPath, "utf8");
  const jsAsset = parseAssetPathFromHtml(html, "js");
  const cssAsset = parseAssetPathFromHtml(html, "css");
  if (!jsAsset || !cssAsset) {
    throw new Error("Could not detect entry JS/CSS assets in dist/index.html.");
  }

  const jsPath = path.join(distDir, jsAsset);
  const cssPath = path.join(distDir, cssAsset);
  ensureExists(jsPath, "entry JS");
  ensureExists(cssPath, "entry CSS");

  const entry = {
    js: {
      file: jsAsset,
      rawBytes: sizeOf(jsPath),
      gzipBytes: gzipSizeOf(jsPath),
    },
    css: {
      file: cssAsset,
      rawBytes: sizeOf(cssPath),
      gzipBytes: gzipSizeOf(cssPath),
    },
  };

  const images = collectImageStats(assetsDir);
  images.largestFileBytes = images.files[0]?.bytes || 0;

  const jsChunkFiles = fs.readdirSync(assetsDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join(assetsDir, `${name}.map`));
  const sourcemap = buildSourcemapInsights(jsChunkFiles);

  const budgets = {
    entryJsRawMaxBytes: toBudgetStatus(entry.js.rawBytes, budgetsConfig.entryJsRawMaxBytes),
    entryJsGzipMaxBytes: toBudgetStatus(entry.js.gzipBytes, budgetsConfig.entryJsGzipMaxBytes),
    entryCssRawMaxBytes: toBudgetStatus(entry.css.rawBytes, budgetsConfig.entryCssRawMaxBytes),
    entryCssGzipMaxBytes: toBudgetStatus(entry.css.gzipBytes, budgetsConfig.entryCssGzipMaxBytes),
    totalImageBytesMaxBytes: toBudgetStatus(images.totalBytes, budgetsConfig.totalImageBytesMaxBytes),
    largestImageBytesMaxBytes: toBudgetStatus(images.largestFileBytes, budgetsConfig.largestImageBytesMaxBytes),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    entry,
    images,
    sourcemap,
    budgets,
  };

  fs.mkdirSync(docsPerfDir, { recursive: true });
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(reportMdPath, renderMarkdown(report));

  const failed = Object.values(budgets).filter((item) => !item.pass).length;
  const status = failed === 0 ? "PASS" : `FAIL (${failed} budget checks failed)`;
  console.log(`Performance report written to ${reportJsonPath}`);
  console.log(`Performance baseline written to ${reportMdPath}`);
  console.log(`Budget snapshot: ${status}`);
};

run();
