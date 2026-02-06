import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(frontendDir, "..");
const reportPath = path.join(repoRoot, "docs", "perf", "bundle-report.json");

if (!fs.existsSync(reportPath)) {
  console.error(`Missing ${reportPath}. Run "npm run perf:report" first.`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const budgets = report.budgets || {};
const failures = Object.entries(budgets).filter(([, value]) => !value.pass);

if (failures.length === 0) {
  console.log("Performance budgets: PASS");
  process.exit(0);
}

console.error("Performance budgets: FAIL");
failures.forEach(([name, value]) => {
  console.error(`- ${name}: actual=${value.actualBytes} max=${value.maxBytes}`);
});
process.exit(1);
