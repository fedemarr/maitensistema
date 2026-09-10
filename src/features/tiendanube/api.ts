import "server-only";

/**
 * Cliente mínimo de la API de Tiendanube (v1). Doc: tiendanube.github.io/api-documentation
 * Ojo: el header de auth es `Authentication`, no `Authorization`, y `User-Agent`
 * es obligatorio.
 */

const UA = "Maiten Sistema (fedenez11@gmail.com)";
const API = "https://api.tiendanube.com/v1";
const OAUTH = "https://www.tiendanube.com/apps/authorize/token";

export type TokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  user_id: number;
};

/** Intercambia el `code` del OAuth por un access_token + store_id. */
export async function intercambiarCodigo(code: string): Promise<TokenResponse> {
  const res = await fetch(OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({
      client_id: process.env.TIENDANUBE_APP_ID,
      client_secret: process.env.TIENDANUBE_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth Tiendanube ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function req<T>(
  storeId: string,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API}/${storeId}${path}`, {
    ...init,
    headers: {
      Authentication: `bearer ${token}`,
      "User-Agent": UA,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Tiendanube ${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export type TNOrder = {
  id: number;
  number: number;
  contact_email: string | null;
  contact_name: string | null;
  payment_status: string;
  gateway: string | null;
  created_at: string;
  products: {
    sku: string | null;
    name: string;
    quantity: number;
    price: string; // neto o bruto según la config de la tienda; ver webhook.ts
    product_id: number;
    variant_id: number;
  }[];
};

export const getOrder = (storeId: string, token: string, orderId: number) =>
  req<TNOrder>(storeId, token, `/orders/${orderId}`);

export type TNVariant = { id: number; product_id: number; sku: string | null; stock: number };
export type TNProduct = { id: number; variants: TNVariant[] };

/** Trae todos los productos con sus variantes (paginado). */
export async function getProductos(
  storeId: string,
  token: string,
): Promise<TNProduct[]> {
  const out: TNProduct[] = [];
  for (let page = 1; page <= 20; page++) {
    const chunk = await req<TNProduct[]>(
      storeId,
      token,
      `/products?fields=id,variants&per_page=200&page=${page}`,
    );
    out.push(...chunk);
    if (chunk.length < 200) break;
  }
  return out;
}

export const setVariantStock = (
  storeId: string,
  token: string,
  productId: number,
  variantId: number,
  stock: number,
) =>
  req(storeId, token, `/products/${productId}/variants/${variantId}`, {
    method: "PUT",
    body: JSON.stringify({ stock }),
  });

export type TNWebhook = { id: number; event: string; url: string };

export const listWebhooks = (storeId: string, token: string) =>
  req<TNWebhook[]>(storeId, token, `/webhooks`);

export const createWebhook = (
  storeId: string,
  token: string,
  event: string,
  url: string,
) =>
  req<TNWebhook>(storeId, token, `/webhooks`, {
    method: "POST",
    body: JSON.stringify({ event, url }),
  });

export const deleteWebhook = (storeId: string, token: string, id: number) =>
  req(storeId, token, `/webhooks/${id}`, { method: "DELETE" });
