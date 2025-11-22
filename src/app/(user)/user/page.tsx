
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getStoredUserWallet,
  clearStoredUserWallet,
  assertUserWallet,
  getCurrentPrice,
  getBalances,
  getActivity,
  apiGetMe,
  apiUserMint,
  userBurn,
  formatRM,
} from "@/lib/apiUser";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";

type MintState = "idle" | "processing" | "success" | "error";
type BurnState = "idle" | "processing" | "success" | "error";
type TabKey = "buy" | "burn";

const EXPLORER_TX_BASE = "https://explorer-testnet.oureum.com/tx/";

// Allow override from env (fallback to your test address)
const OUMG_ADDRESS =
  (process.env.NEXT_PUBLIC_OUMG_ADDRESS as `0x${string}`) ||
  ("0x86ea31421e159a9020378df039c23d55c6d0c62b" as `0x${string}`);
const OUMG_SYMBOL = "OUMG";
const OUMG_DECIMALS = 6;

// ---------- Native OUM helpers ----------
async function getNativeOumBalance(addr: `0x${string}`): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window === "undefined" || !(window as any).ethereum) return "—";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ethereum = (window as any).ethereum;
  const hex = (await ethereum.request({
    method: "eth_getBalance",
    params: [addr, "latest"],
  })) as string; // hex string "0x..."

  // bigint without numeric literal suffix
  const wei = BigInt(hex);
  const denom = BigInt("1000000000000000000"); // 1e18
  const mul = BigInt("10000"); // keep 4 decimals
  const whole = wei / denom;
  const fracRaw = ((wei % denom) * mul) / denom; // 4 decimals
  const frac = fracRaw.toString().padStart(4, "0");
  return `${whole.toString()}.${frac}`;
}

async function addTokenToMetaMask() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window === "undefined" || !(window as any).ethereum) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ethereum = (window as any).ethereum;
  try {
    await ethereum.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: OUMG_ADDRESS,
          symbol: OUMG_SYMBOL,
          decimals: OUMG_DECIMALS,
        },
      },
    });
  } catch {
    // ignore
  }
}

export default function UserWalletPage() {
  return <PageContent />;
}

function PageContent() {
  const router = useRouter();

  // session
  const [wallet, setWallet] = useState<`0x${string}` | null>(null);

  // server data
  const [loading, setLoading] = useState<boolean>(true);
  const [priceBuy, setPriceBuy] = useState<number>(0); // user buy MYR/g
  const [priceSell, setPriceSell] = useState<number>(0); // user sell MYR/g
  const [rmBalance, setRmBalance] = useState<number>(0);
  const [gBalance, setGBalance] = useState<number>(0);
  const [nativeOum, setNativeOum] = useState<string>("—");
  const [activity, setActivity] = useState<
    Array<{
      id: number;
      when: string;
      type: "Credit" | "Purchase" | "Burn";
      detail: string;
      txHash?: `0x${string}` | null;
    }>
  >([]);

  // UI state
  const [activeTab, setActiveTab] = useState<TabKey>("buy");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<"wallet" | "token" | null>(null);

  // buy inputs & flow
  const [grams, setGrams] = useState<string>("");
  const [ringgit, setRinggit] = useState<string>("");
  const [mintState, setMintState] = useState<MintState>("idle");
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // burn inputs & flow
  const [burnG, setBurnG] = useState<string>("");
  const [burnState, setBurnState] = useState<BurnState>("idle");
  const [burnTxHash, setBurnTxHash] = useState<`0x${string}` | null>(null);
  const [burnStep, setBurnStep] = useState<0 | 1 | 2 | 3>(0);
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);

  const burnCreditMYR = useMemo(() => {
    const g = Number(burnG) || 0;
    return g > 0 && priceSell > 0 ? Number((g * priceSell).toFixed(2)) : 0;
  }, [burnG, priceSell]);

  // boot
  useEffect(() => {
    const stored = getStoredUserWallet();
    if (!stored) {
      router.replace("/user/login");
      return;
    }
    const safe = assertUserWallet(stored);
    setWallet(safe);

    (async () => {
      try {
        setLoading(true);
        setErrorText(null);

        // ensure user exists
        await apiGetMe(safe);

        // price
        const p = await getCurrentPrice();
        setPriceBuy(Number(p.user_buy_myr_per_g) || 0);
        setPriceSell(Number(p.user_sell_myr_per_g) || 0);

        // balances
        const b = await getBalances(safe);
        setRmBalance(Number(b.rm_balance_myr) || 0);
        setGBalance(Number(b.oumg_balance_g) || 0);

        // native OUM via MetaMask
        try {
          const n = await getNativeOumBalance(safe);
          setNativeOum(n);
        } catch {
          setNativeOum("—");
        }

        // activity
        const act = await getActivity(safe, { limit: 20, offset: 0 });
        const mapped = act.data.map((x) => {
          const grams = Number(x.grams) || 0;
          const amt = Number(x.amount_myr) || 0;
          const price = Number(x.price_myr_per_g) || 0;
          return {
            id: x.id,
            when: new Date(x.created_at).toLocaleString(),
            type: x.op_type === "BUY_MINT" ? ("Purchase" as const) : ("Burn" as const),
            detail:
              x.op_type === "BUY_MINT"
                ? `Bought ${grams.toFixed(4)} g OUMG (${formatRM(amt)} @ RM ${price.toFixed(2)}/g)`
                : `Burned ${grams.toFixed(4)} g (${formatRM(amt)} @ RM ${price.toFixed(2)}/g)`,
            txHash: x.tx_hash,
          };
        });
        setActivity(mapped);
      } catch (e) {
        setErrorText((e as Error)?.message || "Failed to load user data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // helpers
  const shortAddress = (addr?: string | null) =>
    addr && addr.startsWith("0x") && addr.length > 10
      ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
      : addr || "—";

  async function copyWallet() {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet);
      setCopiedKey("wallet");
      setTimeout(() => setCopiedKey(null), 1400);
    } catch {
      // ignore
    }
  }

  async function copyTokenAddress() {
    try {
      await navigator.clipboard.writeText(OUMG_ADDRESS);
      setCopiedKey("token");
      setTimeout(() => setCopiedKey(null), 1400);
    } catch {
      // ignore
    }
  }

  // buy: input sync
  const syncByGrams = (g: string) => {
    setGrams(g);
    const val = Number(g);
    setRinggit(val > 0 && priceBuy > 0 ? String((val * priceBuy).toFixed(2)) : "");
  };
  const syncByRinggit = (rm: string) => {
    setRinggit(rm);
    const val = Number(rm);
    setGrams(val > 0 && priceBuy > 0 ? String((val / priceBuy).toFixed(4)) : "");
  };

  const cost = Number(ringgit) || 0;
  const g = Number(grams) || 0;
  const exceeded = cost > rmBalance && g > 0; // exceed RM credits

  const canBuy =
    !!wallet &&
    g > 0 &&
    cost > 0 &&
    rmBalance >= cost &&
    priceBuy > 0 &&
    mintState !== "processing" &&
    !loading;

  // burn: validation
  const burnGNum = Number(burnG) || 0;
  const burnExceeded = burnGNum > gBalance;
  const canBurn =
    !!wallet &&
    burnGNum > 0 &&
    !burnExceeded &&
    priceSell > 0 &&
    burnState !== "processing" &&
    !loading;

  // projections
  const projectedRm = useMemo(
    () => (g > 0 && cost > 0 && rmBalance >= cost ? Number((rmBalance - cost).toFixed(2)) : rmBalance),
    [g, cost, rmBalance]
  );
  const projectedG = useMemo(
    () => (g > 0 && cost > 0 && rmBalance >= cost ? Number((gBalance + g).toFixed(4)) : gBalance),
    [g, cost, gBalance, rmBalance]
  );

  const projectedRmAfterBurn = useMemo(
    () => (burnGNum > 0 ? Number((rmBalance + burnCreditMYR).toFixed(2)) : rmBalance),
    [burnGNum, burnCreditMYR, rmBalance]
  );
  const projectedGAfterBurn = useMemo(
    () => (burnGNum > 0 ? Number((gBalance - burnGNum).toFixed(4)) : gBalance),
    [burnGNum, gBalance]
  );

  // buy with confirm
  async function onMint() {
    if (!wallet || !canBuy) return;
    setShowConfirm(true);
  }

  async function confirmMint() {
    if (!wallet || !canBuy) return;

    setShowConfirm(false);
    setErrorText(null);
    setMintState("processing");
    setStep(1);
    try {
      // step 1: reserve (UI only)
      await new Promise((r) => setTimeout(r, 300));
      setStep(2);

      // step 2: API (actual mint)
      const resp = await apiUserMint(wallet, { grams: g });
      setTxHash(resp.txHash);
      setStep(3);

      // refresh balances
      const b = await getBalances(wallet);
      setRmBalance(Number(b.rm_balance_myr) || 0);
      setGBalance(Number(b.oumg_balance_g) || 0);

      // add activity
      const now = new Date().toLocaleString();
      setActivity((prev) => [
        {
          id: Date.now(),
          when: now,
          type: "Purchase",
          detail: `Bought ${g.toFixed(4)} g OUMG (${formatRM(resp.amountMyr)} @ RM ${resp.price_myr_per_g.toFixed(2)}/g)`,
          txHash: resp.txHash,
        },
        ...prev,
      ]);

      // clear inputs
      setGrams("");
      setRinggit("");

      setMintState("success");
    } catch (e) {
      setErrorText((e as Error)?.message || "Mint failed.");
      setMintState("error");
    }
  }

  // burn with confirm & process
  function onBurnClick() {
    if (!wallet || !canBurn) return;
    setShowBurnConfirm(true);
  }

  async function confirmBurn() {
    if (!wallet || !canBurn) return;
    setShowBurnConfirm(false);

    setErrorText(null);
    setBurnState("processing");
    setBurnStep(1);
    try {
      // step 1: reserve (UI only)
      await new Promise((r) => setTimeout(r, 300));
      setBurnStep(2);

      // step 2: API (actual burn)
      const resp = await userBurn(wallet, { grams: burnGNum });
      setBurnTxHash(resp.txHash);
      setBurnStep(3);

      // refresh balances
      const b = await getBalances(wallet);
      setRmBalance(Number(b.rm_balance_myr) || 0);
      setGBalance(Number(b.oumg_balance_g) || 0);

      // add activity
      const now = new Date().toLocaleString();
      setActivity((prev) => [
        {
          id: Date.now(),
          when: now,
          type: "Burn",
          detail: `Burned ${burnGNum.toFixed(4)} g (${formatRM(resp.amountMyr)} @ RM ${resp.price_myr_per_g.toFixed(2)}/g)`,
          txHash: resp.txHash,
        },
        ...prev,
      ]);

      // clear burn inputs
      setBurnG("");
      setBurnState("success");
    } catch (e) {
      setErrorText((e as Error)?.message || "Burn failed.");
      setBurnState("error");
    }
  }

  function onLogout() {
    clearStoredUserWallet();
    router.replace("/user/login");
  }

  // ---------- Loading (improved skeleton) ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-8 dark:bg-gray-900">
        <div className="mx-auto max-w-5xl">
          {/* top bar skeleton */}
          <div className="mb-8 flex items-center justify-between">
            <div className="h-8 w-64 animate-pulse rounded-md bg-gray-200 dark:bg-white/10" />
            <div className="h-8 w-32 animate-pulse rounded-md bg-gray-200 dark:bg-white/10" />
          </div>
          {/* cards skeleton */}
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="h-28 animate-pulse rounded-2xl bg-gray-200 dark:bg-white/10" />
            <div className="h-28 animate-pulse rounded-2xl bg-gray-200 dark:bg-white/10" />
          </div>
          {/* sections skeleton */}
          <div className="mb-6 h-60 animate-pulse rounded-2xl bg-gray-200 dark:bg-white/10" />
          <div className="h-60 animate-pulse rounded-2xl bg-gray-200 dark:bg-white/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8 dark:bg-gray-900">
      {/* Header */}
      <div className="mx-auto mb-4 flex max-w-5xl items-center justify-end">
        <div className="flex items-center gap-3">
          <ThemeToggleButton />
          <button
            onClick={onLogout}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5"
          >
            Logout
          </button>
        </div>
      </div>
      <div className="mx-auto mb-8 max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Oureum — User Wallet</h1>
        <p className="mt-1 text-sm">
          <span className="text-emerald-600 dark:text-emerald-400">Buy RM {priceBuy.toFixed(2)}/g</span>
          {" · "}
          <span className="text-rose-600 dark:text-rose-400">Sell RM {priceSell.toFixed(2)}/g</span>
        </p>
      </div>

      {errorText && (
        <div className="mx-auto mb-6 max-w-5xl rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {errorText}
        </div>
      )}

      <div className="mx-auto max-w-5xl">
        {/* 1) Balances */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <BalanceCard label="RM Credits" value={formatRM(rmBalance)} color="brand" />
          <BalanceCard label="OUMG Balance" value={`${gBalance.toFixed(4)} g`} color="emerald" />
        </div>

        {/* 2) Wallet Info */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Wallet Info</h2>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {/* Account */}
            <div className="flex items-center gap-2">
              <div className="min-w-28 text-gray-500 dark:text-gray-400">Account</div>
              <div className="font-medium text-gray-800 dark:text-gray-100">{shortAddress(wallet)}</div>
              <button
                onClick={copyWallet}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
                title="Copy address"
              >
                {copiedKey === "wallet" ? "Copied" : "Copy"}
              </button>
            </div>

            {/* Effective Price */}
            <div className="flex items-center gap-2">
              <div className="min-w-28 text-gray-500 dark:text-gray-400">Effective Price</div>
              <div className="font-medium">
                <span className="text-emerald-600 dark:text-emerald-400">Buy RM {priceBuy.toFixed(2)}/g</span> ·{" "}
                <span className="text-rose-600 dark:text-rose-400">Sell RM {priceSell.toFixed(2)}/g</span>
              </div>
            </div>

            {/* RM Credits */}
            <div className="flex items-center gap-2">
              <div className="min-w-28 text-gray-500 dark:text-gray-400">RM Credits</div>
              <div className="font-medium text-gray-800 dark:text-gray-100">{formatRM(rmBalance)}</div>
            </div>

            {/* OUM (native) */}
            <div className="flex items-center gap-2">
              <div className="min-w-28 text-gray-500 dark:text-gray-400">OUM</div>
              <div className="font-medium text-gray-800 dark:text-gray-100">{nativeOum} OUM</div>
            </div>

            {/* OUMG balance (new row between OUM and Token Address) */}
            <div className="flex items-center gap-2">
              <div className="min-w-28 text-gray-500 dark:text-gray-400">OUMG</div>
              <div className="font-medium text-gray-800 dark:text-gray-100">{gBalance.toFixed(4)} g</div>
            </div>

            {/* Token Address */}
            <div className="flex items-center gap-2">
              <div className="min-w-28 text-gray-500 dark:text-gray-400">Token Address</div>
              <div className="font-medium text-gray-800 dark:text-gray-100">{shortAddress(OUMG_ADDRESS)}</div>
              <button
                onClick={copyTokenAddress}
                title="Copy token address"
                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
              >
                {copiedKey === "token" ? "Copied" : "Copy"}
              </button>
              <button
                onClick={addTokenToMetaMask}
                title="Add to MetaMask"
                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
              >
                Add
              </button>
            </div>
          </dl>

          {/* Projected After Purchase */}
          {g > 0 && (
            <div className="mt-4 rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800">
              <div className="mb-2 font-semibold text-gray-800 dark:text-gray-200">Projected After Purchase</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-gray-500 dark:text-gray-400">RM Credits</div>
                  <div className="font-medium text-gray-800 dark:text-gray-100">{formatRM(projectedRm)}</div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">OUMG</div>
                  <div className="font-medium text-gray-800 dark:text-gray-100">{projectedG.toFixed(4)} g</div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Based on current inputs (RM {cost || 0} → {g || 0} g).
              </p>
            </div>
          )}

          {/* Projected After Redeem */}
          {burnGNum > 0 && (
            <div className="mt-4 rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800">
              <div className="mb-2 font-semibold text-gray-800 dark:text-gray-200">Projected After Redeem</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-gray-500 dark:text-gray-400">RM Credits</div>
                  <div className="font-medium text-gray-800 dark:text-gray-100">{formatRM(projectedRmAfterBurn)}</div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">OUMG</div>
                  <div className="font-medium text-gray-800 dark:text-gray-100">{projectedGAfterBurn.toFixed(4)} g</div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Based on current inputs ({burnGNum || 0} g → RM {burnCreditMYR.toFixed(2)}).
              </p>
            </div>
          )}
        </div>

        {/* 3) Token Ops Tabs */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 inline-flex rounded-xl border border-gray-200 p-1 dark:border-gray-800">
            <button
              onClick={() => setActiveTab("buy")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${activeTab === "buy"
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                }`}
            >
              Buy & Mint
            </button>
            <button
              onClick={() => setActiveTab("burn")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${activeTab === "burn"
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg.white/5"
                }`}
            >
              Redeem & Burn
            </button>
          </div>

          {activeTab === "buy" && (
            <>
              <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Buy & Mint</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-gray-700 dark:text-gray-300">Ringgit (MYR)</label>
                  <input
                    value={ringgit}
                    onChange={(e) => syncByRinggit(e.target.value)}
                    inputMode="decimal"
                    placeholder="e.g. 1000"
                    className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-700 dark:text-gray-300">OUMG (grams)</label>
                  <input
                    value={grams}
                    onChange={(e) => syncByGrams(e.target.value)}
                    inputMode="decimal"
                    placeholder="e.g. 2"
                    className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
                  />
                </div>
              </div>

              <div className="mt-3 text-xs">
                <div className="text-gray-500 dark:text-gray-400">
                  Effective price:{" "}
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">RM {priceBuy.toFixed(2)}/g</span>
                </div>
                {exceeded && (
                  <div className="mt-1 font-medium text-red-600 dark:text-red-400">
                    Insufficient RM credits. Required {formatRM(cost)} &nbsp;|&nbsp; Available {formatRM(rmBalance)}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-end">
                <button
                  disabled={!canBuy}
                  onClick={onMint}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-theme-xs ${canBuy ? "bg-emerald-600 text-white hover:bg-emerald-700" : "cursor-not-allowed bg-gray-300 text-gray-500"
                    }`}
                >
                  {mintState === "processing" ? "Processing…" : "Buy & Mint"}
                </button>
              </div>

              {/* Minting flow (dark mode friendly) */}
              {mintState !== "idle" && (
                <div className="mt-6 rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800">
                  {mintState === "processing" && (
                    <>
                      <div className="font-medium text-gray-800 dark:text-gray-200">Minting in progress</div>
                      <ol className="mt-4 space-y-2 text-gray-800 dark:text-gray-200">
                        <li>Step {step >= 1 ? "✅" : "⏳"} Reserve RM balance</li>
                        <li>Step {step >= 2 ? "✅" : "⏳"} Mint OUMG on chain</li>
                        <li>Step {step >= 3 ? "✅" : "⏳"} Finalize & update balances</li>
                      </ol>
                    </>
                  )}
                  {mintState === "success" && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold text-emerald-600 dark:text-emerald-400">✅ Minting Success</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Tx:&nbsp;
                          {txHash ? (
                            <a
                              href={`${EXPLORER_TX_BASE}${txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="underline decoration-dotted hover:text-emerald-700 dark:hover:text-emerald-300"
                            >
                              {txHash.slice(0, 20)}…
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setMintState("idle");
                          setStep(0);
                          setTxHash(null);
                        }}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5"
                      >
                        Close
                      </button>
                    </div>
                  )}
                  {mintState === "error" && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                      {errorText || "Mint failed."}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === "burn" && (
            <>
              <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Redeem & Burn</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-gray-700 dark:text-gray-300">OUMG (grams)</label>
                  <input
                    value={burnG}
                    onChange={(e) => setBurnG(e.target.value)}
                    inputMode="decimal"
                    placeholder="e.g. 0.5"
                    className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
                  />
                  {burnExceeded && (
                    <div className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                      Insufficient OUMG. Required {Number(burnG || 0).toFixed(4)} g · Available {gBalance.toFixed(4)} g
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-700 dark:text-gray-300">You will receive (MYR)</label>
                  <input
                    value={burnCreditMYR ? burnCreditMYR.toFixed(2) : ""}
                    readOnly
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300"
                  />
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Sell price: <span className="font-medium text-rose-600 dark:text-rose-400">RM {priceSell.toFixed(2)}/g</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end">
                <button
                  disabled={!canBurn}
                  onClick={onBurnClick}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-theme-xs ${canBurn ? "bg-purple-600 text-white hover:bg-purple-700" : "cursor-not-allowed bg-gray-300 text-gray-500"
                    }`}
                >
                  {burnState === "processing" ? "Processing…" : "Redeem & Burn"}
                </button>
              </div>

              {/* Burn flow (dark mode friendly) */}
              {burnState !== "idle" && (
                <div className="mt-6 rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-800">
                  {burnState === "processing" && (
                    <>
                      <div className="font-medium text-gray-800 dark:text-gray-200">Burn in progress</div>
                      <ol className="mt-4 space-y-2 text-gray-800 dark:text-gray-200">
                        <li>Step {burnStep >= 1 ? "✅" : "⏳"} Reserve OUMG</li>
                        <li>Step {burnStep >= 2 ? "✅" : "⏳"} Burn on chain</li>
                        <li>Step {burnStep >= 3 ? "✅" : "⏳"} Finalize & credit RM</li>
                      </ol>
                    </>
                  )}
                  {burnState === "success" && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold text-emerald-600 dark:text-emerald-400">✅ Burn Success</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Tx:&nbsp;
                          {burnTxHash ? (
                            <a
                              href={`${EXPLORER_TX_BASE}${burnTxHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="underline decoration-dotted hover:text-emerald-700 dark:hover:text-emerald-300"
                            >
                              {burnTxHash.slice(0, 20)}…
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setBurnState("idle");
                          setBurnStep(0);
                          setBurnTxHash(null);
                        }}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5"
                      >
                        Close
                      </button>
                    </div>
                  )}
                  {burnState === "error" && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                      {errorText || "Burn failed."}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 4) Recent Activity */}
        <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-12">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 xl:col-span-12">
            <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Activity</h2>
            </div>
            <ul className="space-y-3 p-5">
              {activity.length === 0 && <li className="text-xs text-gray-500 dark:text-gray-400">No activity yet.</li>}
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <span
                    className={`mt-0.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${a.type === "Credit"
                      ? "border-blue-300 bg-blue-500/10 text-blue-700 dark:border-blue-800 dark:text-blue-400"
                      : a.type === "Purchase"
                        ? "border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                        : "border-purple-300 bg-purple-500/10 text-purple-700 dark:border-purple-800 dark:text-purple-400"
                      }`}
                  >
                    {a.type}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm text-gray-800 dark:text-gray-200">{a.detail}</div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {a.when}
                      {a.txHash && (
                        <>
                          {" "}|{" "}
                          <a
                            href={`${EXPLORER_TX_BASE}${a.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-dotted hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            {a.txHash.slice(0, 10)}…
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Buy Confirm Modal */}
        {showConfirm && (
          <ConfirmModal
            title="Review & Confirm"
            rows={[
              ["Action", "Buy & Mint"],
              ["OUMG", `${g.toFixed(4)} g`],
              ["Price", `RM ${priceBuy.toFixed(2)}/g`],
              ["You pay", `${formatRM(cost)}`],
            ]}
            onCancel={() => setShowConfirm(false)}
            onConfirm={confirmMint}
          />
        )}

        {/* Burn Confirm Modal */}
        {showBurnConfirm && (
          <ConfirmModal
            title="Review & Confirm"
            rows={[
              ["Action", "Redeem & Burn"],
              ["OUMG", `${burnGNum.toFixed(4)} g`],
              ["Price", `RM ${priceSell.toFixed(2)}/g`],
              ["You receive", `${formatRM(burnCreditMYR)}`],
            ]}
            onCancel={() => setShowBurnConfirm(false)}
            onConfirm={confirmBurn}
          />
        )}
      </div>
    </div>
  );
}

function BalanceCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "brand" | "emerald";
}) {
  const colors: Record<"brand" | "emerald", string> = {
    brand: "bg-blue-500/70",
    emerald: "bg-emerald-500/70",
  };
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="mt-3 h-2 w-full rounded-full bg-gray-100 dark:bg-white/5">
        <div className={`h-2 rounded-full ${colors[color]}`} style={{ width: "80%" }} />
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  rows,
  onCancel,
  onConfirm,
}: {
  title: string;
  rows: Array<[string, string]>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 text-base font-semibold text-gray-800 dark:text-gray-100">{title}</div>
        <div className="space-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">{k}</span>
              <span className="font-medium text-gray-800 dark:text-gray-100">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}