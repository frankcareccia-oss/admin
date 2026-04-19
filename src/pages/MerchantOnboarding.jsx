/**
 * MerchantOnboarding.jsx — Guided merchant setup experience
 *
 * TurboTax-style: ask simple questions, adapt to answers, resume-able.
 * Route: /merchant/onboarding
 */

import React from "react";
import { color, btn } from "../theme";
import GapAnalysis from "../components/GapAnalysis";
import {
  getOnboardingSession,
  updateOnboardingSession,
  requestOnboardingHelp,
  initiateOnboardingConnect,
  completeOnboardingConnection,
} from "../api/client";

// ── Stage definitions ──
const STAGES = [
  { id: "account", label: "Account", icon: "✓" },
  { id: "pos-access", label: "POS Access", icon: "2" },
  { id: "connect", label: "Connect", icon: "3" },
  { id: "map-stores", label: "Map Stores", icon: "4" },
  { id: "first-promo", label: "First Promo", icon: "5" },
  { id: "live", label: "Live", icon: "✓" },
];

const C = {
  bg: "#F4F4F0",
  card: "#fff",
  teal: "#1D9E75",
  navy: color.navy || "#0B2A33",
  muted: "#999",
  border: "#E5E5E0",
  green: "#2E7D32",
  red: "#C62828",
  amber: "#F57F17",
};

const s = {
  page: { minHeight: "100vh", background: C.bg, padding: "0 0 40px" },
  header: { background: color.primary, color: "#fff", padding: "18px 20px 16px" },
  headerTitle: { fontSize: 18, fontWeight: 700 },
  headerSub: { fontSize: 13, opacity: 0.8, marginTop: 2 },

  // Progress bar
  progressBar: { display: "flex", alignItems: "center", justifyContent: "center", gap: 0, padding: "20px 16px 10px" },
  progressStep: (status) => ({
    display: "flex", flexDirection: "column", alignItems: "center", flex: 1,
  }),
  progressDot: (status) => ({
    width: 32, height: 32, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: 700,
    background: status === "done" ? C.teal : status === "current" ? C.navy : "#E0E0E0",
    color: status === "done" || status === "current" ? "#fff" : C.muted,
  }),
  progressLabel: (status) => ({
    fontSize: 10, fontWeight: 600, marginTop: 4, textAlign: "center",
    color: status === "done" ? C.teal : status === "current" ? C.navy : C.muted,
  }),
  progressLine: (done) => ({
    flex: 1, height: 2, background: done ? C.teal : "#E0E0E0", margin: "0 -4px", marginBottom: 18,
  }),

  // Content area
  content: { maxWidth: 600, margin: "0 auto", padding: "0 16px" },
  card: {
    background: C.card, borderRadius: 12, padding: "24px", marginBottom: 16,
    border: `1px solid ${C.border}`,
  },
  question: { fontSize: 18, fontWeight: 600, color: C.navy, marginBottom: 16, lineHeight: 1.4 },
  hint: { fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 16 },

  // Option buttons
  optionGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  optionBtn: (selected) => ({
    padding: "16px", borderRadius: 10, cursor: "pointer", textAlign: "center",
    border: `2px solid ${selected ? C.teal : C.border}`,
    background: selected ? "#F0FDF4" : C.card,
    color: C.navy, fontWeight: 600, fontSize: 14,
  }),
  optionBtnFull: (selected) => ({
    padding: "14px 16px", borderRadius: 10, cursor: "pointer", textAlign: "left",
    border: `2px solid ${selected ? C.teal : C.border}`,
    background: selected ? "#F0FDF4" : C.card,
    color: C.navy, fontWeight: 500, fontSize: 14, marginBottom: 8,
  }),

  // Action buttons
  primaryBtn: {
    padding: "14px 24px", borderRadius: 8, border: "none", cursor: "pointer",
    background: C.teal, color: "#fff", fontSize: 15, fontWeight: 700, width: "100%",
  },
  secondaryBtn: {
    padding: "12px 20px", borderRadius: 8, cursor: "pointer",
    border: `1px solid ${C.border}`, background: "transparent",
    color: C.navy, fontSize: 14, fontWeight: 600, width: "100%",
  },
  helpLink: {
    fontSize: 13, color: C.muted, textAlign: "center", marginTop: 16, cursor: "pointer",
    textDecoration: "underline",
  },

  // Steps list
  stepList: { display: "flex", flexDirection: "column", gap: 8 },
  stepItem: { fontSize: 14, color: C.navy, lineHeight: 1.6, paddingLeft: 20, position: "relative" },

  // Success
  celebration: { textAlign: "center", padding: "40px 20px" },
  celebrationIcon: { fontSize: 48, marginBottom: 12 },
  celebrationTitle: { fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 8 },
  celebrationSub: { fontSize: 14, color: C.muted, lineHeight: 1.6 },

  loading: { textAlign: "center", padding: 60, color: C.muted, fontSize: 15 },
  error: { background: "#FFEBEE", padding: 12, borderRadius: 8, color: C.red, fontSize: 13, marginBottom: 12 },

  // Store card
  storeCard: { padding: "12px", border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8 },
  storeName: { fontSize: 14, fontWeight: 600, color: C.navy },
  storeAddr: { fontSize: 12, color: C.muted, marginTop: 2 },

  // Info box
  infoBox: { background: "#FFF8E1", border: `1px solid #FFE082`, borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#F57F17", marginBottom: 16, lineHeight: 1.5 },
};

// ── Progress Bar Component ──
function ProgressBar({ currentStage }) {
  const currentIdx = STAGES.findIndex(s => s.id === currentStage);

  return (
    <div style={s.progressBar}>
      {STAGES.map((stage, i) => {
        const status = i < currentIdx ? "done" : i === currentIdx ? "current" : "pending";
        return (
          <React.Fragment key={stage.id}>
            {i > 0 && <div style={s.progressLine(i <= currentIdx)} />}
            <div style={s.progressStep(status)}>
              <div style={s.progressDot(status)}>{status === "done" ? "✓" : stage.icon}</div>
              <div style={s.progressLabel(status)}>{stage.label}</div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Main Component ──
export default function MerchantOnboarding() {
  const [session, setSession] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [stores, setStores] = React.useState([]);
  const [existingConnection, setExistingConnection] = React.useState(null);
  const [connecting, setConnecting] = React.useState(false);
  const [helpResponse, setHelpResponse] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getOnboardingSession();
      setSession(data.session);
      setStores(data.stores || []);
      setExistingConnection(data.existingConnection);

      // If already completed, show live stage
      if (data.isComplete) {
        setSession(prev => ({ ...prev, currentStage: "live" }));
      }
    } catch (e) { setError(e?.message || "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const updateSession = async (updates) => {
    try {
      const result = await updateOnboardingSession(updates);
      setSession(result.session);
    } catch (e) { setError(e?.message); }
  };

  const requestHelp = async () => {
    try {
      const result = await requestOnboardingHelp({
        step: session?.currentStep,
        message: "Merchant clicked help button",
      });
      setHelpResponse(result.response);
    } catch (e) { setError(e?.message); }
  };

  const startConnect = async () => {
    setConnecting(true); setError(null);
    try {
      const result = await initiateOnboardingConnect();
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch (e) {
      setError(e?.message || "Could not start connection");
      setConnecting(false);
    }
  };

  const checkConnection = async () => {
    try {
      const result = await completeOnboardingConnection();
      if (result.connected) {
        setStores(result.stores || []);
        await load(); // refresh session
      } else {
        setError(result.error || "Connection not found");
      }
    } catch (e) { setError(e?.message); }
  };

  if (loading) return <div style={s.loading}>Loading...</div>;

  const stage = session?.currentStage || "pos-access";
  const step = session?.currentStep || "2.1";

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerTitle}>Set Up PerkValet</div>
        <div style={s.headerSub}>We'll guide you through connecting your store — it takes about 5 minutes.</div>
      </div>

      <ProgressBar currentStage={stage} />

      <div style={s.content}>
        {error && <div style={s.error}>{error}</div>}

        {helpResponse && (
          <div style={{ ...s.card, background: "#F0FDF4", borderColor: C.teal }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.teal, marginBottom: 6 }}>Help</div>
            <div style={{ fontSize: 14, color: C.navy, lineHeight: 1.6 }}>{helpResponse}</div>
            <button style={{ ...s.secondaryBtn, marginTop: 12, width: "auto" }} onClick={() => setHelpResponse(null)}>Got it</button>
          </div>
        )}

        {/* ── STAGE 2: POS Access ── */}
        {stage === "pos-access" && step === "2.1" && (
          <div style={s.card}>
            <div style={s.question}>Which point-of-sale system do you use at your register?</div>
            <div style={s.optionGrid}>
              {[
                { value: "clover", label: "Clover", logo: "https://www.clover.com/assets/images/public-site/press/clover_primary_gray_rgb.svg" },
                { value: "square", label: "Square", logo: "https://upload.wikimedia.org/wikipedia/commons/3/30/Square%2C_Inc._-_Square_logo.svg" },
                { value: "toast", label: "Toast (coming soon)", logo: null },
                { value: "manual", label: "No POS / Cash only", logo: null },
              ].map(opt => (
                <button key={opt.value} style={s.optionBtn(session?.posType === opt.value)}
                  onClick={() => {
                    if (opt.value === "toast") return;
                    updateSession({ posType: opt.value, currentStep: opt.value === "manual" ? "2.8" : "2.2" });
                  }}
                  disabled={opt.value === "toast"}
                >
                  {opt.logo && <img src={opt.logo} alt={opt.label} style={{ height: 28, marginBottom: 6, objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; }} />}
                  <div>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {stage === "pos-access" && step === "2.2" && (
          <div style={s.card}>
            <div style={s.question}>Did you set up your {session?.posType === "clover" ? "Clover" : "Square"} system yourself, or did someone else handle it?</div>
            <div style={s.stepList}>
              {[
                { value: "self", label: "I set it up myself" },
                { value: "someone-else", label: "Someone else set it up (tech person, POS rep, etc.)" },
                { value: "unsure", label: "I'm not sure / it was a while ago" },
              ].map(opt => (
                <button key={opt.value} style={s.optionBtnFull(session?.setupPersona === opt.value)}
                  onClick={() => updateSession({
                    setupPersona: opt.value,
                    currentStep: opt.value === "self" ? "2.3" : "2.5",
                  })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {stage === "pos-access" && step === "2.3" && (
          <div style={s.card}>
            <div style={s.question}>Do you have your {session?.posType === "clover" ? "Clover" : "Square"} login email and password handy?</div>
            <div style={s.stepList}>
              <button style={s.optionBtnFull(false)} onClick={() => updateSession({ credentialStatus: "ready", currentStage: "connect", currentStep: "3.1" })}>
                Yes, I have them ready
              </button>
              <button style={s.optionBtnFull(false)} onClick={() => updateSession({ credentialStatus: "recovering", currentStep: "2.4" })}>
                I know my email but forgot my password
              </button>
              <button style={s.optionBtnFull(false)} onClick={() => updateSession({ credentialStatus: "unknown", currentStep: "2.6" })}>
                I don't remember my login at all
              </button>
            </div>
          </div>
        )}

        {stage === "pos-access" && step === "2.4" && (
          <div style={s.card}>
            <div style={s.question}>No problem! Here's how to reset your password:</div>
            {session?.posType === "clover" ? (
              <ol style={{ fontSize: 14, color: C.navy, lineHeight: 1.8, paddingLeft: 20 }}>
                <li>Go to <strong>www.clover.com</strong> (not the developer site)</li>
                <li>Click "Forgot password?"</li>
                <li>Enter the email address used when setting up Clover</li>
                <li>Check your email for the reset link</li>
                <li>Set a new password, then come back here</li>
              </ol>
            ) : (
              <ol style={{ fontSize: 14, color: C.navy, lineHeight: 1.8, paddingLeft: 20 }}>
                <li>Go to <strong>squareup.com/login</strong></li>
                <li>Click "Forgot password?"</li>
                <li>Enter your email</li>
                <li>Check your email for the reset link</li>
              </ol>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button style={s.primaryBtn} onClick={() => updateSession({ credentialStatus: "ready", currentStage: "connect", currentStep: "3.1" })}>
                I reset my password — continue
              </button>
            </div>
            <button style={{ ...s.secondaryBtn, marginTop: 8 }} onClick={() => updateSession({ currentStep: "2.6" })}>
              I didn't receive the email
            </button>
          </div>
        )}

        {stage === "pos-access" && step === "2.5" && (
          <div style={s.card}>
            <div style={s.question}>No problem — that's very common!</div>
            <div style={s.hint}>To connect PerkValet, we'll need admin access to your {session?.posType === "clover" ? "Clover" : "Square"} account. Here's exactly what to ask your tech person:</div>
            <div style={{ background: "#F5F5F5", borderRadius: 8, padding: "12px 14px", fontSize: 14, fontStyle: "italic", marginBottom: 16, lineHeight: 1.6 }}>
              "Hi — I'm setting up a loyalty program using PerkValet. I need the admin login email and password for our {session?.posType === "clover" ? "Clover" : "Square"} account. Can you send those to me?"
            </div>
            <div style={s.infoBox}>
              Important: Make sure they send the login for the <strong>business account</strong> (the one used at the register), not a separate developer or test account.
            </div>
            <button style={s.primaryBtn} onClick={() => updateSession({ credentialStatus: "ready", currentStage: "connect", currentStep: "3.1" })}>
              I have the credentials now
            </button>
            <button style={{ ...s.secondaryBtn, marginTop: 8 }} onClick={() => {
              // Save for later — merchant will come back
              updateSession({ credentialStatus: "unknown" });
              alert("Your progress has been saved! Come back anytime — you won't have to start over.");
            }}>
              Save and come back later
            </button>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 8 }}>Can't reach your tech person?</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                Call {session?.posType === "clover" ? "Clover" : "Square"} support directly:
                {session?.posType === "clover" ? <strong> (855) 853-8340</strong> : <strong> (855) 700-6000</strong>}
                — tell them you're the business owner and need admin access.
              </div>
            </div>
          </div>
        )}

        {stage === "pos-access" && step === "2.6" && (
          <div style={s.card}>
            <div style={s.question}>Let's figure out which email your account uses:</div>
            <ol style={{ fontSize: 14, color: C.navy, lineHeight: 1.8, paddingLeft: 20 }}>
              <li><strong>Check your email inbox</strong> — search for messages from "{session?.posType === "clover" ? "Clover" : "Square"}". The email they sent to is likely your login.</li>
              <li><strong>Think about which email you use for business</strong> — many merchants use their business email, not personal.</li>
              <li><strong>Check the POS device</strong> — look in Settings → Account on your register.</li>
            </ol>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button style={s.primaryBtn} onClick={() => updateSession({ currentStep: "2.4" })}>
                I found it!
              </button>
              <button style={s.secondaryBtn} onClick={() => updateSession({ currentStep: "2.5" })}>
                I still can't find it
              </button>
            </div>
          </div>
        )}

        {stage === "pos-access" && step === "2.8" && (
          <div style={s.card}>
            <div style={s.question}>PerkValet works best with a connected POS, but you can get started manually.</div>
            <div style={s.hint}>Your staff will enter customer visits by phone number. You can connect a POS later.</div>
            <button style={s.primaryBtn} onClick={() => updateSession({ currentStage: "map-stores", currentStep: "4.4" })}>
              Continue with manual setup
            </button>
            <button style={{ ...s.secondaryBtn, marginTop: 8 }} onClick={() => updateSession({ currentStep: "2.1" })}>
              Actually, I think I do have a POS
            </button>
          </div>
        )}

        {/* ── STAGE 3: Connect ── */}
        {stage === "connect" && step === "3.1" && (
          <div style={s.card}>
            <div style={s.question}>Let's connect your {session?.posType === "clover" ? "Clover" : "Square"} account!</div>
            <div style={s.hint}>Here's what will happen:</div>
            <ol style={{ fontSize: 14, color: C.navy, lineHeight: 1.8, paddingLeft: 20, marginBottom: 16 }}>
              <li>You'll be redirected to {session?.posType === "clover" ? "Clover" : "Square"}'s sign-in page — <strong>use your {session?.posType === "clover" ? "Clover" : "Square"} admin POS login, not your PerkValet login</strong></li>
              <li>{session?.posType === "clover" ? "Clover" : "Square"} will ask you to allow PerkValet to connect — click "Allow"</li>
              <li>You'll be brought back here automatically — this takes about 30 seconds</li>
            </ol>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              We never see your POS password. This is the same secure process used by thousands of business apps.
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
              Tip: For the smoothest connection, use a fresh browser tab or clear any {session?.posType === "clover" ? "Clover" : "Square"} sessions first.
            </div>
            <div style={{ fontSize: 13, color: C.navy, marginBottom: 16, background: "#F0F4FF", border: "1px solid #C5CAE9", borderRadius: 8, padding: "10px 14px", lineHeight: 1.5 }}>
              <strong>Can't log in?</strong> Use your browser's <strong>← back button</strong> (top left corner) to return here and try again.
            </div>
            <button style={s.primaryBtn} onClick={startConnect}>
              Connect My {session?.posType === "clover" ? "Clover" : "Square"} Account
            </button>
            {session?.oauthAttempts > 0 && session?.oauthAttempts < 3 && (
              <div style={{ ...s.infoBox, marginTop: 12 }}>
                Previous attempt didn't complete. Make sure you're using the correct owner-level login for your business account.
              </div>
            )}
            {session?.oauthAttempts >= 3 && (
              <div style={{ ...s.infoBox, marginTop: 12, background: "#FFEBEE", borderColor: "#EF9A9A", color: C.red }}>
                <strong>Multiple attempts detected.</strong> Clover may lock your account after too many failed logins. If you're unsure of your credentials, click "I need help" below — or call Clover support at <strong>(855) 853-8340</strong> to reset your access before trying again.
              </div>
            )}
          </div>
        )}

        {stage === "connect" && step === "3.2" && (
          <div style={s.card}>
            <div style={s.question}>Let's check your connection...</div>
            <div style={s.hint}>If you just completed the {session?.posType === "clover" ? "Clover" : "Square"} login, click below to verify.</div>
            <button style={s.primaryBtn} onClick={checkConnection}>
              Check Connection Status
            </button>
            <button style={{ ...s.secondaryBtn, marginTop: 8 }} onClick={() => updateSession({ currentStep: "3.1" })}>
              Try connecting again
            </button>

            {/* Specific failure guidance */}
            <div style={{ marginTop: 16, fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, color: C.navy, marginBottom: 8 }}>Common issues:</div>
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                <li style={{ marginBottom: 6 }}><strong>Clicked Cancel</strong> — no problem, just try again when ready.</li>
                <li style={{ marginBottom: 6 }}><strong>Wrong account</strong> — make sure you used your owner/admin email, not a staff login.</li>
                <li style={{ marginBottom: 6 }}><strong>No admin access</strong> — you may need the business owner's login. <span style={{ cursor: "pointer", color: C.teal, textDecoration: "underline" }} onClick={() => updateSession({ currentStep: "2.5" })}>Get help finding it</span>.</li>
                <li style={{ marginBottom: 6 }}><strong>{session?.posType === "clover" ? "Clover" : "Square"} had an error</strong> — wait 30 seconds and try again. Check <a href="https://status.clover.com" target="_blank" rel="noopener noreferrer" style={{ color: C.teal }}>system status</a>.</li>
                <li><strong>Browser issue</strong> — try opening in a fresh tab or incognito window.</li>
              </ul>
            </div>
          </div>
        )}

        {stage === "connect" && step === "3.3" && (
          <div style={s.card}>
            <div style={s.celebration}>
              <div style={s.celebrationIcon}>✓</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.teal }}>Connected!</div>
              <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>Finding your stores...</div>
            </div>
          </div>
        )}

        {/* ── STAGE 4: Map Stores ── */}
        {/* Gap Analysis — shown after connection, before store mapping */}
        {stage === "map-stores" && existingConnection && (
          <div style={{ marginBottom: 16 }}>
            <GapAnalysis />
          </div>
        )}

        {stage === "map-stores" && (step === "4.1" || step === "4.2") && (
          <div style={s.card}>
            <div style={s.question}>We found {stores.length} location{stores.length !== 1 ? "s" : ""} on your account:</div>
            {stores.map((store, i) => (
              <div key={store.id || i} style={s.storeCard}>
                <div style={s.storeName}>✓ {store.name}</div>
                <div style={s.storeAddr}>
                  {[store.address1, store.city, store.state, store.postal].filter(Boolean).join(", ") || store.id}
                </div>
              </div>
            ))}
            <div style={s.question}>Do these look right?</div>
            <button style={s.primaryBtn} onClick={() => updateSession({ storesMapped: stores.length, currentStage: "first-promo", currentStep: "5.1" })}>
              Yes, these are correct
            </button>
            <button style={{ ...s.secondaryBtn, marginTop: 8 }} onClick={() => updateSession({ currentStep: "4.3" })}>
              I have more locations not showing
            </button>
          </div>
        )}

        {stage === "map-stores" && step === "4.3" && (
          <div style={s.card}>
            <div style={s.question}>Additional locations may be on a separate account.</div>
            <div style={s.hint}>Each POS account needs its own connection. You can add more after completing setup.</div>
            <button style={s.primaryBtn} onClick={() => updateSession({ storesMapped: stores.length, currentStage: "first-promo", currentStep: "5.1" })}>
              Continue with what we have
            </button>
          </div>
        )}

        {stage === "map-stores" && step === "4.4" && (
          <div style={s.card}>
            <div style={s.question}>Tell us about your store:</div>
            <div style={s.hint}>You can add more locations later in Settings.</div>
            <button style={s.primaryBtn} onClick={() => updateSession({ currentStage: "first-promo", currentStep: "5.1" })}>
              Continue — I'll add store details in Settings
            </button>
          </div>
        )}

        {/* ── STAGE 5: First Promotion ── */}
        {stage === "first-promo" && step === "5.1" && (
          <div style={s.card}>
            <div style={s.question}>Your stores are connected! Now let's set up your first loyalty program.</div>
            <div style={s.hint}>What kind of reward would you like to offer your customers?</div>
            <div style={s.optionGrid}>
              {[
                { value: "free_item", label: "☕ Free item", sub: "Buy X, get one free" },
                { value: "discount_fixed", label: "💲 Dollar off", sub: "Earn $5 off after X visits" },
                { value: "discount_pct", label: "📦 Percentage off", sub: "Get 15% off after X visits" },
                { value: "custom", label: "✨ Something custom", sub: "I have a specific idea" },
              ].map(opt => (
                <button key={opt.value} style={s.optionBtn(false)}
                  onClick={() => updateSession({ currentStep: "5.2_" + opt.value })}
                >
                  <div>{opt.label}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{opt.sub}</div>
                </button>
              ))}
            </div>
            <button style={{ ...s.secondaryBtn, marginTop: 16 }} onClick={() => updateSession({ currentStage: "live", currentStep: "6.1", firstPromoStatus: "skipped" })}>
              Skip for now — I'll create a promotion later
            </button>
          </div>
        )}

        {stage === "first-promo" && step?.startsWith("5.2") && (
          <div style={s.card}>
            <div style={s.question}>Almost there! We'll help you configure this in your Promotions page.</div>
            <div style={s.hint}>You can fine-tune all the details there — reward value, visit threshold, expiry, and more.</div>
            <button style={s.primaryBtn} onClick={() => updateSession({ currentStage: "live", currentStep: "6.1" })}>
              Take me to Promotions
            </button>
          </div>
        )}

        {/* ── STAGE 6: Live ── */}
        {stage === "live" && (
          <div style={s.card}>
            <div style={s.celebration}>
              <div style={s.celebrationIcon}>🎉</div>
              <div style={s.celebrationTitle}>You're all set!</div>
              <div style={s.celebrationSub}>
                PerkValet is connected to your store. Here's what happens next:
              </div>
            </div>
            <ol style={{ fontSize: 14, color: C.navy, lineHeight: 2, paddingLeft: 20, marginTop: 16 }}>
              <li><strong>Customers pay</strong> — ask for their phone number at checkout</li>
              <li><strong>Stamps accumulate</strong> — each visit earns a stamp automatically</li>
              <li><strong>Rewards appear</strong> — when they hit the milestone, the reward shows up</li>
              <li><strong>You see results</strong> — check your Analytics dashboard anytime</li>
            </ol>
            <div style={s.infoBox}>
              <strong>One important thing for your team:</strong> The loyalty program only works when your staff asks every customer for their phone number. This takes 3 seconds and makes all the difference.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <a href="#/merchant/dashboard" style={{ ...s.primaryBtn, textAlign: "center", textDecoration: "none" }}>
                Go to Dashboard
              </a>
            </div>
          </div>
        )}

        {/* Help link — shown on every step except live */}
        {stage !== "live" && (
          <div style={s.helpLink} onClick={requestHelp}>
            I need help with this step
          </div>
        )}
      </div>
    </div>
  );
}
