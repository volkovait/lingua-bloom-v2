/** Инлайн CSS интерактивного урока (портирован из reference/style.css). */
export const LESSON_CSS = `:root {
  --bg: #faf0e6;
  --card: #fffef8;
  --border: #e6dcc8;
  --text: #2a241c;
  --muted: #6b5f52;
  --accent: #3d6b4a;
  --accent-soft: #e8f1ea;
  --danger: #a63d3d;
  --radius: 14px;
  --shadow: 0 10px 30px rgba(42, 36, 28, 0.08);
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: "DM Sans", system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.55;
}

h1,
h2,
h3 {
  font-family: "Source Serif 4", Georgia, serif;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.page {
  max-width: 860px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}

#test-root.test-root {
  min-height: 4rem;
}

.init-error {
  padding: 1rem 1.25rem;
  border-radius: var(--radius);
  background: #fdecea;
  border: 1px solid #f0c4c0;
  color: var(--danger);
}

header.intro {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.5rem 1.75rem;
  margin-bottom: 1.75rem;
}

header.intro h1 {
  margin: 0 0 0.35rem;
  font-size: 1.65rem;
}

header.intro p {
  margin: 0.35rem 0 0;
  color: var(--muted);
  font-size: 0.98rem;
}

label.student-label {
  display: block;
  font-weight: 600;
  margin-top: 1.1rem;
  margin-bottom: 0.35rem;
}

input[type="text"].student-name {
  width: 100%;
  max-width: 420px;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: #fff;
  font: inherit;
}

input[type="text"].student-name:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.notice {
  margin-top: 1rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: var(--accent-soft);
  border: 1px solid #c9dccf;
  color: #243228;
  font-size: 0.92rem;
}

.part {
  margin-bottom: 2rem;
}

.part-title {
  font-size: 1.35rem;
  margin: 0 0 1rem;
  padding-bottom: 0.35rem;
  border-bottom: 2px solid var(--border);
}

.exercise {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.25rem 1.4rem 1.4rem;
  margin-bottom: 1.25rem;
}

.exercise h3 {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
}

.exercise > p.instruction {
  margin: 0 0 1rem;
  color: var(--muted);
  font-size: 0.95rem;
}

.question {
  padding: 0.95rem 0;
  border-top: 1px solid var(--border);
}

.question:first-of-type {
  border-top: none;
  padding-top: 0;
}

.question-id {
  font-weight: 700;
  color: var(--accent);
  font-size: 0.85rem;
  margin-bottom: 0.35rem;
}

.question-prompt {
  margin: 0 0 0.65rem;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.option {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.45rem 0.55rem;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
}

.option:hover {
  background: #f7f4ec;
  border-color: #ebe3d4;
}

.option input {
  margin-top: 0.2rem;
  accent-color: var(--accent);
}

.option span {
  flex: 1;
}

.audio-block {
  margin: 0.75rem 0 1rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: #f3f7ff;
  border: 1px solid #d5e0f5;
}

.audio-block audio {
  width: 100%;
  max-width: 520px;
  display: block;
}

.audio-hint {
  margin: 0.5rem 0 0;
  font-size: 0.88rem;
  color: var(--muted);
}

.reading-passage .passage {
  margin-top: 0.75rem;
  padding: 1rem 1.1rem;
  border-radius: 12px;
  background: #fff;
  border: 1px dashed var(--border);
  font-size: 0.95rem;
}

.reading-passage .passage p {
  margin: 0 0 0.75rem;
}

.reading-passage .passage p:last-child {
  margin-bottom: 0;
}

.actions {
  position: sticky;
  bottom: 0;
  background: linear-gradient(180deg, transparent, var(--bg) 18%);
  padding: 1.25rem 0 0;
  margin-top: 1rem;
}

button#finish-btn {
  appearance: none;
  border: none;
  border-radius: 12px;
  padding: 0.85rem 1.4rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  background: var(--accent);
  color: #fff;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 8px 22px rgba(61, 107, 74, 0.28);
}

button#finish-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.result-panel {
  margin-top: 1.25rem;
  padding: 1rem 1.15rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: #fff;
  display: none;
}

.result-panel.visible {
  display: block;
}

.result-panel h3 {
  margin-top: 0;
}

.result-panel .score {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--accent);
}

.result-panel .error {
  color: var(--danger);
  margin-top: 0.5rem;
}

body.test-locked .option,
body.test-locked input.student-name,
body.test-locked button#finish-btn {
  cursor: default;
}

body.test-locked .option:hover {
  background: transparent;
  border-color: transparent;
}

.question.question-correct {
  background: #e8f5e9;
  border-radius: 12px;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  margin-left: -0.5rem;
  margin-right: -0.5rem;
  border: 1px solid #b7dfbf;
}

.question.question-incorrect {
  background: #fdecea;
  border-radius: 12px;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  margin-left: -0.5rem;
  margin-right: -0.5rem;
  border: 1px solid #f0c4c0;
}

select.answer-select {
  width: 100%;
  max-width: 420px;
  margin-top: 0.25rem;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: #fff;
  font: inherit;
  cursor: pointer;
}

select.answer-select:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

body.test-locked select.answer-select {
  cursor: default;
  opacity: 0.92;
}

.word-order-wrap {
  margin-top: 0.5rem;
}

.wo-bank-label,
.wo-answer-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
  margin: 0.5rem 0 0.35rem;
}

.wo-bank {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.65rem;
  border-radius: 12px;
  background: #f7f4ec;
  border: 1px dashed var(--border);
  min-height: 2.75rem;
}

.wo-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  border: 1px solid #d8cfc0;
  background: #fff;
  font: inherit;
  font-size: 0.92rem;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.wo-chip:active {
  cursor: grabbing;
}

.wo-chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.wo-answer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  min-height: 3rem;
  padding: 0.65rem;
  border-radius: 12px;
  border: 2px dashed #cfc4b2;
  background: #fff;
  margin-bottom: 0.35rem;
}

.wo-answer.wo-drag-over {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.wo-hint {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: var(--muted);
}

.gap-drag-wrap .gap-sentence {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.35rem;
  line-height: 1.75;
}

.gap-fill-wrap .gap-fill-sentence {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.35rem;
  line-height: 1.75;
}

.gap-fill-input {
  min-width: 5.5rem;
  max-width: 100%;
  padding: 0.35rem 0.5rem;
  font: inherit;
  border: 1px solid var(--border, #c5cbe3);
  border-radius: 0.35rem;
  background: var(--surface, #fff);
  box-sizing: border-box;
}

.gap-fill-input:focus {
  outline: 2px solid var(--accent-soft, rgba(64, 86, 161, 0.25));
  border-color: var(--accent, #4056a1);
}

body.test-locked .gap-fill-input {
  opacity: 0.85;
  cursor: not-allowed;
}

.match-pairs-wrap {
  margin-top: 0.5rem;
}

.match-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.65rem;
}

.match-stem-num {
  flex: 0 0 auto;
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--muted);
}

.match-stem-text {
  flex: 1 1 40%;
  min-width: 140px;
}

.match-slot {
  flex: 1 1 220px;
  min-height: 2.75rem;
  margin-bottom: 0;
}

body.test-locked .wo-chip {
  cursor: default;
}

.hidden-answer-field {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.select-wrap {
  display: block;
  margin-top: 0.35rem;
}
`
