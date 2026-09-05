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
    execFileSync("npm", ["run", "typecheck"], { stdio: "pipe", shell: true });
    process.exit(0);
  } catch (err) {
    const output = err.stdout?.toString() ?? err.message;
    const fileName = filePath.split(/[\\/]/).pop();
    if (!output.includes(fileName)) {
      // Error exists elsewhere in the project, unrelated to this edit — don't block on it.
      process.exit(0);
    }
    process.stderr.write(`Sprawdzanie typów nie przeszło po edycji ${filePath}:\n${output}`);
    process.exit(2);
  }
});
