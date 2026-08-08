import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.2/+esm";

const SUPABASE_URL = "https://jcuqwcwkowtjxcykstlf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BFtrH3u_sv9zat6B9SALyw_nS7Pajaa";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const LEGACY_STORAGE_KEY = "khatwati-walk-entries-v1";
const LEGACY_GOAL_KEY = "khatwati-walk-goal-v1";
const DEFAULT_GOAL = 20;

const elements = {
  authScreen: document.getElementById("authScreen"),
  authForm: document.getElementById("authForm"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authPasswordConfirm: document.getElementById("authPasswordConfirm"),
  authConfirmField: document.getElementById("authConfirmField"),
  authTitle: document.getElementById("authTitle"),
  authSubmit: document.getElementById("authSubmit"),
  authMessage: document.getElementById("authMessage"),
  authModeToggle: document.getElementById("authModeToggle"),
  appContent: document.getElementById("top"),
  pageFooter: document.querySelector(".page-footer"),
  topbarActions: document.getElementById("topbarActions"),
  userEmail: document.getElementById("userEmail"),
  userAvatar: document.getElementById("userAvatar"),
  logoutButton: document.getElementById("logoutButton"),
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
let currentUser = null;
let authMode = "signin";
let loadedUserId = null;
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

function showAuthMessage(message, isError = false) {
  elements.authMessage.textContent = message;
  elements.authMessage.classList.toggle("error", isError);
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

function authErrorMessage(error) {
  const message = String(error?.message || "");
  if (/invalid login credentials/i.test(message)) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (/email not confirmed/i.test(message)) return "افتحي رسالة التأكيد في بريدك الإلكتروني أولًا.";
  if (/already registered|already been registered/i.test(message)) return "البريد ده مسجل بالفعل، جرّبي تسجيل الدخول.";
  if (/password should be at least/i.test(message)) return "كلمة المرور لازم تكون ٦ أحرف على الأقل.";
  if (/rate limit/i.test(message)) return "حاولي مرة ثانية بعد قليل.";
  return "حصلت مشكلة بسيطة. تأكدي من الاتصال بالإنترنت وحاولي مرة ثانية.";
}

function setAuthMode(nextMode) {
  authMode = nextMode;
  const isSignup = authMode === "signup";
  elements.authScreen.classList.toggle("signup-mode", isSignup);
  elements.authTitle.textContent = isSignup ? "اعملي حساب للمتابعة" : "سجّلي دخولك للمتابعة";
  elements.authSubmit.firstChild.textContent = isSignup ? "إنشاء الحساب " : "تسجيل الدخول ";
  elements.authModeToggle.textContent = isSignup ? "عندي حساب بالفعل — تسجيل الدخول" : "إنشاء حساب جديد";
  elements.authPassword.setAttribute("autocomplete", isSignup ? "new-password" : "current-password");
  showAuthMessage("");
}

function setAuthenticatedUi(user) {
  const email = user?.email || "";
  elements.userEmail.textContent = email;
  elements.userEmail.title = email;
  elements.userAvatar.textContent = email ? email.slice(0, 1).toUpperCase() : "م";
  elements.authScreen.classList.add("hidden");
  elements.appContent.classList.add("ready");
  elements.pageFooter.classList.add("ready");
  elements.topbarActions.classList.add("ready");
}

function setSignedOutUi() {
  elements.authScreen.classList.remove("hidden");
  elements.appContent.classList.remove("ready");
  elements.pageFooter.classList.remove("ready");
  elements.topbarActions.classList.remove("ready");
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

async function saveGoalRemote(nextGoal) {
  const { data, error } = await supabase
    .from("walking_settings")
    .upsert({ owner_id: currentUser.id, goal_minutes: nextGoal, updated_at: new Date().toISOString() }, { onConflict: "owner_id" })
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
      owner_id: currentUser.id,
      entry_date: entry.date,
      minutes: Number(entry.minutes),
      feeling: entry.feeling || null,
      note: entry.note?.trim() || null
    }));
    const { error } = await supabase.from("walking_entries").upsert(payload, { onConflict: "owner_id,entry_date" });
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
    supabase.from("walking_entries").select("id,entry_date,minutes,feeling,note").order("entry_date", { ascending: false }),
    supabase.from("walking_settings").select("goal_minutes").maybeSingle()
  ]);

  if (entriesResult.error) throw entriesResult.error;
  if (settingsResult.error) throw settingsResult.error;

  entries = (entriesResult.data || []).map(mapEntry);
  goal = settingsResult.data?.goal_minutes ? Number(settingsResult.data.goal_minutes) : DEFAULT_GOAL;

  if (!entries.length) {
    const migrated = await migrateLegacyData();
    if (migrated) {
      const { data, error } = await supabase.from("walking_entries").select("id,entry_date,minutes,feeling,note").order("entry_date", { ascending: false });
      if (error) throw error;
      entries = (data || []).map(mapEntry);
    }
  }

  if (!settingsResult.data && !legacyGoal) {
    await saveGoalRemote(DEFAULT_GOAL);
  }
  render();
}

async function bootForUser(user) {
  if (loadedUserId === user.id && elements.appContent.classList.contains("ready")) return;
  currentUser = user;
  loadedUserId = user.id;
  setAuthenticatedUi(user);
  showFormMessage("");
  try {
    await loadCloudData();
  } catch (error) {
    console.error(error);
    showToast("مش قادرين نحمّل البيانات الآن. حاولي تحديث الصفحة.");
  }
}

function resetForSignedOut() {
  currentUser = null;
  loadedUserId = null;
  entries = [];
  goal = DEFAULT_GOAL;
  setSignedOutUi();
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

function renderHistory() {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  elements.historyBody.innerHTML = sorted.map((entry) => {
    const feelingClass = entry.feeling === "متعب" ? " tired" : "";
    return `<tr><td class="date-cell"><strong>${formatShortDate(entry.date)}</strong><small>${dayLabel(entry.date)}</small></td><td class="duration-cell">${Number(entry.minutes)} <span>دقيقة</span></td><td>${entry.feeling ? `<span class="feeling-pill${feelingClass}">${entry.feeling}</span>` : "<span class=\"muted-cell\">—</span>"}</td><td class="note-cell" title="${escapeHtml(entry.note || "")}">${escapeHtml(entry.note || "—")}</td><td><button class="delete-entry" type="button" data-id="${entry.id}" aria-label="حذف تسجيل ${formatShortDate(entry.date)}">×</button></td></tr>`;
  }).join("");
  elements.emptyState.classList.toggle("visible", sorted.length === 0);
  elements.entriesCount.textContent = `${sorted.length} ${sorted.length === 1 ? "تسجيل" : "تسجيلات"}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function render() {
  renderHeader();
  renderStats();
  renderChart();
  renderHistory();
}

elements.date.value = todayKey();
setAuthMode("signin");

elements.authModeToggle.addEventListener("click", () => {
  setAuthMode(authMode === "signin" ? "signup" : "signin");
});

elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  const confirmation = elements.authPasswordConfirm.value;

  if (!email || !email.includes("@")) {
    showAuthMessage("اكتبي بريدًا إلكترونيًا صحيحًا.", true);
    return;
  }
  if (password.length < 6) {
    showAuthMessage("كلمة المرور لازم تكون ٦ أحرف على الأقل.", true);
    return;
  }
  if (authMode === "signup" && password !== confirmation) {
    showAuthMessage("كلمتا المرور غير متطابقتين.", true);
    return;
  }

  elements.authSubmit.disabled = true;
  showAuthMessage(authMode === "signup" ? "بنجهّز الحساب..." : "جارِ تسجيل الدخول...");
  try {
    if (authMode === "signup") {
      const redirectUrl = new URL(window.location.href);
      redirectUrl.hash = "";
      redirectUrl.search = "";
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl.toString() } });
      if (error) throw error;
      if (!data.session) {
        showAuthMessage("اتعمل الحساب. افتحي رسالة التأكيد في بريدك الإلكتروني، وبعدها سجّلي الدخول.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (error) {
    console.error(error);
    showAuthMessage(authErrorMessage(error), true);
  } finally {
    elements.authSubmit.disabled = false;
  }
});

elements.logoutButton.addEventListener("click", async () => {
  elements.logoutButton.disabled = true;
  const { error } = await supabase.auth.signOut();
  elements.logoutButton.disabled = false;
  if (error) showToast("ماقدرناش نعمل تسجيل خروج. حاولي مرة ثانية.");
});

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
    owner_id: currentUser.id,
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
    const { data, error } = await supabase.from("walking_entries").upsert(payload, { onConflict: "owner_id,entry_date" }).select("id,entry_date,minutes,feeling,note").single();
    if (error) throw error;
    const savedEntry = mapEntry(data);
    if (existing) Object.assign(existing, savedEntry);
    else entries.push(savedEntry);
    render();
    elements.minutes.value = "";
    elements.feeling.value = "";
    elements.note.value = "";
    showFormMessage(existing ? "اتحدّث تسجيل اليوم أونلاين." : "اتحفظ تسجيل اليوم أونلاين.");
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
  const { error } = await supabase.from("walking_entries").delete().eq("id", entry.id).eq("owner_id", currentUser.id);
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
  if (!entries.length || !window.confirm("هل أنتِ متأكدة من مسح كل التسجيلات؟")) return;
  elements.clearButton.disabled = true;
  const { error } = await supabase.from("walking_entries").delete().eq("owner_id", currentUser.id);
  elements.clearButton.disabled = false;
  if (error) {
    showToast("ماقدرناش نمسح السجل. حاولي مرة ثانية.");
    return;
  }
  entries = [];
  render();
  showToast("تم مسح السجل أونلاين");
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
    showToast("تم حفظ الهدف أونلاين");
  } catch (error) {
    console.error(error);
    showToast("ماقدرناش نحفظ الهدف. حاولي مرة ثانية.");
  } finally {
    button.disabled = false;
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  window.setTimeout(() => {
    if (session?.user) bootForUser(session.user);
    else resetForSignedOut();
  }, 0);
});

const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
if (sessionError) {
  showAuthMessage("تعذّر الاتصال بالحساب. حدّثي الصفحة وحاولي مرة ثانية.", true);
} else if (sessionData.session?.user) {
  await bootForUser(sessionData.session.user);
} else {
  resetForSignedOut();
}
