// src/lib/apiUser.ts
//
// Frontend API helpers for the User app (PWA).
// - Every request is prefixed by API_BASE.
// - Keeps your legacy names (apiGetMe, apiUserMint, KEY_USER_WALLET, etc).
// - Strong types, no "any".

// ---------- API base ----------
export const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") || "http://localhost:4000") as string;

// ---------- Storage keys ----------
export const KEY_USER_WALLET = "user.wallet";

// ---------- Types ----------
export type PricePayload = {
  source: string;
  price_myr_per_g: number;
  buy_myr_per_g: number;
  sell_myr_per_g: number;
  user_buy_myr_per_g: number;
  user_sell_myr_per_g: number;
  spread_myr_per_g: number;
  spread_bps: number;
  effective_date: string | null;
  last_updated: string | null;
  note?: string | null;
  created_at: string;
};
export type ApiPriceResponse = { data: PricePayload };

export type UserRow = {
  id: number;
  wallet_address: `0x${string}`;
  email: string | null;
  created_at: string;
  updated_at: string;
  rm_spent: number;
};

export type BalancesPayload = {
  rm_balance_myr: number;
  oumg_balance_g: number;
};

export type ActivityItem = {
  id: number;
  user_id: number;
  op_type: "BUY_MINT" | "SELL_BURN";
  grams: number;
  amount_myr: number;
  price_myr_per_g: number;
  tx_hash: `0x${string}` | null;
  created_at: string;
  wallet_address: `0x${string}`;
  note: string | null;
};

export type PaginatedActivity = {
  limit: number;
  offset: number;
  data: ActivityItem[];
};

export type RegisterRequest = { email?: string };
export type MintBurnRequest = { grams: number };

// ---------- Utils ----------
function isHexAddress(addr: string): addr is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function toLowerAddress(addr: string): `0x${string}` {
  const a = addr.toLowerCase();
  if (!isHexAddress(a)) throw new Error("Invalid address");
  return a;
}

function buildHeaders(userWallet?: `0x${string}`): HeadersInit {
  // 注意：不要在这里加入非必要的自定义请求头，以减少不必要的预检
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (userWallet) h["X-User-Wallet"] = userWallet;
  return h;
}

async function handleJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }
}

function qs(params: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && `${v}` !== "") u.set(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : "";
}

function url(path: string): string {
  // ensure single slash join
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

// ---------- Local storage helpers ----------
export function getStoredUserWallet(): `0x${string}` | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY_USER_WALLET);
  return raw && isHexAddress(raw) ? (raw as `0x${string}`) : null;
}

export function setStoredUserWallet(addr: `0x${string}`): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_USER_WALLET, addr);
}

export function clearStoredUserWallet(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_USER_WALLET);
}

// ---------- Price ----------
export async function getCurrentPrice(signal?: AbortSignal): Promise<PricePayload> {
  // 关键：不用自定义 Cache-Control 请求头，改用 fetch 的 cache 选项避免预检
  const res = await fetch(url("/api/price/current"), {
    method: "GET",
    cache: "no-store",
    signal,
    credentials: "omit",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Failed to fetch price (${res.status})`);
  }
  const json = (await res.json()) as ApiPriceResponse;
  return json.data;
}

// ---------- MetaMask connect ----------
export async function connectMetaMask(): Promise<`0x${string}`> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("MetaMask not detected");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ethereum = (window as any).ethereum;
  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as unknown;
  const addr = Array.isArray(accounts) && accounts.length > 0 ? String(accounts[0]).toLowerCase() : "";
  if (!isHexAddress(addr)) throw new Error("Failed to get wallet");
  return addr as `0x${string}`;
}

// ---------- User endpoints (X-User-Wallet) ----------
export async function registerUser(
  userWallet: `0x${string}`,
  body: RegisterRequest
): Promise<{ success: true }> {
  const res = await fetch(url("/api/user/register"), {
    method: "POST",
    headers: buildHeaders(userWallet),
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
    credentials: "omit",
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `Register failed (${res.status})`);
  }
  return { success: true };
}

export async function getMe(userWallet: `0x${string}`): Promise<UserRow> {
  const res = await fetch(url("/api/user/me"), {
    method: "GET",
    headers: buildHeaders(userWallet),
    cache: "no-store",
    credentials: "omit",
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `GetMe failed (${res.status})`);
  }
  const data = await handleJson<{ data: UserRow }>(res);
  return data.data;
}

export async function getBalances(userWallet: `0x${string}`): Promise<BalancesPayload> {
  const res = await fetch(url("/api/user/balances"), {
    method: "GET",
    headers: buildHeaders(userWallet),
    cache: "no-store",
    credentials: "omit",
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `Get balances failed (${res.status})`);
  }
  const data = await handleJson<{ data: BalancesPayload }>(res);
  return data.data;
}

export async function getActivity(
  userWallet: `0x${string}`,
  params?: { limit?: number; offset?: number }
): Promise<PaginatedActivity> {
  const res = await fetch(
    url(`/api/user/activity${qs({ limit: params?.limit, offset: params?.offset })}`),
    {
      method: "GET",
      headers: buildHeaders(userWallet),
      cache: "no-store",
      credentials: "omit",
    }
  );
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `Get activity failed (${res.status})`);
  }
  return handleJson<PaginatedActivity>(res);
}

export async function userMint(
  userWallet: `0x${string}`,
  req: MintBurnRequest
): Promise<{ txHash: `0x${string}`; grams: number; amountMyr: number; price_myr_per_g: number }> {
  if (!(req.grams > 0)) throw new Error("grams must be > 0");
  const res = await fetch(url("/api/user/mint"), {
    method: "POST",
    headers: buildHeaders(userWallet),
    body: JSON.stringify(req),
    cache: "no-store",
    credentials: "omit",
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `Mint failed (${res.status})`);
  }
  return handleJson(res);
}

export async function userBurn(
  userWallet: `0x${string}`,
  req: MintBurnRequest
): Promise<{ txHash: `0x${string}`; grams: number; amountMyr: number; price_myr_per_g: number }> {
  if (!(req.grams > 0)) throw new Error("grams must be > 0");
  const res = await fetch(url("/api/user/burn"), {
    method: "POST",
    headers: buildHeaders(userWallet),
    body: JSON.stringify(req),
    cache: "no-store",
    credentials: "omit",
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `Burn failed (${res.status})`);
  }
  return handleJson(res);
}

// ---------- Convenience ----------
export async function loginAndEnsureUser(
  autoRegisterEmail?: string | undefined
): Promise<{ wallet: `0x${string}`; me: UserRow | null }> {
  const wallet = await connectMetaMask();
  try {
    const me = await getMe(wallet);
    return { wallet, me };
  } catch (e) {
    const msg = (e as Error)?.message || "";
    if (msg.includes("404") || /not\s*found/i.test(msg)) {
      await registerUser(wallet, { email: autoRegisterEmail });
      const me2 = await getMe(wallet);
      return { wallet, me: me2 };
    }
    throw e;
  }
}

// ---------- Format helpers ----------
export function formatRM(n: number, fraction = 2): string {
  if (!Number.isFinite(n)) return "RM —";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(n);
}

export function formatG(n: number, fraction = 4): string {
  if (!Number.isFinite(n)) return "— g";
  return `${n.toFixed(fraction)} g`;
}

export function formatAddress(addr: string): string {
  const a = addr.toLowerCase();
  if (!isHexAddress(a)) return addr;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function assertUserWallet(addr: string): `0x${string}` {
  return toLowerAddress(addr);
}

// ---------- Legacy aliases (to avoid breaking your existing imports) ----------
export const apiGetMe = getMe;
export const apiUserMint = userMint;