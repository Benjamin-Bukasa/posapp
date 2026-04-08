const http = require("node:http");
const { URL } = require("node:url");
const { listPrinters, printRaw } = require("./printerService");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3210);

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(payload));
};

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) {
        reject(Object.assign(new Error("Le payload depasse la taille autorisee."), { status: 413 }));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (_error) {
        reject(Object.assign(new Error("JSON invalide."), { status: 400 }));
      }
    });

    req.on("error", (error) => reject(error));
  });

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 404, { message: "Route introuvable." });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        status: "ok",
        service: "local-printer-service",
        host: HOST,
        port: PORT,
        platform: process.platform,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/printers") {
      const printers = await listPrinters();
      sendJson(res, 200, {
        count: printers.length,
        data: printers,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/print") {
      const body = await readJsonBody(req);
      const result = await printRaw({
        contentBase64: body.contentBase64,
        printerName: body.printerName,
        jobName: body.jobName,
      });

      sendJson(res, 200, {
        message: "Ticket envoye a l'imprimante.",
        ...result,
      });
      return;
    }

    sendJson(res, 404, { message: "Route introuvable." });
  } catch (error) {
    sendJson(res, error.status || 500, {
      message: error.message || "Erreur interne du service d'impression.",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `[local-printer-service] listening on http://${HOST}:${PORT} (${process.platform})`,
  );
});
