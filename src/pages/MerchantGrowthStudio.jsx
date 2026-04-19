/**
 * MerchantGrowthStudio.jsx — Goal-first promotion builder
 *
 * "What do you want to accomplish?" → follow-up questions → recommended
 * promotion type → simulator pre-configured → publish or save.
 *
 * Route: /merchant/growth-studio
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { color } from "../theme";
import { merchantCreatePromotion, merchantGetSimulatorData, merchantGetNewSimulatorData, merchantListCategories } from "../api/client";
import PromotionSimulator from "../components/PromotionSimulator";

const C = {
  bg: "#F4F4F0",
  navy: color.navy || "#0B2A33",
  teal: "#1D9E75",
  muted: "#999",
  border: "#E5E5E0",
};

const s = {
  page: { minHeight: "100vh", background: C.bg, padding: "0 0 40px" },
  header: { background: color.primary, color: "#fff", padding: "18px 20px 16px" },
  headerTitle: { fontSize: 18, fontWeight: 700 },
  headerSub: { fontSize: 13, opacity: 0.8, marginTop: 2 },
  content: { maxWidth: 650, margin: "0 auto", padding: "20px 16px" },
  card: { background: "#fff", borderRadius: 12, padding: "24px", marginBottom: 16, border: `1px solid ${C.border}` },
  question: { fontSize: 18, fontWeight: 600, color: C.navy, marginBottom: 16, lineHeight: 1.4 },
  hint: { fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 16 },

  goalGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  goalCard: (selected) => ({
    padding: "20px 16px", borderRadius: 12, cursor: "pointer", textAlign: "center",
    border: `2px solid ${selected ? C.teal : C.border}`,
    background: selected ? "#F0FDF4" : "#fff",
    transition: "all 0.15s ease",
  }),
  goalIcon: { fontSize: 28, marginBottom: 8 },
  goalTitle: { fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 4 },
  goalDesc: { fontSize: 12, color: C.muted, lineHeight: 1.4 },

  followUp: { marginBottom: 20 },
  followUpLabel: { fontSize: 14, fontWeight: 600, color: C.navy, marginBottom: 8 },
  slider: { width: "100%", marginBottom: 4 },
  sliderValue: { fontSize: 14, fontWeight: 700, color: C.teal, textAlign: "center" },

  recCard: { background: "#F0FDF4", border: `2px solid ${C.teal}`, borderRadius: 12, padding: "20px", marginBottom: 16 },
  recTitle: { fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 6 },
  recDesc: { fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 12 },
  recDetails: { fontSize: 13, color: C.navy, lineHeight: 1.8 },

  primaryBtn: { padding: "14px 24px", borderRadius: 8, border: "none", cursor: "pointer", background: C.teal, color: "#fff", fontSize: 15, fontWeight: 700, width: "100%" },
  secondaryBtn: { padding: "12px 20px", borderRadius: 8, cursor: "pointer", border: `1px solid ${C.border}`, background: "transparent", color: C.navy, fontSize: 14, fontWeight: 600, width: "100%", marginTop: 8 },

  stepIndicator: { display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 },
  stepDot: (active) => ({ width: 8, height: 8, borderRadius: "50%", background: active ? C.teal : "#DDD" }),
};

// ── Goal definitions ──
const GOALS = [
  {
    id: "bring-back",
    icon: "🔄",
    title: "Bring customers back",
    desc: "Encourage repeat visits from existing customers",
    promoType: "stamp",
    rewardType: "discount_fixed",
    defaultThreshold: 8,
    defaultRewardValue: 500,
  },
  {
    id: "grow-base",
    icon: "📈",
    title: "Grow my loyal base",
    desc: "Attract new customers to join your loyalty program",
    promoType: "stamp",
    rewardType: "free_item",
    defaultThreshold: 5,
    defaultRewardValue: null,
  },
  {
    id: "drive-revenue",
    icon: "💰",
    title: "Drive more revenue",
    desc: "Increase spending per visit with bundles or upsells",
    promoType: "stamp",
    rewardType: "discount_pct",
    defaultThreshold: 10,
    defaultRewardValue: 15,
  },
  {
    id: "fill-slow",
    icon: "⏰",
    title: "Fill slow periods",
    desc: "Drive traffic during your quiet hours or days",
    promoType: "stamp",
    rewardType: "discount_fixed",
    defaultThreshold: 5,
    defaultRewardValue: 300,
  },
  {
    id: "reward-best",
    icon: "⭐",
    title: "Reward my best customers",
    desc: "Give your most loyal customers something special",
    promoType: "stamp",
    rewardType: "discount_fixed",
    defaultThreshold: 15,
    defaultRewardValue: 1000,
  },
];

export default function MerchantGrowthStudio() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1); // 1=goal, 2=configure, 3=simulator, 4=publish
  const [selectedGoal, setSelectedGoal] = React.useState(null);
  const [config, setConfig] = React.useState({ threshold: 8, rewardValue: 500, expiryDays: 90, promoName: "", startAt: "", endAt: "" });
  const [simulatorData, setSimulatorData] = React.useState(null);
  const [publishing, setPublishing] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [categories, setCategories] = React.useState([]);
  const [created, setCreated] = React.useState(false);

  // Load categories on mount for promotion creation
  React.useEffect(() => {
    merchantListCategories().then(res => setCategories(res?.categories || [])).catch(() => {});
  }, []);

  const goal = GOALS.find(g => g.id === selectedGoal);

  const handleGoalSelect = (goalId) => {
    const g = GOALS.find(x => x.id === goalId);
    setSelectedGoal(goalId);
    setConfig({
      threshold: g.defaultThreshold,
      rewardValue: g.defaultRewardValue || 500,
      expiryDays: 90,
      promoName: "",
    });
    setStep(2);
  };

  const handleConfigure = async () => {
    // Load simulator baseline with objective
    try {
      const data = await merchantGetNewSimulatorData("stamp", selectedGoal);
      setSimulatorData({
        ...data,
        promotion: {
          promotionType: "stamp",
          objective: selectedGoal,
          currentParams: {
            stampThreshold: config.threshold,
            rewardValueCents: config.rewardValue,
            expiryDays: config.expiryDays,
          },
        },
      });
      setStep(3);
    } catch (e) {
      setError(e?.message);
      setStep(3); // show simulator even if baseline fails
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const promoName = config.promoName || `${goal.title} Program`;
      // Pick first active category (visit-based if available, else any)
      const activeCats = categories.filter(c => c.status === "active");
      const visitCat = activeCats.find(c => c.categoryType === "visit");
      const categoryId = visitCat?.id || activeCats[0]?.id;

      if (!categoryId) {
        setError("No product categories found. Please create a category on the Products page first.");
        setPublishing(false);
        return;
      }

      const payload = {
        name: promoName,
        categoryId,
        mechanic: "stamps",
        threshold: config.threshold,
        rewardType: goal.rewardType,
        rewardValue: (goal.rewardType === "discount_pct" || goal.rewardType === "discount_fixed")
          ? config.rewardValue : undefined,
        rewardNote: goal.rewardType === "free_item" ? "Free item reward" : undefined,
        rewardSku: goal.rewardType === "free_item" ? "REWARD" : undefined,
        rewardExpiryDays: config.expiryDays,
        scope: "merchant",
        objective: selectedGoal,
        startAt: config.startAt || undefined,
        endAt: config.endAt || undefined,
      };

      await merchantCreatePromotion(payload);
      setCreated(true);
    } catch (e) {
      setError(e?.message || "Failed to create promotion");
    } finally {
      setPublishing(false);
    }
  };

  const rewardLabel = goal?.rewardType === "discount_fixed"
    ? `$${(config.rewardValue / 100).toFixed(2)} off`
    : goal?.rewardType === "discount_pct"
    ? `${config.rewardValue}% off`
    : goal?.rewardType === "free_item"
    ? "Free item"
    : "Reward";

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerTitle}>Growth Studio</div>
        <div style={s.headerSub}>Build the right loyalty program for your goal — we'll guide you.</div>
      </div>

      <div style={s.content}>
        {/* Step indicator */}
        <div style={s.stepIndicator}>
          {[1, 2, 3, 4].map(i => <div key={i} style={s.stepDot(step >= i)} />)}
        </div>

        {error && <div style={{ background: "#FFEBEE", padding: 12, borderRadius: 8, color: "#C62828", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {/* ── Step 1: Goal Selection ── */}
        {step === 1 && (
          <div style={s.card}>
            <div style={s.question}>What do you want to accomplish?</div>
            <div style={s.hint}>Pick the goal that matters most right now. We'll recommend the best program for it.</div>
            <div style={s.goalGrid}>
              {GOALS.map(g => (
                <div key={g.id} style={s.goalCard(selectedGoal === g.id)} onClick={() => handleGoalSelect(g.id)}>
                  <div style={s.goalIcon}>{g.icon}</div>
                  <div style={s.goalTitle}>{g.title}</div>
                  <div style={s.goalDesc}>{g.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Configure ── */}
        {step === 2 && goal && (
          <div style={s.card}>
            <div style={s.question}>Great choice! Let's configure your "{goal.title}" program.</div>

            {/* Recommendation */}
            <div style={s.recCard}>
              <div style={s.recTitle}>Our Recommendation</div>
              <div style={s.recDesc}>
                Based on your goal, we recommend a <strong>visit-based stamp program</strong> with a{" "}
                <strong>{rewardLabel}</strong> reward after <strong>{config.threshold} visits</strong>.
              </div>
            </div>

            {/* Threshold slider */}
            <div style={s.followUp}>
              <div style={s.followUpLabel}>How many visits to earn the reward?</div>
              <input type="range" min="3" max="20" value={config.threshold}
                onChange={e => setConfig(prev => ({ ...prev, threshold: parseInt(e.target.value) }))}
                style={s.slider}
              />
              <div style={s.sliderValue}>{config.threshold} visits</div>
            </div>

            {/* Reward value */}
            {goal.rewardType === "discount_fixed" && (
              <div style={s.followUp}>
                <div style={s.followUpLabel}>How much off?</div>
                <input type="range" min="100" max="2000" step="50" value={config.rewardValue}
                  onChange={e => setConfig(prev => ({ ...prev, rewardValue: parseInt(e.target.value) }))}
                  style={s.slider}
                />
                <div style={s.sliderValue}>${(config.rewardValue / 100).toFixed(2)} off</div>
              </div>
            )}
            {goal.rewardType === "discount_pct" && (
              <div style={s.followUp}>
                <div style={s.followUpLabel}>What percentage off?</div>
                <input type="range" min="5" max="50" value={config.rewardValue}
                  onChange={e => setConfig(prev => ({ ...prev, rewardValue: parseInt(e.target.value) }))}
                  style={s.slider}
                />
                <div style={s.sliderValue}>{config.rewardValue}% off</div>
              </div>
            )}

            {/* Stamp Duration */}
            <div style={s.followUp}>
              <div style={s.followUpLabel}>How long do stamps stay active?</div>
              <select
                value={config.expiryDays}
                onChange={e => setConfig(prev => ({ ...prev, expiryDays: parseInt(e.target.value) || 90 }))}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, marginTop: 8, boxSizing: "border-box" }}
              >
                <option value="30">30 days (1 month)</option>
                <option value="60">60 days (2 months)</option>
                <option value="90">90 days (3 months) — recommended</option>
                <option value="180">6 months</option>
                <option value="365">1 year</option>
              </select>
              <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginTop: 6 }}>
                Most programs use 90 days — fair for customers, manageable for you.
              </div>
            </div>

            <button style={s.primaryBtn} onClick={handleConfigure}>
              See projected impact →
            </button>
            <button style={s.secondaryBtn} onClick={() => setStep(1)}>
              ← Back to goals
            </button>
          </div>
        )}

        {/* ── Step 3: Simulator ── */}
        {step === 3 && (
          <>
            <div style={s.card}>
              <div style={s.question}>Here's what this program could look like:</div>
              <div style={s.recCard}>
                <div style={s.recDetails}>
                  <div><strong>Program:</strong> {goal?.title}</div>
                  <div><strong>Reward:</strong> {rewardLabel} after {config.threshold} visits</div>
                  <div><strong>Stamps active for:</strong> {config.expiryDays <= 30 ? "1 month" : config.expiryDays <= 60 ? "2 months" : config.expiryDays <= 90 ? "3 months" : config.expiryDays <= 180 ? "6 months" : "1 year"}</div>
                </div>
              </div>
            </div>

            {simulatorData && (
              <PromotionSimulator simulatorData={simulatorData} mode="new" objective={selectedGoal} />
            )}

            <div style={{ marginTop: 16 }}>
              <button style={s.primaryBtn} onClick={() => setStep(4)}>
                Looks good — let's launch it →
              </button>
              <button style={s.secondaryBtn} onClick={() => setStep(2)}>
                ← Adjust settings
              </button>
            </div>
          </>
        )}

        {/* ── Step 4: Name & Publish ── */}
        {step === 4 && (
          <div style={s.card}>
            {created ? (
              <>
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>&#10003;</div>
                  <div style={s.question}>Program created as Draft!</div>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>
                    Your program has been saved. Head to Promotions to review, stage, and go live when you're ready.
                  </div>
                  <button style={s.primaryBtn} onClick={() => navigate("/merchant/promotions")}>
                    Go to Promotions →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={s.question}>Almost there! Give your program a name:</div>
                <input
                  type="text"
                  value={config.promoName}
                  onChange={e => setConfig(prev => ({ ...prev, promoName: e.target.value }))}
                  placeholder={`e.g., ${goal?.title || "Loyalty"} Program`}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 15, marginBottom: 16, boxSizing: "border-box" }}
                />

                {/* Program details summary */}
                <div style={{ background: C.bg, borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Program Details</div>
                  <div><strong>Goal:</strong> {goal?.title}</div>
                  <div><strong>Type:</strong> {goal?.rewardType === "discount_fixed" ? "Fixed discount" : goal?.rewardType === "discount_pct" ? "Percentage discount" : "Free item"}</div>
                  <div><strong>Threshold:</strong> {config.threshold} visits</div>
                  <div><strong>Reward:</strong> {rewardLabel}</div>
                  <div><strong>Stamps active for:</strong> {config.expiryDays <= 30 ? "1 month" : config.expiryDays <= 60 ? "2 months" : config.expiryDays <= 90 ? "3 months" : config.expiryDays <= 180 ? "6 months" : "1 year"}</div>
                </div>

                {/* Start / End dates */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Start Date (optional)</label>
                    <input
                      type="date"
                      value={config.startAt}
                      onChange={e => setConfig(prev => ({ ...prev, startAt: e.target.value }))}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, boxSizing: "border-box" }}
                    />
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Leave blank to start when you go live.</div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 4 }}>End Date (optional)</label>
                    <input
                      type="date"
                      value={config.endAt}
                      onChange={e => setConfig(prev => ({ ...prev, endAt: e.target.value }))}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, boxSizing: "border-box" }}
                    />
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Leave blank for an ongoing program.</div>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
                  Your program will be saved as a <strong>Draft</strong>. You can review it on the Promotions page, then stage and go live when you're ready.
                </div>

                <button style={s.primaryBtn} onClick={handlePublish} disabled={publishing}>
                  {publishing ? "Creating..." : "Save as Draft"}
                </button>
                <button style={{ ...s.secondaryBtn, marginTop: 8 }} onClick={() => setStep(3)}>
                  ← Back to preview
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
