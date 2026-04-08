const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const SCRIPTS_DIR = path.join(ROOT_DIR, "scripts");
const RUNTIME_SCRIPTS_DIR = path.join(os.tmpdir(), "posapp-local-printer-service", "scripts");

const resolveSystemRoot = () => process.env.SystemRoot || process.env.windir || "C:\\Windows";
const resolvePowerShellExecutable = () =>
  path.join(resolveSystemRoot(), "System32", "WindowsPowerShell", "v1.0", "powershell.exe");

const buildSpawnEnv = () => ({
  ...process.env,
  SystemRoot: resolveSystemRoot(),
  windir: resolveSystemRoot(),
  ComSpec: process.env.ComSpec || path.join(resolveSystemRoot(), "System32", "cmd.exe"),
});

const ensureWindows = () => {
  if (process.platform !== "win32") {
    const error = new Error(
      "Le service local d'impression est actuellement prevu pour Windows uniquement.",
    );
    error.status = 501;
    throw error;
  }
};

const parseJsonOutput = (stdout, fallbackMessage) => {
  const content = String(stdout || "").trim();
  if (!content) {
    const error = new Error(fallbackMessage);
    error.status = 500;
    throw error;
  }

  try {
    return JSON.parse(content);
  } catch (_error) {
    const error = new Error(content || fallbackMessage);
    error.status = 500;
    throw error;
  }
};

const ensureMaterializedScript = async (scriptFile) => {
  const sourcePath = path.join(SCRIPTS_DIR, scriptFile);

  if (!process.pkg) {
    return sourcePath;
  }

  await fs.mkdir(RUNTIME_SCRIPTS_DIR, { recursive: true });
  const runtimePath = path.join(RUNTIME_SCRIPTS_DIR, scriptFile);

  try {
    await fs.access(runtimePath);
    return runtimePath;
  } catch (_error) {
    const content = await fs.readFile(sourcePath, "utf8");
    await fs.writeFile(runtimePath, content, "utf8");
    return runtimePath;
  }
};

const runPowerShellScript = (scriptFile, args = []) =>
  new Promise((resolve, reject) => {
    const start = async () => {
      const scriptPath = await ensureMaterializedScript(scriptFile);
      const child = spawn(
        resolvePowerShellExecutable(),
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args],
        {
          cwd: ROOT_DIR,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          env: buildSpawnEnv(),
        },
      );

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        reject(error);
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        const error = new Error(
          String(stderr || stdout || "Le script PowerShell d'impression a echoue.").trim(),
        );
        error.status = 500;
        reject(error);
      });
    };

    start().catch(reject);
  });

const listPrinters = async () => {
  ensureWindows();
  const { stdout } = await runPowerShellScript("list-printers.ps1");
  const payload = parseJsonOutput(stdout, "Impossible de lister les imprimantes.");
  return Array.isArray(payload) ? payload : [];
};

const printRaw = async ({ contentBase64, printerName, jobName }) => {
  ensureWindows();

  if (!contentBase64 || typeof contentBase64 !== "string") {
    const error = new Error("contentBase64 requis.");
    error.status = 400;
    throw error;
  }

  let filePath = "";

  try {
    const buffer = Buffer.from(contentBase64, "base64");
    if (!buffer.length) {
      const error = new Error("Le ticket est vide.");
      error.status = 400;
      throw error;
    }

    filePath = path.join(os.tmpdir(), `posapp-ticket-${randomUUID()}.bin`);
    await fs.writeFile(filePath, buffer);

    const { stdout } = await runPowerShellScript("print-raw.ps1", [
      "-FilePath",
      filePath,
      "-PrinterName",
      printerName || "",
      "-JobName",
      jobName || "POSapp Ticket",
    ]);

    return parseJsonOutput(stdout, "Impossible d'imprimer le ticket.");
  } finally {
    if (filePath) {
      await fs.unlink(filePath).catch(() => {});
    }
  }
};

module.exports = {
  listPrinters,
  printRaw,
};
