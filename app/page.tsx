"use client";

import CsvDropzone from "@/components/csv/CsvDropzone";
import LotTable from "@/components/csv/LotTable";
import Dashboard from "@/components/dashboard/Dashboard";
import { usePortfolio } from "@/state/portfolio-context";

export default function Home() {
  const { state } = usePortfolio();
  const hasData = state.lots.length > 0 || state.errors.length > 0;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            What If Wealth
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Import your Yahoo portfolio to run counterfactual investment
            simulations.
          </p>
        </header>

        <CsvDropzone />

        {hasData ? (
          <>
            <LotTable />
            {state.lots.length > 0 && <Dashboard />}
          </>
        ) : (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            Nothing imported yet. Load your portfolio CSV to get started.
          </p>
        )}
      </main>
    </div>
  );
}
