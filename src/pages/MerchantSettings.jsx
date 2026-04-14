/**
 * MerchantSettings.jsx
 *
 * Merchant account settings hub — 2-column layout.
 * Route: /merchant/settings
 *
 * Left:  Profile, Security
 * Right: Business Type, POS Connection, Notifications
 */

import React from "react";
import { Link } from "react-router-dom";
import { color, btn, inputStyle as themeInput } from "../theme";
import {
  me, merchantUpdateUserProfile, merchantUpdateType,
  posGetStatus, posGetLocations, posMapLocation, posDisconnect,
  squareConnectUrl, cloverConnectUrl,
  listMerchantStores,
} from "../api/client";
import { MERCHANT_TYPE_OPTIONS, MERCHANT_TYPE_LABELS } from "../config/merchantTypes";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SupportInfo from "../components/SupportInfo";

function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {}
}

const inputStyle = {
  ...themeInput,
  width: "100%",
  boxSizing: "border-box",
};

const sectionCard = {
  border: `1px solid ${color.border}`,
  borderRadius: 14,
  padding: "20px 24px",
  background: color.cardBg,
  marginBottom: 20,
};

const labelStyle = {
  display: "block",
  fontWeight: 700,
  fontSize: 13,
  color: color.textMuted,
  marginBottom: 6,
};

const fieldRow = {
  marginBottom: 16,
};

/* ── POS display config ── */
const POS_OPTIONS = [
  { value: "square",  label: "Square",  icon: "■" },
  { value: "clover",  label: "Clover",  icon: "☘" },
  { value: "toast",   label: "Toast",   icon: "🍞" },
];

function posLabel(posType) {
  return POS_OPTIONS.find(p => p.value === posType)?.label || posType;
}
function posIcon(posType) {
  return POS_OPTIONS.find(p => p.value === posType)?.icon || "•";
}

export default function MerchantSettings() {
  const [loading, setLoading]   = React.useState(true);
  const [userId, setUserId]     = React.useState(null);
  const [merchantId, setMerchantId] = React.useState(null);
  const [err, setErr]           = React.useState(null);

  // Profile form
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName]   = React.useState("");
  const [phoneRaw, setPhoneRaw]   = React.useState("");
  const [email, setEmail]         = React.useState("");
  const [saving, setSaving]       = React.useState(false);
  const [saveMsg, setSaveMsg]     = React.useState("");
  const [saveErr, setSaveErr]     = React.useState("");

  // Business type
  const [merchantType, setMerchantType]   = React.useState(null);
  const [editingType, setEditingType]     = React.useState(false);
  const [typeVal, setTypeVal]             = React.useState("");
  const [typeSaving, setTypeSaving]       = React.useState(false);
  const [typeSaveErr, setTypeSaveErr]     = React.useState("");

  // POS connection (generic)
  const [posStatus, setPosStatus]           = React.useState(null); // null=loading
  const [posLocations, setPosLocations]     = React.useState([]);
  const [pvStores, setPvStores]             = React.useState([]);
  const [posLocLoading, setPosLocLoading]   = React.useState(false);
  const [posLocErr, setPosLocErr]           = React.useState("");
  const [posMapSelections, setPosMapSelections] = React.useState({});
  const [posMapSaving, setPosMapSaving]     = React.useState({});
  const [posMapMsg, setPosMapMsg]           = React.useState({});
  const [posDisconnecting, setPosDisconnecting] = React.useState(false);
  const [choosingPos, setChoosingPos]       = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profile = await me();
        if (cancelled) return;
        const u = profile?.user;
        const mid =
          u?.merchantUsers?.[0]?.merchantId ??
          u?.merchantUsers?.[0]?.merchant?.id ??
          null;
        setUserId(u?.id ?? null);
        setMerchantId(mid);
        setFirstName(u?.firstName ?? "");
        setLastName(u?.lastName ?? "");
        setPhoneRaw(u?.phoneRaw ?? "");
        setEmail(u?.email ?? "");
        const mt = u?.merchantUsers?.[0]?.merchant?.merchantType ?? null;
        setMerchantType(mt);
        setTypeVal(mt || "");

        // POS status + stores
        posGetStatus().then(s => { if (!cancelled) setPosStatus(s); }).catch(() => { if (!cancelled) setPosStatus({ posType: null, connected: false }); });
        listMerchantStores().then(r => { if (!cancelled) setPvStores(r?.items || r?.stores || []); }).catch(() => {});
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Load POS locations when connected
  React.useEffect(() => {
    if (!posStatus?.connected || !posStatus?.posType) return;
    setPosLocLoading(true);
    setPosLocErr("");
    posGetLocations(posStatus.posType)
      .then(r => {
        setPosLocations(r?.locations || []);
        const sel = {};
        (r?.existingMaps || []).forEach(m => { if (m.active) sel[m.externalLocationId] = m.pvStoreId; });
        setPosMapSelections(sel);
      })
      .catch(e => setPosLocErr(e?.message || "Failed to load locations"))
      .finally(() => setPosLocLoading(false));
  }, [posStatus?.connected, posStatus?.posType]);

  async function handleProfileSave(e) {
    e.preventDefault();
    setSaveErr("");
    setSaveMsg("");
    setSaving(true);
    pvUiHook("merchant.settings.profile.save", { userId, merchantId });
    try {
      await merchantUpdateUserProfile(userId, merchantId, {
        firstName: firstName.trim() || null,
        lastName:  lastName.trim()  || null,
        phoneRaw:  phoneRaw.trim()  || null,
      });
      setSaveMsg("Profile saved.");
    } catch (e) {
      setSaveErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTypeSave() {
    setTypeSaving(true);
    setTypeSaveErr("");
    pvUiHook("merchant.settings.type.save", { merchantId, typeVal });
    try {
      await merchantUpdateType(typeVal || null);
      setMerchantType(typeVal || null);
      setEditingType(false);
    } catch (e) {
      setTypeSaveErr(e?.message || "Save failed.");
    } finally {
      setTypeSaving(false);
    }
  }

  async function handlePosMapSave(loc) {
    const pvStoreId = posMapSelections[loc.id];
    if (!pvStoreId) return;
    setPosMapSaving(s => ({ ...s, [loc.id]: true }));
    setPosMapMsg(m => ({ ...m, [loc.id]: "" }));
    try {
      await posMapLocation(posStatus.posType, { externalLocationId: loc.id, externalLocationName: loc.name, pvStoreId: parseInt(pvStoreId, 10) });
      setPosMapMsg(m => ({ ...m, [loc.id]: "Saved" }));
      // Re-fetch POS status so store connection grid updates immediately
      posGetStatus().then(s => setPosStatus(s)).catch(() => {});
    } catch (e) {
      setPosMapMsg(m => ({ ...m, [loc.id]: e?.message || "Save failed" }));
    } finally {
      setPosMapSaving(s => ({ ...s, [loc.id]: false }));
    }
  }

  async function handlePosDisconnect() {
    if (!window.confirm(`Disconnect ${posLabel(posStatus.posType)}? Existing visits will not be affected.`)) return;
    setPosDisconnecting(true);
    try {
      await posDisconnect(posStatus.posType);
      setPosStatus({ posType: null, connected: false });
      setPosLocations([]);
    } catch (e) {
      alert(e?.message || "Disconnect failed");
    } finally {
      setPosDisconnecting(false);
    }
  }

  function getPosConnectUrl(posType) {
    if (posType === "square") return squareConnectUrl();
    if (posType === "clover") return cloverConnectUrl();
    return null; // Toast uses client-credentials, not redirect
  }

  if (loading) {
    return (
      <PageContainer>
        <div style={{ padding: 24, color: color.textMuted }}>Loading…</div>
      </PageContainer>
    );
  }

  if (err) {
    return (
      <PageContainer>
        <div style={{ padding: 24, color: color.danger }}>{err}</div>
      </PageContainer>
    );
  }

  const posType = posStatus?.posType;
  const posConnected = posStatus?.connected;

  // ── Connected POS card styling ──
  const connectedCardStyle = {
    ...sectionCard,
    border: `2px solid rgba(0,150,80,0.5)`,
    background: "rgba(0,150,80,0.03)",
  };
  const disconnectedCardStyle = {
    ...sectionCard,
    border: `2px solid ${color.border}`,
    background: color.cardBg,
  };
  const noPosCardStyle = {
    ...sectionCard,
  };

  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Manage your account and preferences." />

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

        {/* ════ LEFT COLUMN ════ */}
        <div>

          {/* ── Profile ── */}
          <div style={sectionCard}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, color: color.text }}>
              Profile
            </div>
            <form onSubmit={handleProfileSave}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>First name</label>
                  <input style={inputStyle} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
                </div>
                <div>
                  <label style={labelStyle}>Last name</label>
                  <input style={inputStyle} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
                </div>
              </div>
              <div style={fieldRow}>
                <label style={labelStyle}>Email</label>
                <input style={{ ...inputStyle, background: "rgba(0,0,0,0.04)", color: color.textMuted }} value={email} disabled readOnly />
                <div style={{ fontSize: 11, color: color.textFaint, marginTop: 4 }}>
                  Email cannot be changed here. Contact support if needed.
                </div>
              </div>
              <div style={fieldRow}>
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} value={phoneRaw} onChange={e => setPhoneRaw(e.target.value)} placeholder="e.g. 312-555-0100" />
              </div>
              {saveErr && <div style={{ color: color.danger, fontSize: 13, marginBottom: 10 }}>{saveErr}</div>}
              {saveMsg && <div style={{ color: color.success || "green", fontSize: 13, marginBottom: 10 }}>{saveMsg}</div>}
              <button type="submit" disabled={saving} style={{ ...btn.primary, minWidth: 100 }}>{saving ? "Saving…" : "Save"}</button>
            </form>
          </div>

          {/* ── Security ── */}
          <div style={sectionCard}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: color.text }}>
              Security
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: color.text }}>Password</div>
                <div style={{ fontSize: 13, color: color.textMuted, marginTop: 2 }}>
                  Update your login password.
                </div>
              </div>
              <Link
                to="/account/change-password"
                style={{ ...btn.secondary, textDecoration: "none", display: "inline-block", whiteSpace: "nowrap", padding: "10px 20px", fontSize: 14 }}
              >
                Change Password
              </Link>
            </div>
          </div>
        </div>

        {/* ════ RIGHT COLUMN ════ */}
        <div>

          {/* ── Business Type ── */}
          <div style={sectionCard}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: color.text }}>
              Business type
            </div>
            {editingType ? (
              <div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginBottom: 14 }}>
                  {MERCHANT_TYPE_OPTIONS.map(opt => (
                    <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 6, cursor: typeSaving ? "not-allowed" : "pointer", fontSize: 13 }}>
                      <input type="radio" name="settingsMerchantType" value={opt.value} checked={typeVal === opt.value} onChange={() => setTypeVal(opt.value)} disabled={typeSaving} />
                      {opt.label}
                    </label>
                  ))}
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: typeSaving ? "not-allowed" : "pointer", fontSize: 13, color: color.textFaint }}>
                    <input type="radio" name="settingsMerchantType" value="" checked={typeVal === ""} onChange={() => setTypeVal("")} disabled={typeSaving} />
                    Not specified
                  </label>
                </div>
                {typeSaveErr && <div style={{ color: color.danger, fontSize: 13, marginBottom: 10 }}>{typeSaveErr}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleTypeSave} disabled={typeSaving} style={{ ...btn.primary, minWidth: 80 }}>{typeSaving ? "Saving…" : "Save"}</button>
                  <button
                    onClick={() => { setEditingType(false); setTypeVal(merchantType || ""); setTypeSaveErr(""); }}
                    disabled={typeSaving}
                    style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${color.border}`, background: color.cardBg, cursor: "pointer", fontWeight: 700, fontSize: 14 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: merchantType ? color.text : color.textFaint }}>
                    {merchantType ? MERCHANT_TYPE_LABELS[merchantType] || merchantType : "Not set"}
                  </div>
                  <div style={{ fontSize: 13, color: color.textMuted, marginTop: 2 }}>
                    Helps PerkValet tailor suggestions to your business.
                  </div>
                </div>
                <button
                  onClick={() => { setTypeVal(merchantType || ""); setEditingType(true); }}
                  style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${color.border}`, background: color.cardBg, cursor: "pointer", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}
                >
                  {merchantType ? "Change" : "Set type"}
                </button>
              </div>
            )}
          </div>

          {/* ── POS Connection ── */}
          {posStatus === null ? (
            <div style={sectionCard}>
              <div style={{ fontSize: 13, color: color.textMuted }}>Loading POS status…</div>
            </div>
          ) : posConnected && posType ? (
            /* ── Connected state ── */
            <div style={connectedCardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{posIcon(posType)}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: color.text }}>{posLabel(posType)} POS</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(0,150,80,1)", display: "inline-block" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(0,150,80,1)" }}>Connected</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handlePosDisconnect}
                  disabled={posDisconnecting}
                  style={{
                    padding: "8px 18px", borderRadius: 10,
                    border: `2px solid ${color.danger}`,
                    background: "rgba(255,0,0,0.05)", cursor: "pointer",
                    fontSize: 13, fontWeight: 700, color: color.danger,
                  }}
                >
                  {posDisconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>

              {/* Store mapping status */}
              <div style={{ fontSize: 13, fontWeight: 700, color: color.textMuted, marginBottom: 10 }}>
                Store connections
              </div>
              {posStatus.storeStatuses?.map(s => (
                <div key={s.storeId} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", marginBottom: 6, borderRadius: 8,
                  background: s.mapped ? "rgba(0,150,80,0.06)" : "rgba(0,0,0,0.03)",
                  border: `1px solid ${s.mapped ? "rgba(0,150,80,0.2)" : color.border}`,
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.storeName}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {s.mapped ? (
                      <>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(0,150,80,1)", display: "inline-block" }} />
                        <span style={{ fontSize: 12, color: "rgba(0,110,50,1)", fontWeight: 600 }}>
                          {s.externalLocationName || "Mapped"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(180,0,0,0.5)", display: "inline-block" }} />
                        <span style={{ fontSize: 12, color: color.danger, fontWeight: 600 }}>Not mapped</span>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Location mapping controls */}
              <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: color.textMuted, marginBottom: 10 }}>
                Map {posLabel(posType)} locations to PerkValet stores
              </div>
              {posLocLoading && <div style={{ fontSize: 13, color: color.textMuted }}>Loading locations…</div>}
              {posLocErr && <div style={{ fontSize: 13, color: color.danger }}>{posLocErr}</div>}
              {!posLocLoading && posLocations.length === 0 && !posLocErr && (
                <div style={{ fontSize: 13, color: color.textFaint }}>No locations found in your {posLabel(posType)} account.</div>
              )}
              {posLocations.map(loc => (
                <div key={loc.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 140, fontSize: 13, fontWeight: 600 }}>{loc.name}</div>
                  <select
                    value={posMapSelections[loc.id] || ""}
                    onChange={e => { setPosMapSelections(s => ({ ...s, [loc.id]: e.target.value })); setPosMapMsg(m => ({ ...m, [loc.id]: "" })); }}
                    style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${color.border}`, fontSize: 13, flex: 1, minWidth: 140 }}
                  >
                    <option value="">— Select PV store —</option>
                    {pvStores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handlePosMapSave(loc)}
                    disabled={!posMapSelections[loc.id] || posMapSaving[loc.id] || posMapMsg[loc.id] === "Saved"}
                    style={{
                      padding: "6px 14px", borderRadius: 8, border: "none",
                      background: color.primary, color: "#fff", fontSize: 13, fontWeight: 700,
                      cursor: (!posMapSelections[loc.id] || posMapMsg[loc.id] === "Saved") ? "default" : "pointer",
                      opacity: (!posMapSelections[loc.id] || posMapMsg[loc.id] === "Saved") ? 0.4 : 1,
                    }}
                  >
                    {posMapSaving[loc.id] ? "Saving…" : "Save"}
                  </button>
                  {posMapMsg[loc.id] && (
                    <span style={{ fontSize: 12, color: posMapMsg[loc.id] === "Saved" ? "rgba(0,110,50,1)" : color.danger }}>
                      {posMapMsg[loc.id]}
                    </span>
                  )}
                </div>
              ))}

              {posStatus.lastCatalogSyncAt && (
                <div style={{ fontSize: 11, color: color.textFaint, marginTop: 12 }}>
                  Last catalog sync: {new Date(posStatus.lastCatalogSyncAt).toLocaleString()}
                </div>
              )}
            </div>
          ) : posType && !posConnected ? (
            /* ── Known POS but disconnected ── */
            <div style={disconnectedCardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{posIcon(posType)}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: color.text }}>{posLabel(posType)} POS</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(180,0,0,0.5)", display: "inline-block" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: color.danger }}>Disconnected</span>
                    </div>
                  </div>
                </div>
                {getPosConnectUrl(posType) ? (
                  <a
                    href={getPosConnectUrl(posType)}
                    style={{ ...btn.primary, textDecoration: "none", display: "inline-block", whiteSpace: "nowrap", padding: "10px 20px", fontSize: 14 }}
                  >
                    Reconnect {posLabel(posType)}
                  </a>
                ) : (
                  <span style={{ fontSize: 13, color: color.textMuted }}>Contact support to reconnect.</span>
                )}
              </div>
            </div>
          ) : (
            /* ── No POS type set — picker ── */
            <div style={noPosCardStyle}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: color.text }}>
                POS Integration
              </div>
              {!choosingPos ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: color.textFaint }}>No POS connected</div>
                    <div style={{ fontSize: 13, color: color.textMuted, marginTop: 2 }}>
                      Connect your point-of-sale system to automatically log visits from payments.
                    </div>
                  </div>
                  <button
                    onClick={() => setChoosingPos(true)}
                    style={{ ...btn.primary, whiteSpace: "nowrap", padding: "10px 20px", fontSize: 14 }}
                  >
                    Connect POS
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: color.textMuted, marginBottom: 12 }}>
                    Which POS system do you use?
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {POS_OPTIONS.map(opt => {
                      const url = getPosConnectUrl(opt.value);
                      const inner = (
                        <div style={{
                          padding: "16px 24px", borderRadius: 12,
                          border: `2px solid ${color.primaryBorder}`,
                          background: color.cardBg, cursor: "pointer",
                          textAlign: "center", minWidth: 120,
                          transition: "border-color 0.15s, background 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = color.primary; e.currentTarget.style.background = color.primarySubtle; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = color.primaryBorder; e.currentTarget.style.background = color.cardBg; }}
                        >
                          <div style={{ fontSize: 28, marginBottom: 6 }}>{opt.icon}</div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: color.text }}>{opt.label}</div>
                        </div>
                      );
                      if (url) {
                        return <a key={opt.value} href={url} style={{ textDecoration: "none" }}>{inner}</a>;
                      }
                      return <div key={opt.value} onClick={() => alert(`${opt.label} uses client credentials. Contact support to connect.`)}>{inner}</div>;
                    })}
                  </div>
                  <button
                    onClick={() => setChoosingPos(false)}
                    style={{ marginTop: 12, padding: "6px 14px", borderRadius: 8, border: `1px solid ${color.border}`, background: color.cardBg, cursor: "pointer", fontSize: 13, fontWeight: 600, color: color.textMuted }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Notifications (coming soon) ── */}
          <div style={{ ...sectionCard, opacity: 0.5 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8, color: color.text }}>
              Notifications
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 700,
                background: "rgba(0,0,0,0.07)", borderRadius: 999,
                padding: "2px 8px", color: color.textFaint,
              }}>
                Coming soon
              </span>
            </div>
            <div style={{ fontSize: 13, color: color.textMuted }}>
              Configure email and SMS notification preferences.
            </div>
          </div>
        </div>

      </div>

      <SupportInfo context={{ page: "MerchantSettings", userId, merchantId }} />
    </PageContainer>
  );
}
