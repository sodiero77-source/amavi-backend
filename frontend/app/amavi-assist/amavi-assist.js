const state = {
  residents: [],
  treatmentPlans: [],
  objectives: [],
  calendarSessions: [],
  selectedObjective: null,
  selectedCalendarSession: null,
  currentGenerationId: null,
};

const elements = {
  apiBaseUrl: document.querySelector("#apiBaseUrl"),
  facilityId: document.querySelector("#facilityId"),
  actorId: document.querySelector("#actorId"),
  actorRole: document.querySelector("#actorRole"),
  staffId: document.querySelector("#staffId"),
  bearerToken: document.querySelector("#bearerToken"),
  residentSelect: document.querySelector("#residentSelect"),
  residentId: document.querySelector("#residentId"),
  objectiveSelect: document.querySelector("#objectiveSelect"),
  calendarSessionSelect: document.querySelector("#calendarSessionSelect"),
  serviceType: document.querySelector("#serviceType"),
  sessionTopic: document.querySelector("#sessionTopic"),
  interventionCategory: document.querySelector("#interventionCategory"),
  clinicalIntervention: document.querySelector("#clinicalIntervention"),
  draftOutput: document.querySelector("#draftOutput"),
  printPreview: document.querySelector("#printPreview"),
  historyList: document.querySelector("#historyList"),
  message: document.querySelector("#message"),
  loadResidentsButton: document.querySelector("#loadResidentsButton"),
  generateButton: document.querySelector("#generateButton"),
  historyButton: document.querySelector("#historyButton"),
  printPreviewButton: document.querySelector("#printPreviewButton"),
};

function apiBase() {
  return elements.apiBaseUrl.value.replace(/\/$/, "");
}

function authHeaders(includeJson = true) {
  const headers = {
    "x-actor-id": elements.actorId.value.trim(),
    "x-actor-role": elements.actorRole.value.trim(),
    "x-facility-id": elements.facilityId.value.trim(),
    "x-request-id": crypto.randomUUID(),
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  const token = elements.bearerToken.value.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers: {
      ...authHeaders(options.body !== undefined),
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(" ")
      : data?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function showMessage(text, type = "success") {
  elements.message.textContent = text;
  elements.message.className = `alert visible ${type}`;
}

function clearMessage() {
  elements.message.textContent = "";
  elements.message.className = "alert";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function requireWorkflowHeaders() {
  const missing = [];
  if (!elements.facilityId.value.trim()) missing.push("Facility ID");
  if (!elements.actorId.value.trim()) missing.push("Actor ID");
  if (!elements.staffId.value.trim()) missing.push("Staff ID");

  if (missing.length > 0) {
    throw new Error(`Missing required header/workflow fields: ${missing.join(", ")}`);
  }
}

async function loadResidents() {
  clearMessage();
  requireWorkflowHeaders();

  const residents = await apiRequest("/api/residents", { method: "GET" });
  state.residents = Array.isArray(residents) ? residents : [];

  elements.residentSelect.innerHTML = [
    '<option value="">Select resident</option>',
    ...state.residents.map(
      (resident) =>
        `<option value="${escapeHtml(resident.id)}">${escapeHtml(resident.firstName)} ${escapeHtml(resident.lastName)} (${escapeHtml(resident.id)})</option>`,
    ),
  ].join("");

  showMessage("Residents loaded.", "success");
}

async function onResidentSelected(value) {
  if (!value) return;
  elements.residentId.value = value;
  await Promise.all([loadTreatmentPlanObjectives(), loadCalendar()]);
}

async function loadTreatmentPlanObjectives() {
  const residentId = elements.residentId.value.trim();
  if (!residentId) return;

  const plans = await apiRequest(
    `/api/treatment-plans?residentId=${encodeURIComponent(residentId)}`,
    { method: "GET" },
  );

  state.treatmentPlans = Array.isArray(plans) ? plans : [];
  state.objectives = state.treatmentPlans.flatMap((plan) =>
    (plan.problems ?? []).flatMap((problem) =>
      (problem.goals ?? []).flatMap((goal) =>
        (goal.objectives ?? []).map((objective) => ({
          treatmentPlanId: plan.id,
          problemId: problem.id,
          problem: problem.description,
          goalId: goal.id,
          goal: goal.description,
          objectiveId: objective.id,
          objective: objective.description,
        })),
      ),
    ),
  );

  elements.objectiveSelect.innerHTML = [
    '<option value="">Select objective</option>',
    ...state.objectives.map(
      (item, index) =>
        `<option value="${index}">${escapeHtml(item.problem)} / ${escapeHtml(item.goal)} / ${escapeHtml(item.objective)}</option>`,
    ),
  ].join("");
}

async function loadCalendar() {
  const residentId = elements.residentId.value.trim();
  if (!residentId) return;

  const sessions = await apiRequest(
    `/api/amavi-assist/calendar/${encodeURIComponent(residentId)}`,
    { method: "GET" },
  );

  state.calendarSessions = Array.isArray(sessions) ? sessions : [];
  elements.calendarSessionSelect.innerHTML = [
    '<option value="">Select calendar session</option>',
    ...state.calendarSessions.map(
      (session, index) =>
        `<option value="${index}">${escapeHtml(formatDate(session.scheduledFor))} - ${escapeHtml(session.serviceType)} - ${escapeHtml(session.sessionTopic)}</option>`,
    ),
  ].join("");
}

function onObjectiveSelected(indexValue) {
  state.selectedObjective =
    indexValue === "" ? null : state.objectives[Number(indexValue)];
}

function onCalendarSessionSelected(indexValue) {
  state.selectedCalendarSession =
    indexValue === "" ? null : state.calendarSessions[Number(indexValue)];

  const session = state.selectedCalendarSession;
  if (!session) return;

  elements.serviceType.value = session.serviceType ?? elements.serviceType.value;
  elements.sessionTopic.value = session.sessionTopic ?? elements.sessionTopic.value;

  const matchingObjectiveIndex = state.objectives.findIndex(
    (item) =>
      item.treatmentPlanId === session.treatmentPlanId &&
      item.problemId === session.problemId &&
      item.goalId === session.goalId &&
      item.objectiveId === session.objectiveId,
  );

  if (matchingObjectiveIndex >= 0) {
    elements.objectiveSelect.value = String(matchingObjectiveIndex);
    onObjectiveSelected(String(matchingObjectiveIndex));
  }
}

function buildInterventionDetail() {
  const category = elements.interventionCategory.value;
  const detail = elements.clinicalIntervention.value.trim();

  if (detail) return `${category}: ${detail}`;
  return `${category}: Addressed the selected session topic within the documented treatment-plan objective.`;
}

async function generateDraft() {
  clearMessage();
  requireWorkflowHeaders();

  const selectedObjective = state.selectedObjective;
  if (!selectedObjective) {
    throw new Error("Select a treatment plan objective before generating a draft.");
  }

  const residentId = elements.residentId.value.trim();
  const serviceType = elements.serviceType.value.trim();
  const sessionTopic = elements.sessionTopic.value.trim();

  if (!residentId || !serviceType || !sessionTopic) {
    throw new Error("Resident ID, service type, and session topic are required.");
  }

  const payload = {
    residentId,
    facilityId: elements.facilityId.value.trim(),
    treatmentPlanId: selectedObjective.treatmentPlanId,
    problemId: selectedObjective.problemId,
    goalId: selectedObjective.goalId,
    objectiveId: selectedObjective.objectiveId,
    serviceType,
    sessionTopic,
    staffId: elements.staffId.value.trim(),
    clinicalIntervention: buildInterventionDetail(),
  };

  if (state.selectedCalendarSession) {
    payload.treatmentCalendarSessionId = state.selectedCalendarSession.id;
  }

  const generation = await apiRequest("/api/amavi-assist/generate-note-draft", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  state.currentGenerationId = generation.id;
  elements.printPreviewButton.disabled = false;
  elements.draftOutput.value = formatDraftForEditing(generation.generatedOutput);
  showMessage("Draft generated. Review and edit before any signing workflow.", "success");
}

function formatDraftForEditing(generatedOutput) {
  const draft = generatedOutput?.clinicalNoteDraft;
  if (!draft) {
    return JSON.stringify(generatedOutput, null, 2);
  }

  return [
    "Status: DRAFT - Requires clinician review",
    "",
    `Focus: ${draft.focus ?? ""}`,
    "",
    "Treatment Plan Alignment:",
    `Problem: ${draft.treatmentPlanAlignment?.problem ?? ""}`,
    `Goal: ${draft.treatmentPlanAlignment?.goal ?? ""}`,
    `Objective: ${draft.treatmentPlanAlignment?.objective ?? ""}`,
    "",
    "Intervention:",
    draft.intervention ?? "",
    "",
    "Response:",
    draft.response ?? "",
    "",
    "Plan:",
    draft.plan ?? "",
    "",
    "Compliance note: This is an AI-assisted draft and is not signed documentation.",
  ].join("\n");
}

async function loadGenerationHistory() {
  clearMessage();
  requireWorkflowHeaders();
  const residentId = elements.residentId.value.trim();
  if (!residentId) throw new Error("Resident ID is required to load history.");

  const history = await apiRequest(
    `/api/amavi-assist/generation-history/${encodeURIComponent(residentId)}`,
    { method: "GET" },
  );

  if (!Array.isArray(history) || history.length === 0) {
    elements.historyList.innerHTML = '<p class="muted">No generated drafts found.</p>';
    return;
  }

  elements.historyList.innerHTML = history
    .map(
      (item) => `
        <div class="history-item">
          <strong>${escapeHtml(item.serviceType)} - ${escapeHtml(item.sessionTopic)}</strong>
          <span class="muted">Generated ${escapeHtml(formatDate(item.createdAt))} | DRAFT | Regeneration count: ${escapeHtml(item.regenerationCount)}</span>
          <button class="secondary-button" type="button" data-generation-id="${escapeHtml(item.id)}">Load print preview</button>
        </div>
      `,
    )
    .join("");
}

async function loadPrintPreview(generationId = state.currentGenerationId) {
  clearMessage();
  requireWorkflowHeaders();

  if (!generationId) {
    throw new Error("Generate or select a draft before loading print preview.");
  }

  const printOutput = await apiRequest(
    `/api/amavi-assist/generated-note-drafts/${encodeURIComponent(generationId)}/print`,
    { method: "GET" },
  );

  state.currentGenerationId = generationId;
  elements.printPreviewButton.disabled = false;
  renderPrintPreview(printOutput.document);
  showMessage("Print preview loaded from facility settings.", "success");
}

function renderPrintPreview(documentModel) {
  const header = documentModel.header ?? {};
  const resident = documentModel.resident ?? {};
  const service = documentModel.service ?? {};
  const draft = documentModel.draft ?? {};
  const linkage = documentModel.treatmentPlanLinkage;
  const audit = documentModel.auditMetadata;

  elements.printPreview.innerHTML = `
    <div class="print-header">
      <div>
        <h2 class="print-title">${escapeHtml(documentModel.title)}</h2>
        <p class="muted">${escapeHtml(header.facilityLegalName)}</p>
        ${header.dbaName ? `<p class="muted">DBA: ${escapeHtml(header.dbaName)}</p>` : ""}
        ${header.address ? `<p class="muted">${escapeHtml(header.address)}</p>` : ""}
        ${header.phone ? `<p class="muted">${escapeHtml(header.phone)}</p>` : ""}
        ${header.licenseNumber ? `<p class="muted">License: ${escapeHtml(header.licenseNumber)}</p>` : ""}
      </div>
      ${header.logoUrl ? `<img class="print-logo" src="${escapeHtml(header.logoUrl)}" alt="Facility logo" />` : ""}
    </div>

    <div class="print-meta">
      <p><strong>Resident</strong><br />${escapeHtml(resident.firstName)} ${escapeHtml(resident.lastName)}</p>
      <p><strong>Date of birth</strong><br />${escapeHtml(formatDate(resident.dateOfBirth))}</p>
      <p><strong>Status</strong><br />DRAFT - not signed</p>
      <p><strong>Service</strong><br />${escapeHtml(service.serviceType)}</p>
      <p><strong>Topic</strong><br />${escapeHtml(service.sessionTopic)}</p>
      <p><strong>Scheduled</strong><br />${escapeHtml(formatDate(service.scheduledFor))}</p>
    </div>

    ${
      documentModel.aiDraftDisclaimer
        ? `<div class="print-section print-disclaimer"><p>${escapeHtml(documentModel.aiDraftDisclaimer)}</p></div>`
        : ""
    }

    <div class="print-section">
      <h3>Draft note content</h3>
      <p><strong>Focus:</strong> ${escapeHtml(draft.focus)}</p>
      <p><strong>Intervention:</strong> ${escapeHtml(draft.intervention)}</p>
      <p><strong>Response:</strong> ${escapeHtml(draft.response)}</p>
      <p><strong>Plan:</strong> ${escapeHtml(draft.plan)}</p>
    </div>

    ${
      linkage
        ? `<div class="print-section">
            <h3>Treatment plan linkage</h3>
            <p><strong>Problem:</strong> ${escapeHtml(linkage.problem)}</p>
            <p><strong>Goal:</strong> ${escapeHtml(linkage.goal)}</p>
            <p><strong>Objective:</strong> ${escapeHtml(linkage.objective)}</p>
          </div>`
        : ""
    }

    ${
      audit
        ? `<div class="print-section">
            <h3>Audit metadata</h3>
            <p><strong>Generation ID:</strong> ${escapeHtml(audit.generationId)}</p>
            <p><strong>Request ID:</strong> ${escapeHtml(audit.requestId)}</p>
            <p><strong>Generated:</strong> ${escapeHtml(formatDate(audit.createdAt))}</p>
            <p><strong>Regeneration count:</strong> ${escapeHtml(audit.regenerationCount)}</p>
          </div>`
        : ""
    }

    <div class="print-footer">
      ${escapeHtml(documentModel.footer?.disclaimer ?? "Draft output for clinician review.")}
    </div>
  `;
}

function hydrateFromStorage() {
  for (const id of ["apiBaseUrl", "facilityId", "actorId", "actorRole", "staffId", "bearerToken"]) {
    const saved = localStorage.getItem(`amaviAssist.${id}`);
    if (saved && elements[id]) elements[id].value = saved;
  }
}

function persistConnectionSettings() {
  for (const id of ["apiBaseUrl", "facilityId", "actorId", "actorRole", "staffId", "bearerToken"]) {
    elements[id].addEventListener("change", () => {
      localStorage.setItem(`amaviAssist.${id}`, elements[id].value);
    });
  }
}

function bindEvents() {
  elements.loadResidentsButton.addEventListener("click", () =>
    loadResidents().catch((error) => showMessage(error.message, "error")),
  );

  elements.residentSelect.addEventListener("change", (event) =>
    onResidentSelected(event.target.value).catch((error) =>
      showMessage(error.message, "error"),
    ),
  );

  elements.residentId.addEventListener("change", () =>
    Promise.all([loadTreatmentPlanObjectives(), loadCalendar()]).catch((error) =>
      showMessage(error.message, "error"),
    ),
  );

  elements.objectiveSelect.addEventListener("change", (event) =>
    onObjectiveSelected(event.target.value),
  );

  elements.calendarSessionSelect.addEventListener("change", (event) =>
    onCalendarSessionSelected(event.target.value),
  );

  elements.generateButton.addEventListener("click", () =>
    generateDraft().catch((error) => showMessage(error.message, "error")),
  );

  elements.historyButton.addEventListener("click", () =>
    loadGenerationHistory().catch((error) => showMessage(error.message, "error")),
  );

  elements.printPreviewButton.addEventListener("click", () =>
    loadPrintPreview().catch((error) => showMessage(error.message, "error")),
  );

  elements.historyList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-generation-id]");
    if (!button) return;
    loadPrintPreview(button.dataset.generationId).catch((error) =>
      showMessage(error.message, "error"),
    );
  });
}

hydrateFromStorage();
persistConnectionSettings();
bindEvents();
