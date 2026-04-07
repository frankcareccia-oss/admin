/**
 * MerchantSettings.jsx
 *
 * Merchant account settings hub.
 * Route: /merchant/settings
 *
 * Sections:
 *   - Profile (name, phone — editable)
 *   - Security (change password link)
 *   - Coming soon placeholders
 */

import React from "react";
import { Link } from "react-router-dom";
import { color, btn, inputStyle as themeInput } from "../theme";
import { me, merchantUpdateUserProfile, merchantUpdateType, squareGetStatus, squareGetLocations, squareMapLocation, squareDisconnect, squareConnectUrl, listMerchantStores } from "../api/client";
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

  // Square POS
  const [sqStatus, setSqStatus]           = React.useState(null);   // null=loading, object=loaded
  const [sqLocations, setSqLocations]     = React.useState([]);
  const [sqMaps, setSqMaps]               = React.useState([]);
  const [pvStores, setPvStores]           = React.useState([]);
  const [sqLocLoading, setSqLocLoading]   = React.useState(false);
  const [sqLocErr, setSqLocErr]           = React.useState("");
  const [sqMapSelections, setSqMapSelections] = React.useState({}); // { externalLocationId: pvStoreId }
  const [sqMapSaving, setSqMapSaving]     = React.useState({});
  const [sqMapMsg, setSqMapMsg]           = React.useState({});
  const [sqDisconnecting, setSqDisconnecting] = React.useState(false);

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

        // Square status + stores (fire-and-forget, don't block profile load)
        squareGetStatus().then(s => { if (!cancelled) setSqStatus(s); }).catch(() => { if (!cancelled) setSqStatus({ connected: false }); });
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

  // Load Square locations when connected
  React.useEffect(() => {
    if (!sqStatus?.connected) return;
    setSqLocLoading(true);
    setSqLocErr("");
    squareGetLocations()
      .then(r => {
        setSqLocations(r?.locations || []);
        setSqMaps(r?.existingMaps || []);
        // Pre-populate map selections from existing mappings
        const sel = {};
        (r?.existingMaps || []).forEach(m => { if (m.active) sel[m.externalLocationId] = m.pvStoreId; });
        setSqMapSelections(sel);
      })
      .catch(e => setSqLocErr(e?.message || "Failed to load locations"))
      .finally(() => setSqLocLoading(false));
  }, [sqStatus?.connected]);

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

  async function handleSqMapSave(loc) {
    const pvStoreId = sqMapSelections[loc.id];
    if (!pvStoreId) return;
    setSqMapSaving(s => ({ ...s, [loc.id]: true }));
    setSqMapMsg(m => ({ ...m, [loc.id]: "" }));
    try {
      await squareMapLocation({ externalLocationId: loc.id, externalLocationName: loc.name, pvStoreId: parseInt(pvStoreId, 10) });
      setSqMapMsg(m => ({ ...m, [loc.id]: "Saved" }));
    } catch (e) {
      setSqMapMsg(m => ({ ...m, [loc.id]: e?.message || "Save failed" }));
    } finally {
      setSqMapSaving(s => ({ ...s, [loc.id]: false }));
    }
  }

  async function handleSqDisconnect() {
    if (!window.confirm("Disconnect Square? Existing visits will not be affected.")) return;
    setSqDisconnecting(true);
    try {
      await squareDisconnect();
      setSqStatus({ connected: false });
      setSqLocations([]);
      setSqMaps([]);
    } catch (e) {
      alert(e?.message || "Disconnect failed");
    } finally {
      setSqDisconnecting(false);
    }
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

  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Manage your account and preferences." />

      <div style={{ marginTop: 24, maxWidth: 560 }}>

        {/* ── Profile ── */}
        <div style={sectionCard}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, color: color.text }}>
            Profile
          </div>
          <form onSubmit={handleProfileSave}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>First name</label>
                <input
                  style={inputStyle}
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div>
                <label style={labelStyle}>Last name</label>
                <input
                  style={inputStyle}
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div style={fieldRow}>
              <label style={labelStyle}>Email</label>
              <input
                style={{ ...inputStyle, background: "rgba(0,0,0,0.04)", color: color.textMuted }}
                value={email}
                disabled
                readOnly
              />
              <div style={{ fontSize: 11, color: color.textFaint, marginTop: 4 }}>
                Email cannot be changed here. Contact support if needed.
              </div>
            </div>
            <div style={fieldRow}>
              <label style={labelStyle}>Phone</label>
              <input
                style={inputStyle}
                value={phoneRaw}
                onChange={e => setPhoneRaw(e.target.value)}
                placeholder="e.g. 312-555-0100"
              />
            </div>
            {saveErr && <div style={{ color: color.danger, fontSize: 13, marginBottom: 10 }}>{saveErr}</div>}
            {saveMsg && <div style={{ color: color.success || "green", fontSize: 13, marginBottom: 10 }}>{saveMsg}</div>}
            <button
              type="submit"
              disabled={saving}
              style={{ ...btn.primary, minWidth: 100 }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </form>
        </div>

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
                    <input
                      type="radio"
                      name="settingsMerchantType"
                      value={opt.value}
                      checked={typeVal === opt.value}
                      onChange={() => setTypeVal(opt.value)}
                      disabled={typeSaving}
                    />
                    {opt.label}
                  </label>
                ))}
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: typeSaving ? "not-allowed" : "pointer", fontSize: 13, color: color.textFaint }}>
                  <input
                    type="radio"
                    name="settingsMerchantType"
                    value=""
                    checked={typeVal === ""}
                    onChange={() => setTypeVal("")}
                    disabled={typeSaving}
                  />
                  Not specified
                </label>
              </div>
              {typeSaveErr && <div style={{ color: color.danger, fontSize: 13, marginBottom: 10 }}>{typeSaveErr}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleTypeSave} disabled={typeSaving} style={{ ...btn.primary, minWidth: 80 }}>
                  {typeSaving ? "Saving…" : "Save"}
                </button>
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
              style={{
                ...btn.secondary,
                textDecoration: "none",
                display: "inline-block",
                whiteSpace: "nowrap",
                padding: "10px 20px",
                fontSize: 14,
              }}
            >
              Change Password
            </Link>
          </div>
        </div>

        {/* ── Square POS ── */}
        <div style={sectionCard}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: color.text }}>
            Square POS
          </div>

          {sqStatus === null ? (
            <div style={{ fontSize: 13, color: color.textMuted }}>Loading…</div>
          ) : sqStatus?.connected ? (
            <div>
              {/* Connected state */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(0,150,80,1)", display: "inline-block" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(0,110,50,1)" }}>Connected</span>
                  {sqStatus?.locationCount != null && (
                    <span style={{ fontSize: 12, color: color.textFaint }}>{sqStatus.locationCount} location{sqStatus.locationCount !== 1 ? "s" : ""} mapped</span>
                  )}
                </div>
                <button
                  onClick={handleSqDisconnect}
                  disabled={sqDisconnecting}
                  style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${color.border}`, background: color.cardBg, cursor: "pointer", fontSize: 13, fontWeight: 700, color: color.danger }}
                >
                  {sqDisconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>

              {/* Location mapping */}
              <div style={{ fontSize: 13, fontWeight: 700, color: color.textMuted, marginBottom: 10 }}>
                Map Square locations to PerkValet stores
              </div>
              {sqLocLoading && <div style={{ fontSize: 13, color: color.textMuted }}>Loading locations…</div>}
              {sqLocErr && <div style={{ fontSize: 13, color: color.danger }}>{sqLocErr}</div>}
              {!sqLocLoading && sqLocations.length === 0 && !sqLocErr && (
                <div style={{ fontSize: 13, color: color.textFaint }}>No locations found in your Square account.</div>
              )}
              {sqLocations.map(loc => (
                <div key={loc.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 160, fontSize: 13, fontWeight: 600 }}>{loc.name}</div>
                  <select
                    value={sqMapSelections[loc.id] || ""}
                    onChange={e => { setSqMapSelections(s => ({ ...s, [loc.id]: e.target.value })); setSqMapMsg(m => ({ ...m, [loc.id]: "" })); }}
                    style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${color.border}`, fontSize: 13, flex: 1, minWidth: 160 }}
                  >
                    <option value="">— Select PV store —</option>
                    {pvStores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleSqMapSave(loc)}
                    disabled={!sqMapSelections[loc.id] || sqMapSaving[loc.id] || sqMapMsg[loc.id] === "Saved"}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: color.primary, color: "#fff", cursor: (!sqMapSelections[loc.id] || sqMapMsg[loc.id] === "Saved") ? "default" : "pointer", fontSize: 13, fontWeight: 700, opacity: (!sqMapSelections[loc.id] || sqMapMsg[loc.id] === "Saved") ? 0.4 : 1 }}
                  >
                    {sqMapSaving[loc.id] ? "Saving…" : "Save"}
                  </button>
                  {sqMapMsg[loc.id] && (
                    <span style={{ fontSize: 12, color: sqMapMsg[loc.id] === "Saved" ? "rgba(0,110,50,1)" : color.danger }}>
                      {sqMapMsg[loc.id]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Disconnected state */
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: color.text }}>Not connected</div>
                <div style={{ fontSize: 13, color: color.textMuted, marginTop: 2 }}>
                  Connect your Square account to automatically log visits from POS payments.
                </div>
              </div>
              <a
                href={squareConnectUrl()}
                style={{ ...btn.primary, textDecoration: "none", display: "inline-block", whiteSpace: "nowrap", padding: "10px 20px", fontSize: 14 }}
              >
                Connect Square
              </a>
            </div>
          )}
        </div>

        {/* ── Coming soon ── */}
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

      <SupportInfo context={{ page: "MerchantSettings", userId, merchantId }} />
    </PageContainer>
  );
}
