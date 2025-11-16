import React, { useState } from "react";

/** ===========================
 *  Apple-y Medical UI (no deps)
 *  – Glass cards, gradients, blur
 *  – RadAI reveal, clinician notes
 *  – Google Sheets logging (SHEET_WEBAPP_URL)
 *  =========================== */

// Put your Google Apps Script Web App URL here
const SHEET_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzIwT2hO2YJ-lhKsZDnCYERu79OyP8K_dBNSbSxPAq6VlRvUYdinbP9fUHd-y0o8F4/exec";

const CALIBRATION_TEXT = `AI imaging systems can be confidently wrong.
Confidence reflects the model’s internal certainty, not ground truth.
Treat confidence as one signal among many.`;

const CASES = [
  // 1️⃣ AI correct + high confidence (baseline trust)
  {
    id: "baseline_pna",
    caseText:
      "65-year-old woman with 3 days of fever and productive cough. Evaluate for infection. Modality: Chest X-ray.",
    aiText: "Right lower-lobe pneumonia detected.",
    aiConfidence: 94,
    imageUrl:
      "https://prod-images-static.radiopaedia.org/images/8574902/36d072cbef28e107a0236c61ada278_gallery.jpeg",
    imageAlt: "Chest X-ray showing right lower-lobe consolidation",
  },

  // 2️⃣ AI vs radiologist disagreement (ambiguous, subtle)
  {
    id: "conflict_ptx",
    caseText:
      "54-year-old man with sudden onset of pleuritic chest pain. Portable chest X-ray, slightly underinflated.",
    aiText: "Small right apical pneumothorax detected.",
    aiConfidence: 82,
    imageUrl:
      "https://prod-images-static.radiopaedia.org/images/8574902/36d072cbef28e107a0236c61ada278_gallery.jpeg",
    imageAlt: "Chest X-ray with possible small right apical pneumothorax",
  },

  // 3️⃣ AI confidently wrong (overtrust trap)
  {
    id: "overconf_normfail",
    caseText:
      "70-year-old man with progressive dyspnea and orthopnea. Evaluate for acute decompensation. Modality: Chest X-ray.",
    aiText: "No acute cardiopulmonary abnormality. Normal study.",
    aiConfidence: 99,
    imageUrl: "/cxr_edema_03.jpg",
    imageAlt:
      "Chest X-ray with cardiomegaly and Kerley B lines suggesting pulmonary edema",
  },
];

function nowIso() {
  return new Date().toISOString();
}

export default function App() {
  const [pid, setPid] = useState("");
  const [step, setStep] = useState<"consent" | "onboarding" | "trial" | "done">(
    "consent"
  );
  const [trial, setTrial] = useState(0);
  const [responses, setResponses] = useState<any[]>([]);
  const [choice, setChoice] = useState<"radiologist" | "ai" | null>(null);
  const [conf, setConf] = useState(50);
  const [note, setNote] = useState("");
  const [radAIShown, setRadAIShown] = useState(false);
  const [showWarn, setShowWarn] = useState(false);
  const [warnedThisTrial, setWarnedThisTrial] = useState(false);

  const current = CASES[trial];
  const progress = ((step === "trial" ? trial : 0) / CASES.length) * 100;
  function isLikelyDisagreement(note: string, aiText: string) {
    const stop = new Set([
      "a",
      "an",
      "the",
      "study",
      "detected",
      "present",
      "normal",
      "likely",
      "possible",
      "suggests",
      "with",
      "without",
      "of",
      "and",
      "or",
      "is",
      "are",
      "to",
      "for",
      "small",
      "large",
      "multifocal",
    ]);
    const aiWords = aiText
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);
    const keywords = aiWords.filter((w) => !stop.has(w));
    const hits = keywords.filter((w) => note.toLowerCase().includes(w)).length;
    return keywords.length > 0 && hits === 0;
  }

async function logToSheet(entry: any) {
  if (!SHEET_WEBAPP_URL) return;
  try {
    await fetch(SHEET_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      mode: "no-cors", // 👈 critical for Apps Script
    });
  } catch (e) {
    console.error("Sheet log failed:", e);
  }
}
  function next() {
    const entry = {
      pid,
      timestamp: nowIso(),
      trialId: current.id,
      caseText: current.caseText,
      radiologist: current.radiologist,
      aiText: current.aiText,
      aiConfidence: current.aiConfidence,
      choice,
      confidence: conf,
      clinicianNote: note,
      radAIShown,
    };
    setResponses((r) => [...r, entry]);
    logToSheet(entry);

    if (trial < CASES.length - 1) {
      setTrial(trial + 1);
      setChoice(null);
      setConf(50);
      setNote("");
      setRadAIShown(false);
    } else {
      setStep("done");
    }
  }

  // Lightbox state
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  // Small component for the image panel
  function ImagePanel({ src, alt }: { src?: string; alt?: string }) {
    if (!src) {
      return (
        <Panel title="Study Image" tone="muted">
          <div className="imgEmpty">No image for this vignette.</div>
        </Panel>
      );
    }
    return (
      <Panel title="Study Image">
        <div
          className="imgBox"
          onClick={() => setZoomSrc(src)}
          role="button"
          tabIndex={0}
        >
          <img className="img" src={src} alt={alt || "study image"} />
          <div className="imgHint">Click to zoom</div>
        </div>
      </Panel>
    );
  }

  return (
    <>
      <Style />
      <div className="page">
        <div className="shell">
          <header className="topbar">
            <div className="branding">
              <div className="logoDot" />
              <div>
                <div className="title">RadAI Study</div>
                <div className="subtitle">AI as a Second Reader</div>
              </div>
            </div>
            <div className="pill">CS 139 • HCAI</div>
          </header>

          <div className="progressWrap" aria-hidden>
            <div className="progressBg">
              <div
                className="progressFg"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {step === "consent" && (
            <main className="grid">
              <Card title="Welcome">
                <p className="desc">
                  You’ll review brief radiology case vignettes. Some AI outputs
                  are intentionally varied to study decision-making. This is not
                  medical advice.
                </p>
                <div className="field">
                  <label>Participant ID</label>
                  <input
                    placeholder="e.g., EM1234"
                    value={pid}
                    onChange={(e) => setPid(e.target.value)}
                  />
                </div>
                <div className="actions">
                  <Button
                    disabled={!pid.trim()}
                    onClick={() => setStep("onboarding")}
                  >
                    Begin
                  </Button>
                </div>
              </Card>

              <Card title="About the Study">
                <ul className="bullets">
                  <li>Mixed-initiative decision support (Radiologist + AI)</li>
                  <li>Trust calibration & mental model alignment</li>
                  <li>Measures: reliance, confidence, free-text rationale</li>
                </ul>
              </Card>
            </main>
          )}

          {step === "onboarding" && (
            <main className="grid">
              <Card title="Calibration Onboarding (15s)">
                <pre className="calibration">{CALIBRATION_TEXT}</pre>
                <div className="actions">
                  <Button onClick={() => setStep("trial")}>Continue</Button>
                </div>
              </Card>
            </main>
          )}

          {step === "trial" && (
            <main className="grid">
              <Card
                title={`Case ${trial + 1} / ${CASES.length}`}
                right={<Badge text="Vignette" />}
              >
                <InfoRow label="Patient / Study" value={current.caseText} />

                {/* ADD: Image panel */}
                <div className="row2">
                  <ImagePanel src={current.imageUrl} alt={current.imageAlt} />
                </div>

                {/* Existing row with Radiologist + RadAI panels */}
                {/* Row with ONLY RadAI panel (no radiologist text shown) */}
                <div className="row2">
                  <Panel
                    title="RadAI"
                    tone={radAIShown ? "ai" : "muted"}
                    right={
                      radAIShown ? (
                        <Chip>{`${current.aiConfidence}%`}</Chip>
                      ) : null
                    }
                  >
                    {!radAIShown ? (
                      <Button
                        variant="outline"
                        onClick={() => setRadAIShown(true)}
                      >
                        Reveal RadAI Finding
                      </Button>
                    ) : (
                      <div className="radaiReveal">
                        <div className="finding">{current.aiText}</div>
                        <div className="caption">
                          Confidence {current.aiConfidence}% • Confidence ≠
                          correctness
                        </div>
                      </div>
                    )}
                  </Panel>
                </div>
              </Card>
              <Card title="Your Read">
                <div className="row2">
                  <div>
                    <label className="label">Clinician Findings</label>
                    <textarea
                      className="note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Impression, key findings, next steps…"
                    />
                  </div>

                  <div>
                    <label className="label">Reliance Choice</label>
                    <div className="seg">
                      <SegButton
                        active={choice === "radiologist"}
                        onClick={() => setChoice("radiologist")}
                      >
                        Radiologist
                      </SegButton>
                      <SegButton
                        active={choice === "ai"}
                        onClick={() => setChoice("ai")}
                      >
                        RadAI
                      </SegButton>
                    </div>

                    <div className="confWrap">
                      <div className="confHead">
                        <span>Confidence</span>
                        <span className="value">{conf}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={conf}
                        onChange={(e) => setConf(Number(e.target.value))}
                        className="slider"
                      />
                      <div className="scale">
                        <span>0</span>
                        <span>50</span>
                        <span>100</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="actions end">
                  <Button
                    disabled={!choice}
                    onClick={() => {
                      // show warning only once per trial
                      if (!warnedThisTrial) {
                        const noRadAIViewed = !radAIShown;
                        const maybeDisagree =
                          note.trim() &&
                          isLikelyDisagreement(note, current.aiText);
                        if (noRadAIViewed || maybeDisagree) {
                          setShowWarn(true);
                          setWarnedThisTrial(true);
                          return;
                        }
                      }
                      next();
                      if (trial < CASES.length - 1) {
                        setTrial(trial + 1);
                        setChoice(null);
                        setConf(50);
                        setNote("");
                        setRadAIShown(false);
                        setWarnedThisTrial(false); // <— reset for the new case
                      } else {
                        setStep("done");
                      }
                    }}
                  >
                    {trial === CASES.length - 1 ? "Finish" : "Next Case"}
                  </Button>
                </div>
              </Card>
            </main>
          )}

          {step === "done" && (
            <main className="grid">
              <Card title="All set—thank you!">
                <p className="desc">
                  Your session is complete. You can verify logging in your
                  Google Sheet or copy the JSON below.
                </p>
                <pre className="json">{JSON.stringify(responses, null, 2)}</pre>
              </Card>
            </main>
          )}

          <footer className="foot">
            <span>© RadAI Study • For research use only</span>
          </footer>
        </div>
      </div>
      {showWarn && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modalBackdrop" onClick={() => setShowWarn(false)} />
          <div className="modalCard">
            <h3 className="modalTitle">Before you continue</h3>
            {!radAIShown ? (
              <p className="modalText">
                You haven’t viewed the Radiology AI result yet. It may{" "}
                <em>disagree</em> with your current impression. Would you like
                to check RadAI before moving on?
              </p>
            ) : (
              <p className="modalText">
                Your note appears to differ from the RadAI finding. Consider
                reviewing the AI output before continuing.
              </p>
            )}
            <div className="modalActions">
              {!radAIShown && (
                <button
                  className="btn outline"
                  onClick={() => {
                    setRadAIShown(true);
                    setShowWarn(false);
                  }}
                >
                  Reveal RadAI
                </button>
              )}
              <button
                className="btn outline"
                onClick={() => setShowWarn(false)}
              >
                Keep Editing
              </button>
              <button
                className="btn solid"
                onClick={() => {
                  setShowWarn(false);
                  next();
                }}
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomSrc && (
        <div className="lightbox" onClick={() => setZoomSrc(null)}>
          <div className="lightboxBackdrop" />
          <img className="lightboxImg" src={zoomSrc} alt="zoomed" />
        </div>
      )}
    </>
  );
}

/* ======== Small UI components ======== */
function Card({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="cardHead">
        <h2>{title}</h2>
        {right && <div>{right}</div>}
      </div>
      <div className="cardBody">{children}</div>
    </section>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "solid",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "solid" | "outline";
}) {
  return (
    <button
      className={`btn ${variant} ${disabled ? "disabled" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Badge({ text }: { text: string }) {
  return <span className="badge">{text}</span>;
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="chip">{children}</span>;
}

function Panel({
  title,
  children,
  right,
  tone = "neutral",
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  tone?: "neutral" | "ai" | "muted";
}) {
  return (
    <div className={`panel ${tone}`}>
      <div className="panelHead">
        <span>{title}</span>
        {right}
      </div>
      <div className="panelBody">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoRow">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
    </div>
  );
}

function SegButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button className={`segBtn ${active ? "active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

/* ======== CSS (injected) ======== */
function Style() {
  return (
    <style>{`
:root{
  --bg: #0b0f14;
  --card: rgba(255,255,255,0.06);
  --card-border: rgba(255,255,255,0.14);
  --glass: rgba(255,255,255,0.05);
  --text: #e8edf3;
  --muted: #9fb0c3;
  --link: #7cc4ff;
  --accent: #7cc4ff;
  --ai: #b4ffcf;
  --aiText: #0d3b2c;
}

*{ box-sizing: border-box; }
html, body, #root { height: 100%; }
body{ margin:0; background: radial-gradient(1200px 800px at 20% -10%, #122034 0%, #0b0f14 60%), #0b0f14; color: var(--text); font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Inter,system-ui,Roboto,Helvetica,Arial,"Apple Color Emoji","Segoe UI Emoji"; }

.page{ min-height: 100%; display:flex; }
.shell{ width: 100%; max-width: 1100px; margin: 0 auto; padding: 28px 20px 40px; }

.topbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom: 18px; }
.branding{ display:flex; align-items:center; gap:12px; }
.logoDot{ width: 18px; height: 18px; border-radius: 50%; background: conic-gradient(from 220deg,#7cc4ff, #b4ffcf); box-shadow: 0 0 30px #7cc4ff55; }
.title{ font-weight: 600; letter-spacing: -0.01em; }
.subtitle{ font-size: 12px; color: var(--muted); margin-top:2px; }
.pill{ font-size:12px; color:#0b1320; background: linear-gradient(180deg,#e6f4ff,#bfe7ff); border: 1px solid #9ed7ff; border-radius: 999px; padding:6px 10px; font-weight:600; }

.progressWrap{ padding: 2px 0 14px; }
.progressBg{ height: 6px; width: 100%; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; }
.progressFg{ height: 100%; background: linear-gradient(90deg,#7cc4ff,#b4ffcf); }

.grid{ display:grid; grid-template-columns: 1fr; gap: 16px; }
@media(min-width: 900px){ .grid{ grid-template-columns: 1.2fr 1fr; } }

.card{
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: 18px;
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 40px rgba(0,0,0,0.35);
}
.cardHead{ display:flex; align-items:center; justify-content:space-between; padding: 16px 16px 10px; }
.cardHead h2{ margin:0; font-size: 16px; font-weight: 600; letter-spacing: .01em; }
.cardBody{ padding: 0 16px 14px; }

.desc{ color: var(--muted); line-height: 1.6; }

.field{ margin-top: 12px; }
.field label{ display:block; font-size: 12px; color: var(--muted); margin-bottom:6px; }
.field input{
  width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.16);
  background: rgba(255,255,255,0.04); color: var(--text); outline: none;
}
.field input:focus{ border-color: #7cc4ff; box-shadow: 0 0 0 3px #7cc4ff22; }

.actions{ display:flex; gap:10px; margin-top: 14px; }
.actions.end{ justify-content: flex-end; }

.btn{
  border-radius: 12px; padding: 10px 14px; font-weight: 600; letter-spacing: .01em; transition: transform .02s ease, background .2s ease, border .2s ease;
  border: 1px solid rgba(255,255,255,0.15);
}
.btn.solid{ background: linear-gradient(180deg,#d5f0ff,#9ed7ff); color: #0f1722; }
.btn.solid:hover{ filter: brightness(1.03); }
.btn.outline{ background: rgba(255,255,255,0.03); color: var(--text); }
.btn.outline:hover{ background: rgba(255,255,255,0.06); }
.btn.disabled{ opacity: .5; cursor: not-allowed; }

.badge{
  font-size: 11px; color: #072337; background: linear-gradient(180deg,#d5f0ff,#bfe7ff); border: 1px solid #9ed7ff;
  padding: 6px 10px; border-radius: 999px; font-weight: 700;
}

.infoRow{ display:flex; gap:14px; align-items:flex-start; padding: 10px 0 2px; }
.infoRow .label{ min-width: 160px; color: var(--muted); font-size: 13px; }
.infoRow .value{ color: var(--text); }

.row2{ display:grid; grid-template-columns: 1fr; gap: 12px; margin-top: 10px; }
@media(min-width: 900px){ .row2{ grid-template-columns: 1fr 1fr; } }

.panel{
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 12px;
  background: var(--glass);
}
.panel.muted{ opacity: .8; }
.panel.ai{ border-color: #59d89b55; background: linear-gradient(180deg, rgba(180,255,207,0.06), rgba(255,255,255,0.02)); }
.panelHead{ display:flex; align-items:center; justify-content:space-between; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
.panelBody{ font-size: 14px; color: var(--text); }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace; font-size: 13px; line-height: 1.5; color: #dce7f3; }

.chip{
  border-radius: 999px; padding: 6px 10px; border: 1px solid #59d89b66;
  background: #b4ffcf22; color: #b4ffcf; font-weight: 700; font-size: 12px;
}

.radaiReveal .finding{ font-weight: 600; margin-bottom: 4px; }
.radaiReveal .caption{ font-size: 12px; color: var(--muted); }

.label{ display:block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
.note{
  width: 100%; min-height: 140px; padding: 12px; border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.04); color: var(--text);
  outline: none; resize: vertical;
}
.note:focus{ border-color: #7cc4ff; box-shadow: 0 0 0 3px #7cc4ff22; }

.seg{
  display: inline-flex; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
  border-radius: 999px; padding: 4px; gap: 4px; margin-bottom: 12px;
}
.segBtn{
  padding: 8px 14px; border-radius: 999px; background: transparent; color: var(--muted);
  border: 1px solid transparent; font-weight: 600;
}
.segBtn.active{
  background: linear-gradient(180deg,#d5f0ff,#9ed7ff); color: #081424; border-color: #9ed7ff;
}

.confWrap{ margin-top: 6px; }
.confHead{ display:flex; align-items:center; justify-content:space-between; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
.slider{ width: 100%; appearance: none; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.08); outline: none; }
.slider::-webkit-slider-thumb{
  appearance: none; width: 18px; height: 18px; border-radius: 50%;
  background: linear-gradient(180deg,#d5f0ff,#9ed7ff); border: 1px solid #8fd0ff; box-shadow: 0 2px 10px rgba(124,196,255,.45);
}
.scale{ display:flex; justify-content:space-between; font-size: 12px; color: var(--muted); margin-top: 4px; }

.calibration{
  margin: 8px 0 0; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.14); color: #cfe6ff; white-space: pre-wrap;
}

.json{
  margin-top: 10px; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.14); color: #d8e7f7; max-height: 300px; overflow: auto;
}

.foot{ margin-top: 18px; color: #8da2b6; font-size: 12px; display:flex; justify-content:center; }

/* === Modal === */
.modal{ position: fixed; inset: 0; z-index: 80; display:flex; align-items:center; justify-content:center; }
.modalBackdrop{ position: absolute; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(4px); }
.modalCard{
  position: relative; width: min(560px, 92vw);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 16px; padding: 16px; color: var(--text);
  box-shadow: 0 20px 80px rgba(0,0,0,.5); backdrop-filter: blur(10px);
}
.modalTitle{ margin: 0 0 6px; font-size: 16px; font-weight: 700; letter-spacing: .01em; }
.modalText{ color: var(--muted); line-height: 1.6; margin: 0 0 10px; }
.modalActions{ display:flex; gap:10px; justify-content:flex-end; margin-top: 8px; }

      `}</style>
  );
}
