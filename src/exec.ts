import { spawn } from "node:child_process";

export async function execFile(
  file: string,
  args: string[],
  opts?: {
    cwd?: string;
  },
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(file, args, {
      stdio: "inherit",
      cwd: opts?.cwd,
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code: number | null) => {
      if (code === 0) resolve();
      else reject(new Error(`${file} exited with code ${code ?? "null"}`));
    });
  });
}
