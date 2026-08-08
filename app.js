(function () {
  "use strict";

  const STORAGE_KEY = "khatwati-walk-entries-v1";
  const GOAL_KEY = "khatwati-walk-goal-v1";
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

  let entries = readEntries();
  let goal = readGoal();
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

  function readEntries() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((entry) => entry && entry.date && Number(entry.minutes) > 0) : [];
    } catch (_) {
      return [];
    }
  }

  function readGoal() {
    const saved = Number(localStorage.getItem(GOAL_KEY));
    return saved > 0 ? saved : DEFAULT_GOAL;
  }

  function saveEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function entryForDate(key) {
    return entries.find((entry) => entry.date === key);
  }

  function daysFromToday(count) {
    const days = [];
    const today = new Date();
    for (let offset = count - 1; offset >= 0; offset -= 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
      days.push(dateKey(date));
    }
    return days;
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
  }

  function renderStats() {
    const today = todayKey();
    const todayEntry = entryForDate(today);
    const lastSeven = daysFromToday(7);
    const previousSeven = lastSeven.map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (index + 7));
      return dateKey(date);
    });
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

    if (!daysLogged) {
      elements.chartSummary.textContent = "سجّلي أول يوم عشان نبدأ الرسم.";
    } else {
      elements.chartSummary.textContent = `إجمالي الأسبوع: ${total} دقيقة · ${daysLogged} ${daysLogged === 1 ? "يوم مسجّل" : "أيام مسجّلة"}`;
    }
  }

  function renderHistory() {
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    elements.historyBody.innerHTML = sorted.map((entry) => {
      const feelingClass = entry.feeling === "متعب" ? " tired" : "";
      return `<tr><td class="date-cell"><strong>${formatShortDate(entry.date)}</strong><small>${dayLabel(entry.date)}</small></td><td class="duration-cell">${Number(entry.minutes)} <span>دقيقة</span></td><td>${entry.feeling ? `<span class="feeling-pill${feelingClass}">${entry.feeling}</span>` : "<span class=\"muted-cell\">—</span>"}</td><td class="note-cell" title="${escapeHtml(entry.note || "")}">${escapeHtml(entry.note || "—")}</td><td><button class="delete-entry" type="button" data-date="${entry.date}" aria-label="حذف تسجيل ${formatShortDate(entry.date)}">×</button></td></tr>`;
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

  function showMessage(message, isError) {
    elements.formMessage.textContent = message;
    elements.formMessage.classList.toggle("error", Boolean(isError));
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
  }

  elements.date.value = todayKey();
  elements.goalMinutes.value = goal;
  elements.date.addEventListener("change", renderHeader);

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const date = elements.date.value;
    const minutes = Number(elements.minutes.value);
    if (!date || !minutes || minutes < 1 || minutes > 600) {
      showMessage("اكتبي مدة صحيحة من 1 إلى 600 دقيقة.", true);
      return;
    }
    const existing = entryForDate(date);
    const entry = { date, minutes, feeling: elements.feeling.value, note: elements.note.value.trim() };
    if (existing) Object.assign(existing, entry);
    else entries.push(entry);
    saveEntries();
    render();
    elements.minutes.value = "";
    elements.feeling.value = "";
    elements.note.value = "";
    showMessage(existing ? "اتحدّث تسجيل اليوم بنجاح." : "اتحفظ تسجيل اليوم بنجاح.");
    showToast(existing ? "تم تحديث التسجيل" : "تم حفظ تسجيل اليوم");
  });

  elements.historyBody.addEventListener("click", (event) => {
    const button = event.target.closest(".delete-entry");
    if (!button) return;
    entries = entries.filter((entry) => entry.date !== button.dataset.date);
    saveEntries();
    render();
    showToast("تم حذف التسجيل");
  });

  elements.clearButton.addEventListener("click", () => {
    if (!entries.length) return;
    if (window.confirm("هل أنتِ متأكدة من مسح كل التسجيلات؟")) {
      entries = [];
      saveEntries();
      render();
      showToast("تم مسح السجل");
    }
  });

  elements.settingsButton.addEventListener("click", () => {
    elements.goalMinutes.value = goal;
    elements.settingsDialog.showModal();
  });
  elements.closeSettings.addEventListener("click", () => elements.settingsDialog.close());
  elements.settingsDialog.addEventListener("click", (event) => {
    if (event.target === elements.settingsDialog) elements.settingsDialog.close();
  });
  elements.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextGoal = Number(elements.goalMinutes.value);
    if (!nextGoal || nextGoal < 1 || nextGoal > 600) return;
    goal = nextGoal;
    localStorage.setItem(GOAL_KEY, String(goal));
    elements.settingsDialog.close();
    render();
    showToast("تم حفظ الهدف اليومي");
  });

  render();
})();
