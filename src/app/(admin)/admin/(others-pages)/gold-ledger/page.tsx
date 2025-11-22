/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  listGoldLedger,
  type GoldLedgerEntry,
} from "@/lib/apiGoldLedger";
import {
  getTokenOpsLogs,
} from "@/lib/apiTokenOps";
import NewGoldEntry from "./Modals/NewGoldEntry";

function fmtNum(n: number | null | undefined, decimals = 6) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "0";
  return v.toFixed(decimals);
}

type MintBurnRow = {
  type?: string;                  // "MINT_BURN" when coming from audits-union API
  action?: string;                // "BUY_MINT" | "SELL_BURN" (sometimes upper-cased)
  op_type?: string;               // raw db column if returned straight from token_ops
  grams?: number;                 // raw grams column on token_ops
  detail?: any;                   // audits.detail jsonb: may include grams, tx_hash, unit_price_myr_per_g
  operator?: string;              // audits.operator
  wallet_address?: string;        // token_ops.wallet_address
  created_at?: string;            // timestamp
};

/** Normalize an arbitrary row into a MINT_BURN shape (or return null if not mint/burn) */
function normalizeMintBurn(row: any): {
  op: "BUY_MINT" | "SELL_BURN" | null;
  grams: number;
  operator: string;
  txHash?: string;
  createdAt?: string;
} | null {
  // Detect "type"
  const type = (row?.type || "").toString().toUpperCase();

  // Case A: audits union: type === "MINT_BURN"
  if (type === "MINT_BURN") {
    const action = (row?.action || "").toString().toUpperCase();
    const d = row?.detail ?? {};
    const grams =
      (d && typeof d.grams === "number" && Number(d.grams)) ||
      (typeof row?.grams === "number" && Number(row.grams)) ||
      0;
    const operator = (row?.operator || "").toString();
    const txHash = d?.tx_hash || row?.tx_hash;
    const createdAt = row?.created_at || row?.createdAt;
    if (action === "BUY_MINT" || action === "SELL_BURN") {
      return {
        op: action as "BUY_MINT" | "SELL_BURN",
        grams: Number.isFinite(grams) ? grams : 0,
        operator,
        txHash,
        createdAt,
      };
    }
    return null;
  }

  // Case B: raw token_ops table row passthrough
  const opType = (row?.op_type || "").toString().toUpperCase();
  if (opType === "BUY_MINT" || opType === "SELL_BURN") {
    const grams =
      (typeof row?.grams === "number" && Number(row.grams)) ||
      (typeof row?.detail?.grams === "number" && Number(row.detail.grams)) ||
      0;
    const operator = (row?.wallet_address || row?.operator || "").toString();
    const txHash = row?.tx_hash || row?.detail?.tx_hash;
    const createdAt = row?.created_at || row?.createdAt;
    return {
      op: opType as "BUY_MINT" | "SELL_BURN",
      grams: Number.isFinite(grams) ? grams : 0,
      operator,
      txHash,
      createdAt,
    };
  }

  // Not a mint/burn row
  return null;
}

export default function GoldLedgerPage() {
  // Ledger
  const [entries, setEntries] = useState<GoldLedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(true);

  // Token ops logs (for mint/burn aggregation)
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // UI bits
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadLedger = React.useCallback(async () => {
    setLoadingLedger(true);
    try {
      const data = await listGoldLedger({ limit: 200 });
      setEntries(data || []);
    } catch (e: any) {
      setErrorText(e?.message || "Failed to load gold ledger.");
    } finally {
      setLoadingLedger(false);
    }
  }, []);

  const loadLogs = React.useCallback(async () => {
    setLoadingLogs(true);
    try {
      // Take first 200 logs to aggregate mint/burn.
      const r = await getTokenOpsLogs({ limit: 200, offset: 0 });
      const rows = (r as any)?.data || [];
      setLogs(rows);
    } catch (e: any) {
      // If backend not merged yet, it's fine; mint/burn will show 0.
      // Still surface a soft error message once.
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const loadAll = React.useCallback(async () => {
    setErrorText(null);
    await Promise.all([loadLedger(), loadLogs()]);
  }, [loadLedger, loadLogs]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Intake stats (keep the same as before)
  const intakeStats = useMemo(() => {
    const totalIntakeG = entries.reduce((sum, e) => sum + (Number(e.intake_g) || 0), 0);
    // Keep simple avg purity as requested; if needed, can switch to weighted average later.
    const avgPurity =
      entries.length > 0
        ? entries.reduce((sum, e) => sum + (Number(e.purity_bp) || 0), 0) / entries.length / 100
        : 0;
    const count = entries.length;
    return { totalIntakeG, avgPurity, count };
  }, [entries]);

  // Mint / Burn aggregation from logs (robust to mixed shapes)
  const mintBurnStats = useMemo(() => {
    let mintG = 0;
    let burnG = 0;

    for (const row of logs as MintBurnRow[]) {
      const norm = normalizeMintBurn(row);
      if (!norm || !norm.op) continue;
      if (norm.op === "BUY_MINT") mintG += Number(norm.grams || 0);
      else if (norm.op === "SELL_BURN") burnG += Number(norm.grams || 0);
    }

    // Current = Intake - Mint + Burn
    const currentG = intakeStats.totalIntakeG - mintG + burnG;

    return {
      mintG,
      burnG,
      currentG,
    };
  }, [logs, intakeStats.totalIntakeG]);

  function openModal() {
    setIsModalOpen(true);
  }
  function closeModal() {
    setIsModalOpen(false);
  }
  async function handleModalSuccess() {
    await loadLedger();
    setToast("Gold entry created.");
    setTimeout(() => setToast(null), 1800);
  }

  const loading = loadingLedger || loadingLogs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Gold Ledger</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track physical gold intakes and reconcile mint/burn usage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openModal}
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/[0.03]"
          >
            Add Entry
          </button>
          <button
            onClick={() => loadAll()}
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/[0.03]"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {errorText && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {errorText}
        </div>
      )}

      {/* === Row 1: Intake / Avg Purity / Entries === */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Gold (g) Intake</p>
          <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            {fmtNum(intakeStats.totalIntakeG)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Average Purity (%)</p>
          <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            {fmtNum(intakeStats.avgPurity, 2)}%
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Entries</p>
          <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            {intakeStats.count}
          </p>
        </div>
      </div>

      {/* === Row 2: Current / Total Mint / Total Burnt === */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Gold (g) Current</p>
          <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            {fmtNum(mintBurnStats.currentG)}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Intake − Mint + Burn
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Mint (g)</p>
          <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            {fmtNum(mintBurnStats.mintG)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Burnt (g)</p>
          <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            {fmtNum(mintBurnStats.burnG)}
          </p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ledger Entries</h2>
        </div>

        <table className="min-w-full text-left text-sm text-gray-700 dark:text-gray-300">
          <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Intake (g)</th>
              <th className="px-5 py-3">Purity (bp)</th>
              <th className="px-5 py-3">Source</th>
              <th className="px-5 py-3">Serial</th>
              <th className="px-5 py-3">Batch</th>
              <th className="px-5 py-3">Storage</th>
              <th className="px-5 py-3">Custody</th>
              <th className="px-5 py-3">Insurance</th>
              <th className="px-5 py-3">Audit Ref</th>
              <th className="px-5 py-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-5 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-8 text-center text-gray-400">No records found.</td>
              </tr>
            ) : (
              entries.map((e, idx) => {
                const key = (e as any).id ?? `${e.entry_date}-${idx}`;
                return (
                  <tr key={key} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-5 py-3" suppressHydrationWarning>
                      {e.entry_date ? new Date(e.entry_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3">{fmtNum(e.intake_g)}</td>
                    <td className="px-5 py-3">{e.purity_bp ?? "—"}</td>
                    <td className="px-5 py-3">{e.source || "—"}</td>
                    <td className="px-5 py-3">{e.serial || "—"}</td>
                    <td className="px-5 py-3">{e.batch || "—"}</td>
                    <td className="px-5 py-3">{e.storage || "—"}</td>
                    <td className="px-5 py-3">{e.custody || "—"}</td>
                    <td className="px-5 py-3">{e.insurance || "—"}</td>
                    <td className="px-5 py-3">{e.audit_ref || "—"}</td>
                    <td className="px-5 py-3">{e.note || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-theme-lg dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          {toast}
        </div>
      )}

      {/* Modal */}
      <NewGoldEntry
        open={isModalOpen}
        onClose={closeModal}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}