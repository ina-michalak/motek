import { execFileSync } from "node:child_process";

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let filePath;
  try {
    filePath = JSON.parse(input).tool_input?.file_path;
  } catch {
    process.exit(0);
  }

  if (!filePath || !/\.(ts|tsx|astro)$/.test(filePath)) {
    process.exit(0);
  }

  try {
    execFileSync("npx", ["eslint", filePath], { stdio: "pipe", shell: true });
    process.exit(0);
  } catch (err) {
    process.stderr.write(`ESLint znalazł błędy w ${filePath}:\n${err.stdout?.toString() ?? err.message}`);
    process.exit(2);
  }
});
