"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8791;
const ROOT = __dirname;
const UPSTREAM = {
  metar: "https://aviationweather.gov/api/data/metar",
  taf: "https://aviationweather.gov/api/data/taf"
};
const STATION_LIST_RE = /^[A-Za-z0-9]{3,4}(,[A-Za-z0-9]{3,4}){0,9}$/;

const MIME = { ".html": "text/html; charset=utf-8" };

function serveStatic(req, res){
  let reqPath = req.url === "/" ? "/index.html" : req.url;
  reqPath = reqPath.split("?")[0];
  const filePath = path.normalize(path.join(ROOT, reqPath));
  if (!filePath.startsWith(ROOT)){
    res.writeHead(403); res.end("Forbidden"); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err){ res.writeHead(404); res.end("Not found"); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

async function proxyWx(kind, req, res){
  const url = new URL(req.url, "http://localhost");
  const ids = (url.searchParams.get("ids") || "").trim();

  if (!STATION_LIST_RE.test(ids)){
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid or missing 'ids' parameter." }));
    return;
  }

  try {
    const upstreamRes = await fetch(`${UPSTREAM[kind]}?ids=${encodeURIComponent(ids)}&format=json`, {
      headers: { "Accept": "application/json" }
    });
    const body = (await upstreamRes.text()).trim() || "[]";
    res.writeHead(upstreamRes.status, { "Content-Type": "application/json" });
    res.end(body);
  } catch (err){
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Upstream request failed: " + err.message }));
  }
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/metar")){
    proxyWx("metar", req, res);
    return;
  }
  if (req.url.startsWith("/api/taf")){
    proxyWx("taf", req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`METAR Wx server running at http://localhost:${PORT}`);
});
