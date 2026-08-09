import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.2/+esm";

const SUPABASE_URL = "https://jcuqwcwkowtjxcykstlf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BFtrH3u_sv9zat6B9SALyw_nS7Pajaa";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const ENTRY_TABLE = "shared_walking_entries";
const SETTINGS_TABLE = "shared_walking_settings";
const LEGACY_STORAGE_KEY = "khatwati-walk-entries-v1";
const LEGACY_GOAL_KEY = "khatwati-walk-goal-v1";
const DEFAULT_GOAL = 20;

const elements = {
  form: document.getElementById("walkForm"),
  date: document.getElementById("walkDate"),
  minutes: document.getElementById("walkMinutes"),
  feeling: document.getElementById("walkFeeling"),
  note: document.getElementById("walkNote"),
  formMessage: document.getElementById("formMessage"),
  todayDate: document.getElementById("todayDate"),
  formDate: document.getElementById("formDate"),
  todayMinutes: document.getElementById("todayMinutes"),
  todayStatus: document.getElementById("todayStatus"),
  streakCount: document.getElementById("streakCount"),
  averageMinutes: document.getElementById("averageMinutes"),
  trendText: document.getElementById("trendText"),
  chart: document.getElementById("weeklyChart"),
  chartSummary: document.getElementById("chartSummary"),
  historyBody: document.getElementById("historyBody"),
  emptyState: document.getElementById("emptyState"),
  entriesCount: document.getElementById("entriesCount"),
  clearButton: document.getElementById("clearButton"),
  toast: document.getElementById("toast"),
  settingsButton: document.getElementById("settingsButton"),
  settingsDialog: document.getElementById("settingsDialog"),
  closeSettings: document.getElementById("closeSettings"),
  settingsForm: document.getElementById("settingsForm"),
  goalMinutes: document.getElementById("goalMinutes")
};

let entries = [];
let goal = DEFAULT_GOAL;
let toastTimer;

function pad(number) {
  return String(number).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDate(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function todayKey() {
  return dateKey(new Date());
}

function formatLongDate(key) {
  return new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long" }).format(parseDate(key));
}

function formatShortDate(key) {
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(parseDate(key));
}

function dayLabel(key) {
  const date = parseDate(key);
  if (key === todayKey()) return "اليوم";
  return new Intl.DateTimeFormat("ar-EG", { weekday: "short" }).format(date).replace("،", "");
}

function daysFromToday(count, extraDays = 0) {
  const days = [];
  const today = new Date();
  for (let offset = count - 1 + extraDays; offset >= extraDays; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    days.push(dateKey(date));
  }
  return days;
}

function entryForDate(key) {
  return entries.find((entry) => entry.date === key);
}

function mapEntry(row) {
  return {
    id: row.id,
    date: row.entry_date,
    minutes: Number(row.minutes),
    feeling: row.feeling || "",
    note: row.note || ""
  };
}

function readLegacyEntries() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((entry) => entry?.date && Number(entry.minutes) > 0) : [];
  } catch (_) {
    return [];
  }
}

function readLegacyGoal() {
  const saved = Number(localStorage.getItem(LEGACY_GOAL_KEY));
  return saved > 0 && saved <= 600 ? saved : null;
}

function showFormMessage(message, isError = false) {
  elements.formMessage.textContent = message;
  elements.formMessage.classList.toggle("error", isError);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2800);
}

async function saveGoalRemote(nextGoal) {
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert({ id: 1, goal_minutes: nextGoal, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select("goal_minutes")
    .single();
  if (error) throw error;
  return Number(data.goal_minutes);
}

async function migrateLegacyData() {
  const legacyEntries = readLegacyEntries();
  const legacyGoal = readLegacyGoal();
  let migrated = false;

  if (legacyEntries.length) {
    const payload = legacyEntries.map((entry) => ({
      entry_date: entry.date,
      minutes: Number(entry.minutes),
      feeling: entry.feeling || null,
      note: entry.note?.trim() || null
    }));
    const { error } = await supabase.from(ENTRY_TABLE).upsert(payload, { onConflict: "entry_date" });
    if (error) throw error;
    migrated = true;
  }

  if (legacyGoal) {
    goal = await saveGoalRemote(legacyGoal);
    migrated = true;
  }

  if (migrated) {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_GOAL_KEY);
  }
  return migrated;
}

async function loadCloudData() {
  const legacyGoal = readLegacyGoal();
  const [entriesResult, settingsResult] = await Promise.all([
    supabase.from(ENTRY_TABLE).select("id,entry_date,minutes,feeling,note").order("entry_date", { ascending: false }),
    supabase.from(SETTINGS_TABLE).select("goal_minutes").eq("id", 1).maybeSingle()
  ]);

  if (entriesResult.error) throw entriesResult.error;
  if (settingsResult.error) throw settingsResult.error;

  entries = (entriesResult.data || []).map(mapEntry);
  goal = settingsResult.data?.goal_minutes ? Number(settingsResult.data.goal_minutes) : DEFAULT_GOAL;

  if (!entries.length) {
    const migrated = await migrateLegacyData();
    if (migrated) {
      const { data, error } = await supabase.from(ENTRY_TABLE).select("id,entry_date,minutes,feeling,note").order("entry_date", { ascending: false });
      if (error) throw error;
      entries = (data || []).map(mapEntry);
    }
  }

  if (!settingsResult.data && !legacyGoal) {
    await saveGoalRemote(DEFAULT_GOAL);
  }
  render();
}

function calculateStreak() {
  let streak = 0;
  const cursor = new Date();
  while (entryForDate(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function averageFor(days) {
  const total = days.reduce((sum, key) => sum + Number(entryForDate(key)?.minutes || 0), 0);
  return Math.round(total / days.length);
}

function renderHeader() {
  const today = todayKey();
  elements.todayDate.textContent = `${formatLongDate(today)} — تابعي مشيك النهارده وخلي التحسن واضح قدامك.`;
  elements.formDate.textContent = today === elements.date.value ? "اليوم" : formatShortDate(elements.date.value);
  elements.goalMinutes.value = goal;
}

function renderStats() {
  const today = todayKey();
  const todayEntry = entryForDate(today);
  const lastSeven = daysFromToday(7);
  const previousSeven = daysFromToday(7, 7);
  const average = averageFor(lastSeven);
  const previousAverage = averageFor(previousSeven);

  elements.todayMinutes.textContent = todayEntry ? Number(todayEntry.minutes) : "—";
  elements.todayStatus.textContent = todayEntry
    ? Number(todayEntry.minutes) >= goal ? `ممتاز! وصلتي لهدف ${goal} دقيقة` : `الهدف اليومي: ${goal} دقيقة`
    : `الهدف اليومي: ${goal} دقيقة`;
  elements.streakCount.textContent = calculateStreak();
  elements.averageMinutes.textContent = average;

  if (!entries.length) {
    elements.trendText.textContent = "لسه بنبدأ المتابعة";
  } else if (average > previousAverage) {
    elements.trendText.textContent = `أعلى من الأسبوع اللي فات بـ ${average - previousAverage} دقيقة`;
  } else if (average < previousAverage) {
    elements.trendText.textContent = `أقل من الأسبوع اللي فات بـ ${previousAverage - average} دقيقة`;
  } else {
    elements.trendText.textContent = "ثبات جميل في مستواك";
  }
}

function renderChart() {
  const days = daysFromToday(7);
  const values = days.map((key) => Number(entryForDate(key)?.minutes || 0));
  const max = Math.max(goal, ...values, 1);
  const labels = days.map(dayLabel);
  const total = values.reduce((sum, value) => sum + value, 0);
  const daysLogged = values.filter(Boolean).length;

  elements.chart.innerHTML = `<div class="chart-scale"><span>${max}</span><span>${Math.round(max / 2)}</span><span>0</span></div><div class="chart-area">${days.map((key, index) => {
    const value = values[index];
    const height = value ? Math.max(5, (value / max) * 100) : 3;
    const todayClass = key === todayKey() ? " today" : "";
    const valueClass = value ? " has-value" : "";
    const labelClass = key === todayKey() ? " today-label" : "";
    return `<div class="bar-column" aria-label="${labels[index]}: ${value || 0} دقيقة"><div class="bar${valueClass}${todayClass}" style="height:${height}%"><span class="bar-tooltip">${value || 0} د</span></div><span class="bar-label${labelClass}">${labels[index]}</span></div>`;
  }).join("")}</div>`;

  elements.chartSummary.textContent = daysLogged
    ? `إجمالي الأسبوع: ${total} دقيقة · ${daysLogged} ${daysLogged === 1 ? "يوم مسجّل" : "أيام مسجّلة"}`
    : "سجّلي أول يوم عشان نبدأ الرسم.";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function renderHistory() {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  elements.historyBody.innerHTML = sorted.map((entry) => {
    const feelingClass = entry.feeling === "متعب" ? " tired" : "";
    return `<tr><td class="date-cell"><strong>${formatShortDate(entry.date)}</strong><small>${dayLabel(entry.date)}</small></td><td class="duration-cell">${Number(entry.minutes)} <span>دقيقة</span></td><td>${entry.feeling ? `<span class="feeling-pill${feelingClass}">${entry.feeling}</span>` : "<span class=\"muted-cell\">—</span>"}</td><td class="note-cell" title="${escapeHtml(entry.note || "")}">${escapeHtml(entry.note || "—")}</td><td><button class="delete-entry" type="button" data-id="${entry.id}" aria-label="حذف تسجيل ${formatShortDate(entry.date)}">×</button></td></tr>`;
  }).join("");
  elements.emptyState.classList.toggle("visible", sorted.length === 0);
  elements.entriesCount.textContent = `${sorted.length} ${sorted.length === 1 ? "تسجيل" : "تسجيلات"}`;
}

function render() {
  renderHeader();
  renderStats();
  renderChart();
  renderHistory();
}

elements.date.value = todayKey();
elements.date.addEventListener("change", renderHeader);

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const date = elements.date.value;
  const minutes = Number(elements.minutes.value);
  if (!date || !minutes || minutes < 1 || minutes > 600) {
    showFormMessage("اكتبي مدة صحيحة من 1 إلى 600 دقيقة.", true);
    return;
  }

  const existing = entryForDate(date);
  const payload = {
    entry_date: date,
    minutes,
    feeling: elements.feeling.value || null,
    note: elements.note.value.trim() || null,
    updated_at: new Date().toISOString()
  };
  if (existing?.id) payload.id = existing.id;

  const button = elements.form.querySelector("button[type='submit']");
  button.disabled = true;
  showFormMessage("جارِ الحفظ أونلاين...");
  try {
    const { data, error } = await supabase.from(ENTRY_TABLE).upsert(payload, { onConflict: "entry_date" }).select("id,entry_date,minutes,feeling,note").single();
    if (error) throw error;
    const savedEntry = mapEntry(data);
    if (existing) Object.assign(existing, savedEntry);
    else entries.push(savedEntry);
    render();
    elements.minutes.value = "";
    elements.feeling.value = "";
    elements.note.value = "";
    showFormMessage(existing ? "اتحدّث التسجيل المشترك أونلاين." : "اتحفظ التسجيل المشترك أونلاين.");
    showToast(existing ? "تم تحديث التسجيل" : "تم حفظ التسجيل أونلاين");
  } catch (error) {
    console.error(error);
    showFormMessage("ماقدرناش نحفظ التسجيل. تأكدي من الإنترنت وحاولي ثانية.", true);
  } finally {
    button.disabled = false;
  }
});

elements.historyBody.addEventListener("click", async (event) => {
  const button = event.target.closest(".delete-entry");
  if (!button) return;
  const entry = entries.find((item) => item.id === button.dataset.id);
  if (!entry) return;
  button.disabled = true;
  const { error } = await supabase.from(ENTRY_TABLE).delete().eq("id", entry.id);
  if (error) {
    button.disabled = false;
    showToast("ماقدرناش نحذف التسجيل. حاولي مرة ثانية.");
    return;
  }
  entries = entries.filter((item) => item.id !== entry.id);
  render();
  showToast("تم حذف التسجيل");
});

elements.clearButton.addEventListener("click", async () => {
  if (!entries.length || !window.confirm("هل أنتِ متأكدة من مسح كل التسجيلات المشتركة؟")) return;
  elements.clearButton.disabled = true;
  const { error } = await supabase.from(ENTRY_TABLE).delete().gte("minutes", 1);
  elements.clearButton.disabled = false;
  if (error) {
    showToast("ماقدرناش نمسح السجل. حاولي مرة ثانية.");
    return;
  }
  entries = [];
  render();
  showToast("تم مسح السجل المشترك");
});

elements.settingsButton.addEventListener("click", () => {
  elements.goalMinutes.value = goal;
  elements.settingsDialog.showModal();
});

elements.closeSettings.addEventListener("click", () => elements.settingsDialog.close());
elements.settingsDialog.addEventListener("click", (event) => {
  if (event.target === elements.settingsDialog) elements.settingsDialog.close();
});

elements.settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nextGoal = Number(elements.goalMinutes.value);
  if (!nextGoal || nextGoal < 1 || nextGoal > 600) return;
  const button = elements.settingsForm.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    goal = await saveGoalRemote(nextGoal);
    elements.settingsDialog.close();
    render();
    showToast("تم حفظ الهدف المشترك أونلاين");
  } catch (error) {
    console.error(error);
    showToast("ماقدرناش نحفظ الهدف. حاولي مرة ثانية.");
  } finally {
    button.disabled = false;
  }
});

try {
  await loadCloudData();
} catch (error) {
  console.error(error);
  render();
  showFormMessage("حصلت مشكلة في الاتصال بالسجل المشترك. حاولي تحديث الصفحة.", true);
}
