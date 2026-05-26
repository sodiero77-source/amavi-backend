"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";

type Tab = "today" | "pass" | "mar" | "handoff";
type MedStatus =
  | "ADMINISTERED"
  | "REFUSED"
  | "MISSED"
  | "HELD"
  | "OUT_OF_MEDICATION"
  | "MEDICATION_ERROR";

interface Resident {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

interface Schedule {
  id: string;
  residentId: string;
  medicationOrderId: string;
  type: "SCHEDULED" | "PRN";
  scheduledTime?: string | null;
  scheduledDays?: string[];
  instructions?: string | null;
  isActive?: boolean;
}

interface MedOrder {
  id: string;
  residentId: string;
  medicationName: string;
  dose: string;
  route: string;
  frequency: string;
  status: string;
  schedules?: Schedule[];
}

interface Administration {
  id: string;
  residentId: string;
  medicationOrderId: string;
  scheduleId?: string | null;
  administrationDate: string;
  status: MedStatus;
  administeredAt?: string | null;
  administeredByInitials: string;
  reason?: string | null;
  notes?: string | null;
  prnIndication?: string | null;
  prnFollowUpAt?: string | null;
  prnEffectiveness?: string | null;
}

interface Task {
  id: string;
  residentId?: string | null;
  title: string;
  status: string;
  dueAt?: string | null;
}

interface Note {
  id: string;
  residentId: string;
  title: string;
  status: string;
  updatedAt: string;
}

interface Alert {
  id: string;
  residentId?: string | null;
  title: string;
  detail: string;
  status: string;
  createdAt: string;
}

interface FacilitySettings {
  companyName: string;
  logoUrl?: string | null;
  clientLabel: string;
  residentReportLabel: string;
  governingBodyLabel: string;
  residentIdLabel: string;
  secondaryResidentIdLabel?: string | null;
  serviceCoordinatorLabel: string;
  evaluatorLeadLabel: string;
  goalsLabel: string;
}

interface DueMed {
  order: MedOrder;
  schedule: Schedule;
  resident?: Resident;
  dueAt: Date;
  administration?: Administration;
}

const defaultApiBase = "https://amavi-api.onrender.com/api";

const fallbackSettings: FacilitySettings = {
  companyName: "Amavi",
  logoUrl: null,
  clientLabel: "Resident",
  residentReportLabel: "Resident Report",
  governingBodyLabel: "Governing Body",
  residentIdLabel: "Resident ID",
  secondaryResidentIdLabel: null,
  serviceCoordinatorLabel: "Service Coordinator",
  evaluatorLeadLabel: "Evaluator Lead",
  goalsLabel: "Goals",
};

const demoResidents: Resident[] = [
  {
    id: "demo-resident-1",
    firstName: "Demo",
    lastName: "Resident",
    dateOfBirth: "1985-03-12T00:00:00.000Z",
  },
];

const demoOrders: MedOrder[] = [
  {
    id: "demo-order-1",
    residentId: "demo-resident-1",
    medicationName: "Demo Medication",
    dose: "10 mg",
    route: "PO",
    frequency: "Daily",
    status: "ACTIVE",
    schedules: [
      {
        id: "demo-schedule-1",
        residentId: "demo-resident-1",
        medicationOrderId: "demo-order-1",
        type: "SCHEDULED",
        scheduledTime: "08:00",
        scheduledDays: [],
        instructions: "Demo fallback schedule",
        isActive: true,
      },
    ],
  },
];

const demoTasks: Task[] = [
  {
    id: "demo-task-1",
    residentId: "demo-resident-1",
    title: "Demo fallback task",
    status: "OPEN",
    dueAt: new Date().toISOString(),
  },
];

const exceptionStatuses: MedStatus[] = [
  "REFUSED",
  "HELD",
  "MISSED",
  "OUT_OF_MEDICATION",
  "MEDICATION_ERROR",
];

const statusLabels: Record<MedStatus, string> = {
  ADMINISTERED: "Administer",
  REFUSED: "Refused",
  HELD: "Held",
  MISSED: "Missed",
  OUT_OF_MEDICATION: "Out of med",
  MEDICATION_ERROR: "Med error",
};

const marMarks: Record<MedStatus, string> = {
  ADMINISTERED: "",
  REFUSED: "R",
  HELD: "H",
  MISSED: "M",
  OUT_OF_MEDICATION: "O",
  MEDICATION_ERROR: "E",
};

function keyFor(date: Date) {
  return date.toISOString().slice(0, 10);
}

function nameOf(resident?: Resident) {
  return resident ? `${resident.firstName} ${resident.lastName}` : "Resident";
}

function timeOf(value?: string | Date | null) {
  if (!value) return "No time";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dateOf(value?: string | null) {
  if (!value) return "Not listed";
  return new Date(value).toLocaleDateString();
}

function dueAt(schedule: Schedule, anchor = new Date()) {
  const [hour, minute] = (schedule.scheduledTime ?? "00:00")
    .split(":")
    .map(Number);
  const date = new Date(anchor);
  date.setHours(Number.isFinite(hour) ? hour : 0);
  date.setMinutes(Number.isFinite(minute) ? minute : 0);
  date.setSeconds(0, 0);
  return date;
}

export default function OperationsPage() {
  const [tab, setTab] = useState<Tab>("today");
  const [apiBase, setApiBase] = useState(defaultApiBase);
  const [facilityId, setFacilityId] = useState("");
  const [actorId, setActorId] = useState("");
  const [actorRole, setActorRole] = useState("MEDTECH");
  const [token, setToken] = useState("");
  const [initials, setInitials] = useState("");
  const [message, setMessage] = useState("");
  const [residents, setResidents] = useState<Resident[]>([]);
  const [orders, setOrders] = useState<MedOrder[]>([]);
  const [administrations, setAdministrations] = useState<Administration[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [settings, setSettings] = useState<FacilitySettings>(fallbackSettings);
  const [fallbackNotice, setFallbackNotice] = useState("");
  const [selectedResidentId, setSelectedResidentId] = useState("");
  const [selectedMed, setSelectedMed] = useState<DueMed | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<MedStatus | null>(null);
  const [reason, setReason] = useState("");
  const [prnIndication, setPrnIndication] = useState("");
  const [prnEffectiveness, setPrnEffectiveness] = useState("");
  const [prnFollowUpAt, setPrnFollowUpAt] = useState("");

  const residentById = useMemo(
    () => new Map(residents.map((resident) => [resident.id, resident])),
    [residents],
  );
  const orderById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );
  const todayKey = keyFor(new Date());
  const todayAdministrations = administrations.filter(
    (item) => keyFor(new Date(item.administrationDate)) === todayKey,
  );
  const dueMeds: DueMed[] = orders.flatMap((order) =>
    (order.schedules ?? [])
      .filter((schedule) => schedule.isActive !== false && schedule.type === "SCHEDULED")
      .map((schedule) => ({
        order,
        schedule,
        resident: residentById.get(order.residentId),
        dueAt: dueAt(schedule),
        administration: todayAdministrations.find(
          (item) => item.medicationOrderId === order.id && item.scheduleId === schedule.id,
        ),
      })),
  );
  const activeDue = dueMeds.filter((item) => !item.administration);
  const overdue = activeDue.filter((item) => item.dueAt.getTime() < Date.now());
  const dueNow = activeDue.filter(
    (item) => item.dueAt.getTime() <= Date.now() + 90 * 60 * 1000,
  );
  const openTasks = tasks.filter((task) => task.status === "OPEN");
  const unsignedNotes = notes.filter((note) => note.status !== "SIGNED");
  const openAlerts = alerts.filter((alert) => alert.status === "OPEN");
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const exceptions24h = administrations.filter(
    (item) =>
      exceptionStatuses.includes(item.status) &&
      new Date(item.administrationDate) >= last24h,
  );
  const prns24h = administrations.filter(
    (item) => item.prnIndication && new Date(item.administrationDate) >= last24h,
  );
  const prnsToday = todayAdministrations.filter((item) => item.prnIndication);
  const selectedResident =
    residentById.get(selectedResidentId) ?? residents[0] ?? undefined;
  const residentOrders = selectedResident
    ? orders.filter((order) => order.residentId === selectedResident.id)
    : [];

  function headers(includeJson = true) {
    const headers: Record<string, string> = {
      "x-actor-id": actorId,
      "x-actor-role": actorRole,
      "x-facility-id": facilityId,
      "x-request-id": crypto.randomUUID(),
    };
    if (includeJson) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function api<T>(path: string, options: RequestInit = {}) {
    const response = await fetch(`${apiBase.replace(/\/$/, "")}${path}`, {
      ...options,
      headers: { ...headers(options.body !== undefined), ...(options.headers ?? {}) },
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error(data?.message ?? `Request failed ${response.status}`);
    return data as T;
  }

  async function loadResource<T>(
    label: string,
    path: string,
    fallback: T,
  ): Promise<{ data: T; error?: string }> {
    try {
      return { data: await api<T>(path) };
    } catch (error) {
      return {
        data: fallback,
        error:
          error instanceof Error
            ? `${label}: ${error.message}`
            : `${label}: request failed`,
      };
    }
  }

  async function load() {
    setMessage("");
    setFallbackNotice("");
    try {
      const settingsResult = await loadResource<FacilitySettings>(
        "facility settings",
        "/facility-settings",
        fallbackSettings,
      );
      const [residentData, orderData, adminData, taskData, noteData, alertData] =
        await Promise.all([
          loadResource<Resident[]>(
            "residents",
            "/residents",
            demoResidents,
          ),
          loadResource<MedOrder[]>(
            "medication orders",
            "/medication-orders",
            demoOrders,
          ),
          loadResource<Administration[]>(
            "medication administrations",
            "/medication-administrations",
            [],
          ),
          loadResource<Task[]>("tasks", "/tasks", demoTasks),
          loadResource<Note[]>("clinical notes", "/clinical-notes", []),
          loadResource<Alert[]>(
            "alerts",
            "/compliance-alerts",
            [],
          ),
        ]);

      const errors = [
        settingsResult.error,
        residentData.error,
        orderData.error,
        adminData.error,
        taskData.error,
        noteData.error,
        alertData.error,
      ].filter(Boolean);

      setSettings(settingsResult.data ?? fallbackSettings);
      setResidents(residentData.data);
      setOrders(orderData.data);
      setAdministrations(adminData.data);
      setTasks(taskData.data);
      setNotes(noteData.data);
      setAlerts(alertData.data);
      setSelectedResidentId((current) => current || residentData.data[0]?.id || "");
      setFallbackNotice(
        errors.length > 0
          ? `Demo fallback active because live API data could not be loaded. ${errors.join(" | ")}`
          : "",
      );
      setMessage(
        errors.length > 0
          ? "Live API unavailable. Showing clearly labeled demo fallback."
          : "Live work loaded from Render API.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load current work.");
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("amavi.operations");
    if (!saved) return;
    const parsed = JSON.parse(saved) as Record<string, string>;
    setApiBase(
      parsed.apiBase && parsed.apiBase !== "http://localhost:3000/api"
        ? parsed.apiBase
        : defaultApiBase,
    );
    setFacilityId(parsed.facilityId ?? "");
    setActorId(parsed.actorId ?? "");
    setActorRole(parsed.actorRole ?? "MEDTECH");
    setToken(parsed.token ?? "");
    setInitials(parsed.initials ?? "");
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "amavi.operations",
      JSON.stringify({ apiBase, facilityId, actorId, actorRole, token, initials }),
    );
  }, [apiBase, facilityId, actorId, actorRole, token, initials]);

  function openAction(item: DueMed, status: MedStatus) {
    setSelectedMed(item);
    setSelectedStatus(status);
    setReason("");
    setPrnIndication("");
    setPrnEffectiveness("");
    setPrnFollowUpAt(new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16));
  }

  async function submitAction() {
    if (!selectedMed || !selectedStatus) return;
    if (selectedMed.order.id.startsWith("demo-")) {
      setMessage("Demo fallback item only. Live medication actions require live API data.");
      return;
    }
    const payload: Record<string, unknown> = {
      residentId: selectedMed.order.residentId,
      medicationOrderId: selectedMed.order.id,
      scheduleId: selectedMed.schedule.id,
      administrationDate: new Date().toISOString(),
      status: selectedStatus,
      administeredByInitials: initials || actorId.slice(0, 2).toUpperCase() || "NA",
    };
    if (selectedStatus === "ADMINISTERED") payload.administeredAt = new Date().toISOString();
    if (selectedStatus !== "ADMINISTERED") {
      payload.reason = reason;
      payload.notes = reason;
    }
    if (selectedMed.schedule.type === "PRN") {
      payload.prnIndication = prnIndication;
      payload.prnEffectiveness = prnEffectiveness;
      payload.prnFollowUpAt = new Date(prnFollowUpAt).toISOString();
    }
    try {
      await api("/medication-administrations", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSelectedMed(null);
      setSelectedStatus(null);
      setMessage(`${statusLabels[selectedStatus]} recorded.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Medication action failed.");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-row">
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt="" className="facility-logo" />
          ) : null}
          <div>
          <p className="eyebrow">{settings.companyName} pilot operations</p>
          <h1>Today, medication pass, MAR, and shift handoff</h1>
          </div>
        </div>
        <Button type="button" onClick={load}>Load current work</Button>
      </header>

      <Card className="connection-card">
        <CardContent className="connection-grid">
          <label>API base<Input value={apiBase} onChange={(e) => setApiBase(e.target.value)} /></label>
          <label>Facility ID<Input value={facilityId} onChange={(e) => setFacilityId(e.target.value)} /></label>
          <label>Actor ID<Input value={actorId} onChange={(e) => setActorId(e.target.value)} /></label>
          <label>Role<Select value={actorRole} onChange={(e) => setActorRole(e.target.value)}><option>MEDTECH</option><option>STAFF</option><option>CLINICIAN</option><option>SUPERVISOR</option><option>ADMIN</option></Select></label>
          <label>Initials<Input value={initials} onChange={(e) => setInitials(e.target.value.toUpperCase())} /></label>
          <label>Bearer token<Input value={token} onChange={(e) => setToken(e.target.value)} /></label>
        </CardContent>
      </Card>

      {message ? <div className="status-line">{message}</div> : null}
      {fallbackNotice ? <div className="fallback-line">{fallbackNotice}</div> : null}

      <nav className="tabs">
        {[
          ["today", "Today"],
          ["pass", "Med Pass"],
          ["mar", "MAR Grid"],
          ["handoff", "Shift Handoff"],
        ].map(([key, label]) => (
          <button
            className={tab === key ? "tab active" : "tab"}
            key={key}
            type="button"
            onClick={() => setTab(key as Tab)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "today" ? (
        <TodayView
          dueNow={dueNow}
          overdue={overdue}
          prns={prnsToday}
          tasks={openTasks}
          notes={unsignedNotes}
          alerts={openAlerts}
          residentById={residentById}
          settings={settings}
          onAction={openAction}
          onSelectResident={setSelectedResidentId}
        />
      ) : null}

      {tab === "pass" ? (
        <MedPass
          residents={residents}
          selectedResident={selectedResident}
          selectedResidentId={selectedResident?.id ?? ""}
          residentOrders={residentOrders}
          dueMeds={dueMeds.filter((item) => item.order.residentId === selectedResident?.id)}
          settings={settings}
          onSelectResident={setSelectedResidentId}
          onAction={openAction}
        />
      ) : null}

      {tab === "mar" ? (
        <MarGrid
          residents={residents}
          selectedResident={selectedResident}
          orders={residentOrders}
          administrations={administrations}
          selectedResidentId={selectedResident?.id ?? ""}
          settings={settings}
          onSelectResident={setSelectedResidentId}
        />
      ) : null}

      {tab === "handoff" ? (
        <Handoff
          exceptions={exceptions24h}
          prns={prns24h}
          unsignedNotes={unsignedNotes}
          overdue={overdue}
          tasks={openTasks}
          alerts={openAlerts}
          residentById={residentById}
          orderById={orderById}
          settings={settings}
          onAction={openAction}
          onSelectResident={setSelectedResidentId}
        />
      ) : null}

      <Dialog
        open={Boolean(selectedMed && selectedStatus)}
        title={selectedStatus ? statusLabels[selectedStatus] : "Medication action"}
        onClose={() => setSelectedMed(null)}
      >
        {selectedMed && selectedStatus ? (
          <div className="dialog-body">
            <p className="med-title">
              {nameOf(selectedMed.resident)} - {selectedMed.order.medicationName} {selectedMed.order.dose}
            </p>
            <p className="muted">Due {timeOf(selectedMed.dueAt)} - {selectedMed.order.route}</p>
            {selectedStatus !== "ADMINISTERED" ? (
              <label>Reason or notes<Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            ) : null}
            {selectedMed.schedule.type === "PRN" ? (
              <div className="stack">
                <label>PRN indication<Input value={prnIndication} onChange={(e) => setPrnIndication(e.target.value)} /></label>
                <label>Follow-up time<Input type="datetime-local" value={prnFollowUpAt} onChange={(e) => setPrnFollowUpAt(e.target.value)} /></label>
                <label>Effectiveness<Textarea rows={3} value={prnEffectiveness} onChange={(e) => setPrnEffectiveness(e.target.value)} /></label>
              </div>
            ) : null}
            <div className="dialog-actions"><Button type="button" onClick={submitAction}>Record</Button></div>
          </div>
        ) : null}
      </Dialog>
    </main>
  );
}

function TodayView(props: {
  dueNow: DueMed[];
  overdue: DueMed[];
  prns: Administration[];
  tasks: Task[];
  notes: Note[];
  alerts: Alert[];
  residentById: Map<string, Resident>;
  settings: FacilitySettings;
  onAction: (item: DueMed, status: MedStatus) => void;
  onSelectResident: (id: string) => void;
}) {
  return (
    <div className="today-grid">
      <MedicationSection title="Overdue medications" items={props.overdue} tone="urgent" {...props} />
      <MedicationSection title="Due medications" items={props.dueNow} {...props} />
      <ListSection title="PRNs today" residentById={props.residentById} items={props.prns.map((item) => ({ id: item.id, residentId: item.residentId, title: item.prnIndication ?? "PRN administered", time: item.prnFollowUpAt ?? item.administrationDate, action: "Review" }))} />
      <ListSection title="Open tasks" residentById={props.residentById} items={props.tasks.map((item) => ({ id: item.id, residentId: item.residentId ?? undefined, title: item.title, time: item.dueAt, action: "Open" }))} />
      <ListSection title="Unsigned notes" residentById={props.residentById} items={props.notes.map((item) => ({ id: item.id, residentId: item.residentId, title: item.title, time: item.updatedAt, action: "Review" }))} />
      <ListSection title="Recent incidents/alerts" residentById={props.residentById} items={props.alerts.map((item) => ({ id: item.id, residentId: item.residentId ?? undefined, title: item.title, time: item.createdAt, action: "Review" }))} />
    </div>
  );
}

function MedicationSection({
  title,
  items,
  residentById,
  tone,
  onAction,
  onSelectResident,
}: {
  title: string;
  items: DueMed[];
  residentById: Map<string, Resident>;
  tone?: "urgent";
  onAction: (item: DueMed, status: MedStatus) => void;
  onSelectResident: (id: string) => void;
}) {
  return (
    <Card className={tone === "urgent" ? "urgent-card" : ""}>
      <CardHeader><CardTitle>{title}</CardTitle><span className="count">{items.length}</span></CardHeader>
      <CardContent className="list">
        {items.length === 0 ? <p className="muted">No items.</p> : null}
        {items.map((item) => (
          <div className="work-item" key={`${item.order.id}-${item.schedule.id}`}>
            <button className="resident-link" type="button" onClick={() => onSelectResident(item.order.residentId)}>{nameOf(residentById.get(item.order.residentId))}</button>
            <div><strong>{item.order.medicationName} {item.order.dose}</strong><p className="muted">Due {timeOf(item.dueAt)} - {item.order.route} - {item.schedule.instructions ?? item.order.frequency}</p></div>
            <div className="action-strip">
              <Button size="sm" onClick={() => onAction(item, "ADMINISTERED")}>Administer</Button>
              {exceptionStatuses.map((status) => <Button key={status} size="sm" variant={status === "MEDICATION_ERROR" ? "destructive" : "outline"} onClick={() => onAction(item, status)}>{statusLabels[status]}</Button>)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ListSection({
  title,
  items,
  residentById,
}: {
  title: string;
  items: Array<{ id: string; residentId?: string; title: string; time?: string | null; action: string }>;
  residentById: Map<string, Resident>;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><span className="count">{items.length}</span></CardHeader>
      <CardContent className="list">
        {items.length === 0 ? <p className="muted">No items.</p> : null}
        {items.map((item) => (
          <div className="compact-item" key={item.id}>
            <div><strong>{item.residentId ? nameOf(residentById.get(item.residentId)) : "Facility"}</strong><p>{item.title}</p><p className="muted">{item.time ? timeOf(item.time) : "No due time"}</p></div>
            <Button size="sm" variant="outline">{item.action}</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MedPass({
  residents,
  selectedResident,
  selectedResidentId,
  residentOrders,
  dueMeds,
  settings,
  onSelectResident,
  onAction,
}: {
  residents: Resident[];
  selectedResident?: Resident;
  selectedResidentId: string;
  residentOrders: MedOrder[];
  dueMeds: DueMed[];
  settings: FacilitySettings;
  onSelectResident: (id: string) => void;
  onAction: (item: DueMed, status: MedStatus) => void;
}) {
  return (
    <div className="split-view">
      <Card className="resident-list"><CardHeader><CardTitle>{settings.clientLabel}s</CardTitle></CardHeader><CardContent className="list">{residents.map((resident) => <button className={selectedResidentId === resident.id ? "resident-row active" : "resident-row"} key={resident.id} type="button" onClick={() => onSelectResident(resident.id)}><strong>{nameOf(resident)}</strong><span>DOB {dateOf(resident.dateOfBirth)}</span></button>)}</CardContent></Card>
      <Card><CardHeader><div><CardTitle>{nameOf(selectedResident)}</CardTitle><p className="muted">DOB {dateOf(selectedResident?.dateOfBirth)}</p></div><span className="allergy-box">Allergies: not available from current endpoint</span></CardHeader><CardContent className="stack"><h3>Due now</h3>{dueMeds.length === 0 ? <p className="muted">No due medications for this resident.</p> : null}{dueMeds.map((item) => <div className="work-item" key={`${item.order.id}-${item.schedule.id}`}><div><strong>{item.order.medicationName} {item.order.dose}</strong><p className="muted">{timeOf(item.dueAt)} - {item.order.route} - {item.order.frequency}</p></div><div className="action-strip"><Button size="sm" onClick={() => onAction(item, "ADMINISTERED")}>Administer</Button>{exceptionStatuses.map((status) => <Button key={status} size="sm" variant={status === "MEDICATION_ERROR" ? "destructive" : "outline"} onClick={() => onAction(item, status)}>{statusLabels[status]}</Button>)}</div></div>)}<h3>Active medications</h3>{residentOrders.map((order) => <div className="med-order" key={order.id}><strong>{order.medicationName} {order.dose}</strong><p className="muted">{order.route} - {order.frequency} - {order.status}</p>{(order.schedules ?? []).map((schedule) => <p className="schedule-line" key={schedule.id}>{schedule.type} {schedule.scheduledTime ?? "as needed"} {schedule.instructions ?? ""}</p>)}</div>)}</CardContent></Card>
    </div>
  );
}

function MarGrid({
  residents,
  selectedResident,
  selectedResidentId,
  orders,
  administrations,
  onSelectResident,
  settings,
}: {
  residents: Resident[];
  selectedResident?: Resident;
  selectedResidentId: string;
  orders: MedOrder[];
  administrations: Administration[];
  settings: FacilitySettings;
  onSelectResident: (id: string) => void;
}) {
  const days = Array.from({ length: 31 }, (_, index) => index + 1);
  const initials = Array.from(new Set(administrations.map((item) => item.administeredByInitials).filter(Boolean)));
  return (
    <Card><CardHeader><div><CardTitle>{settings.companyName} Monthly MAR</CardTitle><p className="muted">{nameOf(selectedResident)} - DOB {dateOf(selectedResident?.dateOfBirth)} - {settings.residentIdLabel}</p></div><Select value={selectedResidentId} onChange={(event) => onSelectResident(event.target.value)}>{residents.map((resident) => <option key={resident.id} value={resident.id}>{nameOf(resident)}</option>)}</Select></CardHeader><CardContent><div className="mar-allergies">Allergies: not available from current resident endpoint</div><div className="mar-scroll"><table className="mar-table"><thead><tr><th>Medication / schedule</th>{days.map((day) => <th key={day}>{day}</th>)}</tr></thead><tbody>{orders.flatMap((order) => (order.schedules ?? []).map((schedule) => <tr key={`${order.id}-${schedule.id}`}><td><strong>{order.medicationName}</strong><span>{order.dose} {order.route} - {schedule.type === "PRN" ? "PRN" : schedule.scheduledTime ?? order.frequency}</span></td>{days.map((day) => { const match = administrations.find((item) => item.medicationOrderId === order.id && item.scheduleId === schedule.id && new Date(item.administrationDate).getDate() === day); return <td className={match ? `mar-cell status-${match.status}` : "mar-cell"} key={day}>{match ? match.status === "ADMINISTERED" ? match.administeredByInitials : marMarks[match.status] : ""}</td>; })}</tr>))}</tbody></table></div><div className="initials-key"><strong>Staff initials key:</strong> {initials.length ? initials.join(", ") : "No administrations recorded"}</div></CardContent></Card>
  );
}

function Handoff({
  exceptions,
  prns,
  unsignedNotes,
  overdue,
  tasks,
  alerts,
  residentById,
  orderById,
  settings,
  onAction,
  onSelectResident,
}: {
  exceptions: Administration[];
  prns: Administration[];
  unsignedNotes: Note[];
  overdue: DueMed[];
  tasks: Task[];
  alerts: Alert[];
  residentById: Map<string, Resident>;
  orderById: Map<string, MedOrder>;
  settings: FacilitySettings;
  onAction: (item: DueMed, status: MedStatus) => void;
  onSelectResident: (id: string) => void;
}) {
  return (
    <div className="handoff-grid">
      <ListSection title="Last 24h medication exceptions" residentById={residentById} items={exceptions.map((item) => ({ id: item.id, residentId: item.residentId, title: `${orderById.get(item.medicationOrderId)?.medicationName ?? "Medication"} - ${item.status}`, time: item.administrationDate, action: "Review" }))} />
      <ListSection title="PRNs" residentById={residentById} items={prns.map((item) => ({ id: item.id, residentId: item.residentId, title: `${item.prnIndication ?? "PRN"} - ${item.prnEffectiveness ?? "follow-up pending"}`, time: item.prnFollowUpAt ?? item.administrationDate, action: "Review" }))} />
      <ListSection title="Unsigned notes" residentById={residentById} items={unsignedNotes.map((item) => ({ id: item.id, residentId: item.residentId, title: item.title, time: item.updatedAt, action: "Review" }))} />
      <MedicationSection title="Overdue meds" items={overdue} residentById={residentById} tone="urgent" onAction={onAction} onSelectResident={onSelectResident} />
      <ListSection title="Overdue/open tasks" residentById={residentById} items={tasks.map((item) => ({ id: item.id, residentId: item.residentId ?? undefined, title: item.title, time: item.dueAt, action: "Review" }))} />
      <ListSection title="Recent incidents" residentById={residentById} items={alerts.map((item) => ({ id: item.id, residentId: item.residentId ?? undefined, title: item.title, time: item.createdAt, action: "Review" }))} />
    </div>
  );
}
