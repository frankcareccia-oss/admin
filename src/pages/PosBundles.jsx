// admin/src/pages/PosBundles.jsx
//
// POS Bundle sell + redeem flow (Phase C — simple mode).
//
// Flow:
//   1. Look up consumer by phone (optional for sell, helps track redemptions)
//   2. Sell panel  — pick a live bundle → confirm → sell
//   3. Redeem panel — see consumer's active instances → redeem one set
//
// pvUiHook events instrument every significant action for QA / chatbot context.

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  posBundlesAvailable,
  posBundleConsumerLookup,
  posBundleSell,
  posBundleRedeem,
} from "../api/client";

function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {}
}

function formatPrice(p) {
  if (p == null) return "—";
  return `$${Number(p).toFixed(2)}`;
}

function makeSellIdempotencyKey(instanceId) {
  return `redeem-${instanceId}-${Date.now()}`;
}

// ── Styles ────────────────────────────────────────────────────

const card = {
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 14,
  padding: 14,
  background: "white",
  marginBottom: 14,
};

const pill = (disabled = false) => ({
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.18)",
  background: disabled ? "rgba(0,0,0,0.03)" : "white",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 850,
  fontSize: 14,
  opacity: disabled ? 0.55 : 1,
});

const pillPrimary = (disabled = false) => ({
  ...pill(disabled),
  background: disabled ? "rgba(37,99,235,0.08)" : "rgba(37,99,235,0.12)",
  border: "1px solid rgba(37,99,235,0.35)",
  color: "#1d4ed8",
});

const pillDanger = (disabled = false) => ({
  ...pill(disabled),
  background: disabled ? "rgba(0,0,0,0.03)" : "rgba(22,163,74,0.10)",
  border: "1px solid rgba(22,163,74,0.35)",
  color: "#15803d",
});

const errorBox = {
  background: "rgba(254,226,226,0.85)",
  border: "1px solid rgba(252,165,165,0.9)",
  color: "#991B1B",
  padding: 10,
  borderRadius: 12,
  marginTop: 8,
  fontWeight: 850,
  fontSize: 13,
};

const successBox = {
  background: "rgba(22,163,74,0.10)",
  border: "1px solid rgba(22,163,74,0.25)",
  color: "rgba(0,0,0,0.80)",
  padding: 10,
  borderRadius: 12,
  marginTop: 8,
  fontWeight: 850,
  fontSize: 13,
};

const label = { fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.65)", marginBottom: 6 };

const input = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
};

// ── Sub-components ────────────────────────────────────────────

function ConsumerCard({ consumer }) {
  if (!consumer) return null;
  const name = [consumer.firstName, consumer.lastName].filter(Boolean).join(" ") || "—";
  return (
    <div style={{ ...card, background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.18)", marginBottom: 10 }}>
      <div style={{ fontWeight: 900, marginBottom: 4 }}>Consumer Found</div>
      <div style={{ fontSize: 13, color: "rgba(0,0,0,0.7)" }}>{name}</div>
      {consumer.phoneE164 ? <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>{consumer.phoneE164}</div> : null}
      {consumer.email ? <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>{consumer.email}</div> : null}
    </div>
  );
}

function InstanceRow({ inst, onRedeem, redeeming }) {
  const busy = redeeming === inst.id;
  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "10px 0", display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 900, fontSize: 14 }}>{inst.bundle?.name || `Bundle #${inst.bundleId}`}</div>
        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)", marginTop: 2 }}>{inst.remaining}</div>
        <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", marginTop: 2 }}>Instance #{inst.id}</div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => onRedeem(inst.id)}
        style={pillDanger(busy)}
      >
        {busy ? "Redeeming…" : "Redeem 1 Set"}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function PosBundles() {
  const navigate = useNavigate();

  // Consumer lookup
  const [phoneInput, setPhoneInput] = React.useState("");
  const [lookingUp, setLookingUp] = React.useState(false);
  const [consumer, setConsumer] = React.useState(null);       // null = not looked up / not found
  const [instances, setInstances] = React.useState([]);
  const [lookupErr, setLookupErr] = React.useState("");
  const [lookupDone, setLookupDone] = React.useState(false);

  // Available bundles (for sell)
  const [bundles, setBundles] = React.useState(null);   // null = not loaded
  const [loadingBundles, setLoadingBundles] = React.useState(false);
  const [bundlesErr, setBundlesErr] = React.useState("");

  // Sell flow
  const [showSell, setShowSell] = React.useState(false);
  const [selectedBundle, setSelectedBundle] = React.useState(null);
  const [selling, setSelling] = React.useState(false);
  const [sellResult, setSellResult] = React.useState(null);  // last sold instance
  const [sellErr, setSellErr] = React.useState("");

  // Redeem
  const [redeemingId, setRedeemingId] = React.useState(null);
  const [redeemMsg, setRedeemMsg] = React.useState("");
  const [redeemErr, setRedeemErr] = React.useState("");

  React.useEffect(() => {
    pvUiHook("pos.bundles.page_loaded.ui", {
      tc: "TC-POS-BUNDLES-UI-01",
      sev: "info",
      stable: "pos:bundles",
    });
  }, []);

  // ── Consumer lookup ──────────────────────────────────────────

  async function handleLookup(e) {
    e.preventDefault();
    const id = phoneInput.trim();
    if (!id) return;

    setLookupErr("");
    setConsumer(null);
    setInstances([]);
    setLookupDone(false);
    setSellResult(null);
    setRedeemMsg("");
    setRedeemErr("");
    setLookingUp(true);

    pvUiHook("pos.bundles.lookup.started.ui", {
      tc: "TC-POS-BUNDLES-UI-02",
      sev: "info",
      stable: "pos:bundles:lookup",
    });

    try {
      const r = await posBundleConsumerLookup(id);
      setConsumer(r.consumer || null);
      setInstances(Array.isArray(r.instances) ? r.instances : []);
      setLookupDone(true);

      pvUiHook("pos.bundles.lookup.done.ui", {
        tc: "TC-POS-BUNDLES-UI-03",
        sev: "info",
        stable: "pos:bundles:lookup",
        found: Boolean(r.consumer),
        instanceCount: (r.instances || []).length,
      });
    } catch (err) {
      setLookupErr(err?.message || "Lookup failed");
      pvUiHook("pos.bundles.lookup.failed.ui", {
        tc: "TC-POS-BUNDLES-UI-04",
        sev: "warn",
        stable: "pos:bundles:lookup",
        error: err?.message,
      });
    } finally {
      setLookingUp(false);
    }
  }

  function clearConsumer() {
    setPhoneInput("");
    setConsumer(null);
    setInstances([]);
    setLookupDone(false);
    setLookupErr("");
    setSellResult(null);
    setRedeemMsg("");
    setRedeemErr("");
    setShowSell(false);
    setSelectedBundle(null);
  }

  // ── Load available bundles ───────────────────────────────────

  async function openSellPanel() {
    setShowSell(true);
    setSelectedBundle(null);
    setSellErr("");
    setSellResult(null);

    if (bundles !== null) return; // already loaded

    setLoadingBundles(true);
    setBundlesErr("");

    pvUiHook("pos.bundles.sell_panel.opened.ui", {
      tc: "TC-POS-BUNDLES-UI-05",
      sev: "info",
      stable: "pos:bundles:sell",
    });

    try {
      const r = await posBundlesAvailable();
      setBundles(Array.isArray(r.bundles) ? r.bundles : []);
    } catch (err) {
      setBundlesErr(err?.message || "Failed to load bundles");
    } finally {
      setLoadingBundles(false);
    }
  }

  // ── Sell ────────────────────────────────────────────────────

  async function handleSell() {
    if (!selectedBundle) return;
    setSellErr("");
    setSellResult(null);
    setSelling(true);

    pvUiHook("pos.bundles.sell.clicked.ui", {
      tc: "TC-POS-BUNDLES-UI-06",
      sev: "info",
      stable: "pos:bundles:sell",
      bundleId: selectedBundle.id,
      consumerId: consumer?.id || null,
    });

    try {
      const r = await posBundleSell({
        bundleId: selectedBundle.id,
        consumerId: consumer?.id || undefined,
      });

      setSellResult(r.instance);
      setShowSell(false);
      setSelectedBundle(null);

      // If a consumer is loaded, refresh their instances
      if (consumer) {
        setInstances((prev) => [r.instance, ...prev]);
      }

      pvUiHook("pos.bundles.sell.succeeded.ui", {
        tc: "TC-POS-BUNDLES-UI-07",
        sev: "info",
        stable: "pos:bundles:sell",
        bundleId: selectedBundle.id,
        instanceId: r.instance?.id,
        consumerId: consumer?.id || null,
      });
    } catch (err) {
      setSellErr(err?.message || "Sell failed");
      pvUiHook("pos.bundles.sell.failed.ui", {
        tc: "TC-POS-BUNDLES-UI-08",
        sev: "warn",
        stable: "pos:bundles:sell",
        error: err?.message,
      });
    } finally {
      setSelling(false);
    }
  }

  // ── Redeem ──────────────────────────────────────────────────

  async function handleRedeem(instanceId) {
    setRedeemMsg("");
    setRedeemErr("");
    setRedeemingId(instanceId);

    const key = makeSellIdempotencyKey(instanceId);

    pvUiHook("pos.bundles.redeem.clicked.ui", {
      tc: "TC-POS-BUNDLES-UI-09",
      sev: "info",
      stable: "pos:bundles:redeem",
      instanceId,
    });

    try {
      const r = await posBundleRedeem(instanceId, key);
      const updated = r.instance;

      // Update the local instances list
      setInstances((prev) =>
        updated.status === "active"
          ? prev.map((inst) => (inst.id === instanceId ? updated : inst))
          : prev.filter((inst) => inst.id !== instanceId)
      );

      const msg = updated.status === "redeemed"
        ? `Bundle fully redeemed! ${updated.bundle?.name || `#${updated.bundleId}`} is complete.`
        : `1 set redeemed. Remaining: ${updated.remaining}`;

      setRedeemMsg(msg);

      pvUiHook("pos.bundles.redeem.succeeded.ui", {
        tc: "TC-POS-BUNDLES-UI-10",
        sev: "info",
        stable: "pos:bundles:redeem",
        instanceId,
        newStatus: updated.status,
        idempotent: Boolean(r.idempotent),
      });
    } catch (err) {
      setRedeemErr(err?.message || "Redeem failed");
      pvUiHook("pos.bundles.redeem.failed.ui", {
        tc: "TC-POS-BUNDLES-UI-11",
        sev: "warn",
        stable: "pos:bundles:redeem",
        instanceId,
        error: err?.message,
      });
    } finally {
      setRedeemingId(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "12px 12px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <Link
          to="/merchant/pos"
          style={{
            textDecoration: "none",
            color: "inherit",
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "white",
            fontWeight: 850,
            fontSize: 14,
          }}
        >
          ← Back
        </Link>
        <h2 style={{ margin: 0, fontSize: 20 }}>Bundle Sell & Redeem</h2>
      </div>

      {/* Step 1 — Consumer lookup */}
      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>
          {lookupDone ? "Consumer" : "Find Consumer (optional)"}
        </div>

        {!lookupDone ? (
          <form onSubmit={handleLookup} style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={label}>Phone or Email</div>
              <input
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="e.g. 5551234567 or name@example.com"
                style={input}
                autoComplete="off"
                disabled={lookingUp}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={!phoneInput.trim() || lookingUp} style={pillPrimary(!phoneInput.trim() || lookingUp)}>
                {lookingUp ? "Looking up…" : "Look Up"}
              </button>
              <button type="button" onClick={() => { setLookupDone(true); }} style={pill()}>
                Skip (anonymous)
              </button>
            </div>
            {lookupErr ? <div style={errorBox}>{lookupErr}</div> : null}
          </form>
        ) : (
          <div>
            {consumer ? (
              <ConsumerCard consumer={consumer} />
            ) : (
              <div style={{ color: "rgba(0,0,0,0.55)", fontSize: 13, marginBottom: 8 }}>
                No consumer found — sale will be anonymous.
              </div>
            )}
            <button type="button" onClick={clearConsumer} style={pill()}>
              Change Consumer
            </button>
          </div>
        )}
      </div>

      {/* Only show actions once lookup step is done */}
      {lookupDone ? (
        <>
          {/* Success / error banners */}
          {sellResult ? (
            <div style={successBox}>
              Bundle sold! <strong>{sellResult.bundle?.name || `#${sellResult.bundleId}`}</strong> — Instance #{sellResult.id}
              {consumer ? " linked to consumer." : " (anonymous sale)."}
            </div>
          ) : null}
          {redeemMsg ? <div style={successBox}>{redeemMsg}</div> : null}
          {redeemErr ? <div style={errorBox}>{redeemErr}</div> : null}

          {/* Step 2 — Active instances (redeem) */}
          {consumer && instances.length > 0 ? (
            <div style={card}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>
                Active Bundles ({instances.length})
              </div>
              {instances.map((inst) => (
                <InstanceRow
                  key={inst.id}
                  inst={inst}
                  onRedeem={handleRedeem}
                  redeeming={redeemingId}
                />
              ))}
            </div>
          ) : consumer && instances.length === 0 && !sellResult ? (
            <div style={{ ...card, color: "rgba(0,0,0,0.55)", fontSize: 13 }}>
              No active bundle instances for this consumer.
            </div>
          ) : null}

          {/* Step 3 — Sell panel */}
          {!showSell ? (
            <div style={{ marginBottom: 14 }}>
              <button type="button" onClick={openSellPanel} style={pillPrimary()}>
                + Sell a Bundle
              </button>
            </div>
          ) : (
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 900 }}>Select a Bundle to Sell</div>
                <button type="button" onClick={() => setShowSell(false)} style={pill()}>Cancel</button>
              </div>

              {loadingBundles ? (
                <div style={{ color: "rgba(0,0,0,0.55)", fontSize: 13 }}>Loading bundles…</div>
              ) : bundlesErr ? (
                <div style={errorBox}>{bundlesErr}</div>
              ) : bundles && bundles.length === 0 ? (
                <div style={{ color: "rgba(0,0,0,0.55)", fontSize: 13 }}>No live bundles available for this store.</div>
              ) : bundles ? (
                <>
                  <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                    {bundles.map((b) => {
                      const sel = selectedBundle?.id === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBundle(sel ? null : b)}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: sel ? "2px solid #2563EB" : "1px solid rgba(0,0,0,0.15)",
                            background: sel ? "rgba(37,99,235,0.07)" : "white",
                            cursor: "pointer",
                            textAlign: "left",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 900, fontSize: 14 }}>{b.name}</div>
                            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", marginTop: 2 }}>
                              Bundle #{b.id}
                            </div>
                          </div>
                          <div style={{ fontWeight: 950, fontSize: 16, color: "#1d4ed8" }}>
                            {formatPrice(b.price)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedBundle ? (
                    <div>
                      <div style={{ fontSize: 13, color: "rgba(0,0,0,0.65)", marginBottom: 10 }}>
                        Selling <strong>{selectedBundle.name}</strong> ({formatPrice(selectedBundle.price)})
                        {consumer ? ` to ${[consumer.firstName, consumer.lastName].filter(Boolean).join(" ") || consumer.phoneE164 || consumer.email}` : " — anonymous sale"}.
                      </div>
                      <button
                        type="button"
                        disabled={selling}
                        onClick={handleSell}
                        style={pillPrimary(selling)}
                      >
                        {selling ? "Selling…" : "Confirm Sell"}
                      </button>
                      {sellErr ? <div style={errorBox}>{sellErr}</div> : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          )}
        </>
      ) : null}

      <div style={{ marginTop: 14, fontSize: 12, color: "rgba(0,0,0,0.45)" }}>
        Screen <code>PosBundles</code> · Phase C simple mode
      </div>
    </div>
  );
}
