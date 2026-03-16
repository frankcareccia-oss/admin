import React from "react";

const REPLACE_REASONS = [
  {
    value: "damaged_prints",
    label: "Printed copies are damaged, lost, or more copies are needed",
    action: "print",
  },
  {
    value: "signage_refresh",
    label: "Store signage or branding is being fully replaced",
    action: "replace",
  },
  {
    value: "security_reset",
    label: "Security reset — invalidate all existing printed QR copies",
    action: "replace",
  },
  {
    value: "other",
    label: "Other",
    action: "replace",
  },
];

export default function ReplaceQrCard({
  replaceReason,
  setReplaceReason,
  onCancel,
  onContinue,
  regenerating = false,
}) {
  const selectedReasonMeta =
    REPLACE_REASONS.find((r) => r.value === replaceReason) || null;

  const shouldSteerToPrint = selectedReasonMeta?.action === "print";
  const shouldAllowReplace = selectedReasonMeta?.action === "replace";

  return (
    <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-2xl font-bold tracking-tight text-slate-800">
          Replace active store QR?
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
          Replacing the active QR will invalidate all currently printed copies
          for this store. Use <span className="font-semibold">Print</span> if
          you only need another copy of the current QR.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <label
          htmlFor="replaceReason"
          className="block text-sm font-semibold text-slate-700"
        >
          Why are you replacing this store QR?
        </label>

        <select
          id="replaceReason"
          value={replaceReason}
          onChange={(e) => setReplaceReason(e.target.value)}
          className="mt-3 block min-h-[52px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 outline-none transition focus:border-slate-400"
        >
          <option value="">Select a reason</option>
          {REPLACE_REASONS.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>

        {shouldSteerToPrint ? (
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm leading-6 text-sky-900">
              This reason usually does <span className="font-semibold">not</span>{" "}
              require a new QR. Close this card and use Print to create another
              copy of the current active store QR.
            </p>
          </div>
        ) : null}

        {shouldAllowReplace ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm leading-6 text-red-900">
              Replacing this QR will create a new active code for this store and
              invalidate all previously printed QR copies. Continue only if you
              are prepared to replace all existing printed QR signage at this
              location.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-[48px] items-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-base font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onContinue}
          disabled={!replaceReason || regenerating}
          className="inline-flex min-h-[48px] items-center rounded-full border border-slate-800 bg-white px-5 py-2.5 text-base font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {regenerating
            ? "Working..."
            : shouldAllowReplace
              ? "Generate New QR"
              : "Continue"}
        </button>
      </div>
    </div>
  );
}
