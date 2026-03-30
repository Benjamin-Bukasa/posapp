const http = require("http");
const net = require("net");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const PORT = Number(process.env.PRINTER_SERVICE_PORT || 3210);
const HOST = process.env.PRINTER_SERVICE_HOST || "127.0.0.1";
const PRINTER_MODE = String(process.env.PRINTER_MODE || "windows").toLowerCase();
const PRINTER_NAME = process.env.PRINTER_NAME || "POS-80C";
const PRINTER_HOST = process.env.PRINTER_HOST || "";
const PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);
const ALLOWED_ORIGINS = String(
  process.env.PRINTER_ALLOWED_ORIGINS ||
    "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174",
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const json = (res, statusCode, payload, origin) => {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...buildCorsHeaders(origin),
  });
  res.end(body);
};

const buildCorsHeaders = (origin) => {
  const resolvedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || "*";

  return {
    "Access-Control-Allow-Origin": resolvedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
};

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error("Le corps de la requete est trop volumineux."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Corps JSON invalide."));
      }
    });

    req.on("error", reject);
  });

const sendNetworkPrint = (buffer, host, port) =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write(buffer, (error) => {
        if (error) {
          reject(error);
          socket.destroy();
          return;
        }

        socket.end();
      });
    });

    socket.setTimeout(7000);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Connexion a l'imprimante reseau expiree."));
    });
    socket.on("error", reject);
    socket.on("close", (hadError) => {
      if (!hadError) resolve();
    });
  });

const buildWindowsRawPrintScript = (filePath, printerName) => `
$printerName = ${JSON.stringify(printerName)}
$filePath = ${JSON.stringify(filePath)}
$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, DOCINFOA di);

  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

  public static void Send(string printerName, byte[] bytes) {
    IntPtr handle;
    if (!OpenPrinter(printerName, out handle, IntPtr.Zero)) {
      throw new Exception("Impossible d'ouvrir l'imprimante: " + printerName);
    }

    try {
      var doc = new DOCINFOA();
      doc.pDocName = "NeoPharma ESC/POS";
      doc.pDataType = "RAW";

      if (!StartDocPrinter(handle, 1, doc)) {
        throw new Exception("StartDocPrinter a echoue.");
      }

      try {
        if (!StartPagePrinter(handle)) {
          throw new Exception("StartPagePrinter a echoue.");
        }

        try {
          int written;
          if (!WritePrinter(handle, bytes, bytes.Length, out written) || written != bytes.Length) {
            throw new Exception("WritePrinter a echoue.");
          }
        } finally {
          EndPagePrinter(handle);
        }
      } finally {
        EndDocPrinter(handle);
      }
    } finally {
      ClosePrinter(handle);
    }
  }
}
"@

Add-Type -TypeDefinition $code
$bytes = [System.IO.File]::ReadAllBytes($filePath)
[RawPrinterHelper]::Send($printerName, $bytes)
`;

const sendWindowsPrint = (buffer, printerName) =>
  new Promise((resolve, reject) => {
    const tempFile = path.join(
      os.tmpdir(),
      `neopharma-receipt-${Date.now()}-${Math.random().toString(16).slice(2)}.bin`,
    );

    fs.writeFileSync(tempFile, buffer);

    const child = spawn(
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        buildWindowsRawPrintScript(tempFile, printerName),
      ],
      {
        windowsHide: true,
      },
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      try {
        fs.unlinkSync(tempFile);
      } catch (_error) {}
      reject(error);
    });

    child.on("close", (code) => {
      try {
        fs.unlinkSync(tempFile);
      } catch (_error) {}

      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() || "Le service d'impression Windows a retourne une erreur.",
          ),
        );
        return;
      }

      resolve();
    });
  });

const resolvePrintMode = (payload = {}) =>
  String(payload.mode || PRINTER_MODE || "windows").toLowerCase();

const handlePrint = async (payload) => {
  const contentBase64 = String(payload.contentBase64 || "");
  if (!contentBase64) {
    throw Object.assign(new Error("contentBase64 requis."), { status: 400 });
  }

  const buffer = Buffer.from(contentBase64, "base64");
  if (!buffer.length) {
    throw Object.assign(new Error("Le contenu du ticket est vide."), { status: 400 });
  }

  const mode = resolvePrintMode(payload);

  if (mode === "network") {
    const host = payload.host || PRINTER_HOST;
    const port = Number(payload.port || PRINTER_PORT || 9100);

    if (!host) {
      throw Object.assign(
        new Error("PRINTER_HOST ou host est requis pour le mode reseau."),
        { status: 400 },
      );
    }

    await sendNetworkPrint(buffer, host, port);
    return { mode, host, port };
  }

  if (mode === "windows") {
    const printerName = payload.printerName || PRINTER_NAME;
    if (!printerName) {
      throw Object.assign(
        new Error("PRINTER_NAME ou printerName est requis pour le mode windows."),
        { status: 400 },
      );
    }

    await sendWindowsPrint(buffer, printerName);
    return { mode, printerName };
  }

  throw Object.assign(new Error("Mode d'impression non supporte."), {
    status: 400,
  });
};

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";

  if (req.method === "OPTIONS") {
    res.writeHead(204, buildCorsHeaders(origin));
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    json(
      res,
      200,
      {
        status: "ok",
        mode: PRINTER_MODE,
        printerName: PRINTER_NAME,
        printerHost: PRINTER_HOST || null,
        printerPort: PRINTER_PORT,
      },
      origin,
    );
    return;
  }

  if (req.method === "POST" && req.url === "/print") {
    try {
      const body = await readJsonBody(req);
      const result = await handlePrint(body);
      json(
        res,
        200,
        {
          message: "Impression envoyee.",
          ...result,
        },
        origin,
      );
    } catch (error) {
      json(
        res,
        error.status || 500,
        {
          message:
            error.message || "Impossible d'envoyer le ticket a l'imprimante.",
        },
        origin,
      );
    }
    return;
  }

  json(res, 404, { message: "Route introuvable." }, origin);
});

server.listen(PORT, HOST, () => {
  console.log(
    `NeoPharma printer service listening on http://${HOST}:${PORT} (${PRINTER_MODE})`,
  );
});
