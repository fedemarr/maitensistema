import "server-only";

import https from "node:https";

/**
 * POST SOAP contra un servicio de AFIP usando `https` (no `fetch`): los
 * servidores de AFIP negocian un DHE de 1024 bits, que el nivel de
 * seguridad por defecto de OpenSSL 3 (Node 18+) rechaza con
 * "dh key too small". Se baja el nivel solo para esta conexión.
 */
export function soapPost(
  url: string,
  body: string,
  soapAction: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: soapAction,
          "Content-Length": Buffer.byteLength(body),
        },
        ciphers: "DEFAULT@SECLEVEL=1",
        minVersion: "TLSv1.2",
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
