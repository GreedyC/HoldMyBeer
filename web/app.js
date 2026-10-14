const $ = (id) => document.getElementById(id);
let dirty = false;
let session = null,
  sessions = [],
  moments = [],
  recorder = null,
  stream = null,
  chunks = [],
  recordingStarted = 0,
  timer = null;
const basePrompts = [
  ["account", "Which account or workspace should be selected?"],
  ["done", "What proves the task is finished?"],
  ["stop", "When should your agent stop and ask you?"],
];
let prompts = [...basePrompts];
const defaultSteps = [];
const practiceSteps = [
  {goal: "Upload the new file", check: "Media receives the fresh filename", action: "upload", target: "Media", input: "filename"},
  {goal: "Enter the supplied caption", check: "Caption contains fresh text", action: "fill", target: "Caption", input: "caption"},
  {goal: "Save the draft", check: "Saved receipt appears", action: "click", target: "Save draft"},
  {goal: "Verify retained draft", check: "Draft id and both inputs match retained storage", action: "verify_draft"},
];
function collectSteps() {
  return [...$("steps").querySelectorAll(".step")].map(d => {
    const step = {goal: d.querySelector('[data-field="goal"]').value, check: d.querySelector('[data-field="check"]').value};
    const action = d.querySelector('[data-field="action"]').value;
    if (action) {
      step.action = action;
      if (action !== "verify_draft") step.target = d.querySelector('[data-field="target"]').value;
      if (action === "upload") step.input = "filename";
      if (action === "fill") step.input = "caption";
    }
    return step;
  });
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 3500);
}
async function api(path, options = {}) {
  const r = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!r.ok) {
    const raw = await r.text();
    let d;
    try {
      d = JSON.parse(raw);
    } catch {
      d = { detail: raw };
    }
    throw Error(
      typeof d.detail === "string" ? d.detail : `Request failed (${r.status})`,
    );
  }
  return r.json();
}
function textEl(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}
function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
function setTab(name) {
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => (p.hidden = p.id !== name));
  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
    b.setAttribute("aria-selected", String(b.dataset.tab === name));
  });
}
document
  .querySelectorAll("[data-tab]")
  .forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
function renderNav() {
  const nav = $("sessions");
  nav.replaceChildren();
  for (const s of sessions) {
    const b = textEl("button", s.title, s.id === session?.id ? "selected" : "");
    b.onclick = () => selectSession(s.id);
    nav.append(b);
  }
}
function renderQuestions() {
  const box = $("questions");
  box.replaceChildren();
  for (const [key, prompt] of prompts) {
    const d = textEl("div", "", "question");
    const l = textEl("label", prompt);
    l.htmlFor = `answer-${key}`;
    const a = document.createElement("textarea");
    a.id = `answer-${key}`;
    a.value = session.answers?.[key] || "";
    a.placeholder = "Add your guidance…";
    d.append(l, a);
    box.append(d);
  }
}
function renderSteps() {
  const box = $("steps");
  box.replaceChildren();
  for (const [i, step] of (session.procedure?.steps?.length
    ? session.procedure.steps
    : defaultSteps
  ).entries()) {
    const d = textEl("div", "", "step");
    for (const [field, label] of [
      ["goal", `${String(i + 1).padStart(2, "0")} / ACTION`],
      ["check", "SUCCESS CHECK"],
    ]) {
      const l = textEl("label", label);
      l.htmlFor = `step-${i}-${field}`;
      const inp = document.createElement("input");
      inp.id = l.htmlFor;
      inp.dataset.field = field;
      inp.value = step[field] || "";
      d.append(l, inp);
    }
    const label = textEl("label", "EXECUTABLE ACTION");
    label.htmlFor = `step-${i}-action`;
    const action = document.createElement("select");
    action.id = label.htmlFor;
    action.dataset.field = "action";
    for (const [value, name] of [["", "Notes only"], ["upload", "Upload fresh file"], ["fill", "Fill fresh caption"], ["click", "Click exact button"], ["verify_draft", "Verify retained draft"]]) {
      const option = textEl("option", name); option.value = value; action.append(option);
    }
    action.value = step.action || "";
    const targetLabel = textEl("label", "EXACT LABEL / BUTTON NAME");
    targetLabel.htmlFor = `step-${i}-target`;
    const target = document.createElement("input"); target.id = targetLabel.htmlFor;
    target.dataset.field = "target"; target.value = step.target || "";
    const updateTarget = () => { target.disabled = !action.value || action.value === "verify_draft"; $("reviewed").checked = false; };
    action.onchange = updateTarget;
    updateTarget();
    const remove = textEl("button", "Remove step", "quiet");
    remove.type = "button";
    remove.onclick = () => { session.procedure.steps = collectSteps().filter((_, n) => n !== i); dirty = true; renderSteps(); };
    d.append(label, action, targetLabel, target, remove);
    box.append(d);
  }
  $("revision").textContent = session.procedure?.revision || 1;
}
function renderMoments() {
  const box = $("moments");
  box.replaceChildren();
  $("momentCount").textContent = `${moments.length} marked`;
  if (!moments.length) {
    box.append(
      textEl(
        "p",
        "Pause your video at a decision and mark the moment.",
        "empty",
      ),
    );
    return;
  }
  moments.forEach((m, i) => {
    const row = textEl("div", "", "moment");
    const seek = textEl("button", formatTime(m.time));
    seek.onclick = () => {
      $("video").currentTime = m.time;
    };
    const note = document.createElement("input");
    note.setAttribute("aria-label", `Note at ${formatTime(m.time)}`);
    note.value = m.note;
    note.maxLength = 70;
    note.placeholder = "What matters at this moment?";
    note.oninput = () => ((moments[i].note = note.value), (dirty = true));
    const remove = textEl("button", "×");
    remove.setAttribute("aria-label", "Remove moment");
    remove.onclick = () => {
      moments.splice(i, 1);
      dirty = true;
      renderMoments();
    };
    row.append(seek, note, remove);
    box.append(row);
  });
}
function renderRun(run) {
  $("runStatus").textContent = run.status.replaceAll("_", " ").toUpperCase();
  const box = $("results");
  box.replaceChildren();
  box.append(
    textEl(
      "div",
      run.status === "verified"
        ? "Draft saved. Evidence retained."
        : run.status === "needs_teaching"
          ? "A teaching moment."
          : "Trial failed.",
      "run-summary",
    ),
  );
  if (run.failure) box.append(textEl("div", run.failure, "failure"));
  for (const step of run.steps) {
    const row = textEl("div", "", "run-step");
    row.append(textEl("span", step.status === "passed" ? "✓" : "↳", "tick"));
    const body = document.createElement("div");
    body.append(textEl("strong", step.goal), textEl("p", step.evidence));
    row.append(body);
    box.append(row);
  }
  if (run.draft_id)
    box.append(
      textEl(
        "div",
        `Retained draft: ${run.draft_id} · ${run.mode === "procedure" ? "Reviewed revision " + run.revision : "Legacy practice routine"}`,
        "receipt",
      ),
    );
  if (run.screenshot_url) {
    const img = document.createElement("img");
    img.className = "run-image";
    img.src = run.screenshot_url;
    img.alt = "Actual browser screenshot from this trial";
    box.append(img);
  }
}
async function selectSession(id) {
  if (dirty && session) {
    try {
      await save();
    } catch (e) {
      toast("Save failed; keeping this workflow open. " + e.message);
      return;
    }
  }
  if (recorder?.state === "recording") {
    toast("Stop recording before changing workflows.");
    return;
  }
  try {
    session = await api(`/api/sessions/${id}`);
    dirty = false;
    $("title").value = session.title;
    $("notes").value = session.notes || "";
    try {
      moments = JSON.parse(session.answers?.moments || "[]");
    } catch {
      moments = [];
    }
    try {
      const proposedQuestions = JSON.parse(session.answers?.agent_questions || "[]");
      prompts = [...basePrompts, ...proposedQuestions.map(q => ["agent-" + q.id, q.question])];
    } catch { prompts = [...basePrompts]; }
    renderNav();
    renderObservations();
    renderQuestions();
    renderSteps();
    renderMoments();
    $("video").hidden = !session.media_url;
    $("videoEmpty").hidden = !!session.media_url;
    $("video").src = session.media_url || "";
    $("mediaState").textContent = session.media_url
      ? "RECORDING RETAINED"
      : "NO RECORDING YET";
    renderHistory();
    if (session.runs?.length) renderRun(session.runs.at(-1));
    else {
      $("runStatus").textContent = "AWAITING TRIAL";
      $("results").replaceChildren(
        textEl(
          "p",
          "Run the practice workflow to collect real browser evidence.",
          "empty",
        ),
      );
    }
  } catch (e) {
    toast(e.message);
  }
}
async function refresh() {
  sessions = (await api("/api/sessions")).sessions;
  renderNav();
}
async function newSession() {
  try {
    if (dirty) await save();
    const title = "New workflow";
    if (!title?.trim()) return;
    const s = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title: title.trim() }),
    });
    await refresh();
    await selectSession(s.id);
  } catch (e) {
    toast(e.message);
  }
}
$("newSession").onclick = newSession;
async function save(revision = false) {
  if (!session) return;
  const answers = { ...session.answers, moments: JSON.stringify(moments) };
  for (const [key] of prompts) answers[key] = $(`answer-${key}`).value;
  const steps = collectSteps();
  session = await api(`/api/sessions/${session.id}`, {
    method: "PUT",
    body: JSON.stringify({
      title: $("title").value.trim(),
      notes: $("notes").value,
      answers,
      procedure: {
        revision: (session.procedure?.revision || 1) + (revision || JSON.stringify(steps) !== JSON.stringify(session.procedure?.steps || [], (key, value) => value === null ? undefined : value) ? 1 : 0),
        steps,
      },
    }),
  });
  $("revision").textContent = session.procedure.revision;
  dirty = false;
  await refresh();
  toast(revision ? "Teaching revision saved." : "Notes saved.");
  return session;
}
$("save").onclick = () => save().catch((e) => toast(e.message));
$("saveProcedure").onclick = () => save(true).catch((e) => toast(e.message));
$("addStep").onclick = () => {
  session.procedure.steps = collectSteps();
  if (session.procedure.steps.length >= 20) {
    toast("Keep this procedure to 20 checkpoints.");
    return;
  }
  dirty = true;
  session.procedure.steps.push({ goal: "", check: "" });
  renderSteps();
};
$("addMoment").onclick = () => {
  if (!$("video").src && !recordingStarted) {
    toast("Record or import a video first.");
    return;
  }
  const time =
    recorder?.state === "recording"
      ? (Date.now() - recordingStarted) / 1000
      : $("video").currentTime;
  if (moments.length >= 15) {
    toast("Preview limit: 15 teaching moments.");
    return;
  }
  dirty = true;
  moments.push({
    time: Math.max(0, Number.isFinite(time) ? time : 0),
    note: "",
  });
  renderMoments();
};
async function uploadVideo(blob) {
  if (blob.size > 100 * 1024 * 1024)
    throw Error("Video exceeds the 100 MB preview limit.");
  $("mediaState").textContent = "SAVING RECORDING…";
  const result = await api(`/api/sessions/${session.id}/media`, {
    method: "POST",
    headers: { "Content-Type": blob.type.split(";")[0] || "video/webm" },
    body: blob,
  });
  session.media_url = result.url;
  $("video").src = `${result.url}?t=${Date.now()}`;
  $("video").hidden = false;
  $("videoEmpty").hidden = true;
  $("mediaState").textContent = "RECORDING RETAINED";
  toast("Recording saved locally.");
  await save();
}
$("recordStart").onclick = async () => {
  try {
    if (!navigator.mediaDevices?.getDisplayMedia)
      throw Error(
        "Screen capture needs a supported browser on localhost or HTTPS. You can import a video instead.",
      );
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    chunks = [];
    const mime = ["video/webm;codecs=vp9", "video/webm"].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      $("recordStart").hidden = false;
      $("recordStop").hidden = true;
      recordingStarted = 0;
      try {
        await uploadVideo(new Blob(chunks, { type: recorder.mimeType }));
      } catch (e) {
        toast(e.message);
        $("mediaState").textContent = "RECORDING SAVE FAILED";
      }
    };
    stream.getVideoTracks()[0].onended = () => {
      if (recorder.state === "recording") recorder.stop();
    };
    recordingStarted = Date.now();
    recorder.start(1000);
    $("recordStart").hidden = true;
    $("recordStop").hidden = false;
    $("mediaState").textContent = "● RECORDING";
    timer = setInterval(
      () =>
        ($("timer").textContent = formatTime(
          (Date.now() - recordingStarted) / 1000,
        )),
      500,
    );
  } catch (e) {
    stream?.getTracks().forEach((t) => t.stop());
    toast(e.message);
  }
};
$("recordStop").onclick = () => {
  if (recorder?.state === "recording") recorder.stop();
};
$("importVideo").onchange = async (e) => {
  if (recorder?.state === "recording") {
    toast("Stop recording before importing.");
    e.target.value = "";
    return;
  }
  const file = e.target.files[0];
  if (!file) return;
  try {
    await uploadVideo(file);
  } catch (e) {
    toast(e.message);
  }
  e.target.value = "";
};
$("run").onclick = async () => {
  const b = $("run");
  if (recorder?.state === "recording") {
    toast("Stop recording before running a trial.");
    return;
  }
  if (!$("reviewed").checked) { toast("Review the actions in Explain the why, then authorize this trial."); return; }
  b.disabled = true;
  b.textContent = "Browser trial running…";
  $("runStatus").textContent = "RUNNING";
  $("results").replaceChildren(
    textEl("p", "Opening the practice app and checking fresh inputs…", "empty"),
  );
  try {
    await save();
    const run = await api(`/api/sessions/${session.id}/run`, {
      method: "POST",
      body: JSON.stringify({
        caption: $("caption").value,
        filename: $("filename").value,
        variant: $("variant").value,
        repair: false,
        mode: "procedure",
      }),
    });
    session.runs.push(run);
    renderHistory();
    renderRun(run);
    toast(
      run.status === "verified"
        ? "Draft verified in retained storage."
        : "Trial stopped. Review the evidence.",
    );
  } catch (e) {
    toast(e.message);
    $("runStatus").textContent = "FAILED";
  } finally {
    b.disabled = false;
    b.textContent = "Run reviewed procedure ↗";
  }
};
async function boot() {
  try {
    await api("/api/status");
    await refresh();
    if (!sessions.length) {
      const s = await api("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ title: "Prepare a video draft" }),
      });
      await refresh();
      await selectSession(s.id);
    } else await selectSession(sessions[0].id);
  } catch (e) {
    toast(`Could not load workspace: ${e.message}`);
  }
}
boot();

document.addEventListener("input", (e) => {
  if (
    ["title", "notes"].includes(e.target.id) ||
    e.target.closest("#questions,#steps")
  )
    { dirty = true; if (e.target.closest("#steps")) $("reviewed").checked = false; }
});
window.addEventListener("beforeunload", (e) => {
  if (dirty || recorder?.state === "recording") {
    e.preventDefault();
    e.returnValue = "";
  }
});

function renderHistory() {
  const select = $("runHistory");
  select.replaceChildren();
  for (const [i, run] of (session.runs || []).entries()) {
    const option = textEl(
      "option",
      `Trial ${i + 1} · ${run.status.replaceAll("_", " ")} · ${run.caption.slice(0, 30)}`,
    );
    option.value = run.id;
    select.append(option);
  }
  select.hidden = !session.runs?.length;
  if (session.runs?.length) select.value = session.runs.at(-1).id;
}
$("runHistory").onchange = () => {
  const run = session.runs.find((r) => r.id === $("runHistory").value);
  if (run) renderRun(run);
};

$("loadPractice").onclick = () => {
  session.procedure.steps = structuredClone(practiceSteps);
  dirty = true; renderSteps(); toast("Practice actions loaded. Review them before saving.");
};
$("importProcedure").onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    if (file.size > 30000) throw Error("Procedure JSON must be smaller than 30 KB.");
    const proposal = JSON.parse(await file.text());
    if (!Array.isArray(proposal.steps) || proposal.steps.length > 20) throw Error("Expected a procedure with up to 20 steps.");
    if (proposal.steps.some(step => !step || typeof step.goal !== "string" || typeof step.check !== "string" || (step.target != null && typeof step.target !== "string"))) throw Error("Each step needs text goal, check and optional target.");
    if (proposal.steps.some(step => step.action && !["upload", "fill", "click", "verify_draft"].includes(step.action))) throw Error("Unsupported action. Use upload, fill, click or verify_draft.");
    session.procedure.steps = proposal.steps; dirty = true; renderSteps(); setTab("teach");
    toast("Agent proposal imported for review. Nothing has run.");
  } catch (error) { toast(error.message); }
  e.target.value = "";
};

function renderObservations() {
  const box = $("observations"); box.replaceChildren();
  let observations = [];
  try { observations = JSON.parse(session.answers?.agent_observations || "[]"); } catch {}
  if (!observations.length) return;
  box.append(textEl("h3", "Agent observations · review against your recording"));
  for (const observation of observations) {
    const row = textEl("p", `${formatTime(observation.timestamp)} · ${observation.text}`);
    box.append(row);
  }
}
$("loadProposal").onclick = async () => {
  try {
    const {proposal} = await api(`/api/sessions/${session.id}/proposal`);
    if (!proposal) { toast("No agent proposal yet. Connect the MCP tools and ask your agent to inspect this recording."); return; }
    const observations = JSON.stringify(proposal.observations);
    for (const [key] of prompts) session.answers[key] = $(`answer-${key}`).value;
    session.answers.agent_observations = observations;
    session.answers.agent_questions = JSON.stringify(proposal.questions);
    session.answers.proposal_id = proposal.id;
    prompts = [...basePrompts, ...proposal.questions.map(q => ["agent-" + q.id, q.question])];
    session.procedure.steps = proposal.procedure.steps;
    dirty = true; renderObservations(); renderQuestions(); renderSteps();
    toast("Agent proposal loaded for review. Save a reviewed revision before trying it.");
  } catch (error) { toast(error.message); }
};
