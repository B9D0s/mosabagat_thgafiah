/**
 * بنك الأسئلة الثقافية — واجهة استكشاف الأسئلة (متجاوبة)
 */

const API_CDN = "https://raw.githubusercontent.com/B9D0s/mosabagat_thgafiah/main/data/questions.json";
const API_LOCAL = "../data/questions.json";

let allQuestions = [];
let filteredQuestions = [];
let currentPage = 1;
let perPage = 25;

const categories = [
  "القرآن الكريم", "السيرة", "الفقه", "الحديث الشريف", "الصحابة", "العقيدة",
  "التاريخ الإسلامي", "الثقافة العامة", "الجغرافيا", "اللغة العربية", "العلوم",
  "الرياضيات", "معلومات إسلامية", "الأحياء", "علوم الفضاء", "من القائل",
  "من أنا؟", "التاريخ",
];

const diffLabels = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
  extreme: "صعب جداً",
};

function $(id) { return document.getElementById(id); }

async function loadQuestions() {
  const loading = $("loading");
  const errorEl = $("error");
  loading.hidden = false;
  errorEl.hidden = true;

  try {
    let url = API_CDN;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      allQuestions = await r.json();
    } catch (e) {
      url = new URL(API_LOCAL, window.location.href).href;
      const r = await fetch(url);
      if (!r.ok) throw new Error("فشل التحميل: " + r.status);
      allQuestions = await r.json();
    }

    if (!Array.isArray(allQuestions)) allQuestions = [];
    initFilters();
    applyFilters();
    render();
  } catch (err) {
    errorEl.textContent = "تعذر تحميل الأسئلة. تحقق من الاتصال أو جرّب تشغيل مشروع محلي (مثلاً: npx serve .).";
    errorEl.hidden = false;
    $("questionsGrid").innerHTML = "";
  } finally {
    loading.hidden = true;
  }
}

function initFilters() {
  const catDiv = $("categoryFilters");
  catDiv.innerHTML = categories
    .map(
      (c) =>
        `<label><input type="checkbox" class="cat-cb" value="${escapeAttr(c)}"> ${escapeHtml(c)}</label>`
    )
    .join("");

  const diffDiv = $("difficultyFilters");
  const diffs = [
    { v: "all", l: "الكل" },
    { v: "easy", l: "سهل" },
    { v: "medium", l: "متوسط" },
    { v: "hard", l: "صعب" },
    { v: "extreme", l: "صعب جداً" },
  ];
  diffDiv.innerHTML = diffs
    .map(
      (d) =>
        `<label><input type="radio" name="difficulty" value="${d.v}" ${d.v === "all" ? "checked" : ""}> ${d.l}</label>`
    )
    .join("");

  const typeDiv = $("typeFilters");
  typeDiv.innerHTML = `
    <label><input type="radio" name="type" value="all" checked> الكل</label>
    <label><input type="radio" name="type" value="tf"> صح/خطأ</label>
    <label><input type="radio" name="type" value="mcq"> اختيار من متعدد</label>
  `;

  $("searchInput").addEventListener("input", debounce(applyFiltersAndRender, 300));
  $("perPage").addEventListener("change", applyFiltersAndRender);
  ["resetFiltersBtn", "randomBtn", "copyApiBtn", "downloadJsonBtn", "modalClose"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", handleClick);
  });
  document.querySelector(".modal-backdrop")?.addEventListener("click", () => closeModal());

  document.querySelectorAll(".cat-cb, input[name=difficulty], input[name=type]").forEach((el) => {
    el.addEventListener("change", applyFiltersAndRender);
  });
}

function handleClick(e) {
  const id = e.target.id;
  if (id === "resetFiltersBtn") resetFilters();
  else if (id === "randomBtn") openRandom();
  else if (id === "copyApiBtn") copyApiUrl();
  else if (id === "downloadJsonBtn") downloadJson();
  else if (id === "modalClose" || e.target.classList.contains("modal-backdrop")) closeModal();
}

function escapeAttr(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML.replace(/"/g, "&quot;");
}
function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function debounce(fn, ms) {
  let t;
  return function () {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

function getSelectedCategories() {
  return Array.from(document.querySelectorAll(".cat-cb:checked")).map((cb) => cb.value);
}

function getDifficulty() {
  return document.querySelector("input[name=difficulty]:checked")?.value || "all";
}

function getType() {
  return document.querySelector("input[name=type]:checked")?.value || "all";
}

function applyFilters() {
  const search = ($("searchInput").value || "").trim().toLowerCase();
  const cats = getSelectedCategories();
  const diff = getDifficulty();
  const type = getType();

  filteredQuestions = allQuestions.filter((q) => {
    if (search && !(q.question_ar || "").toLowerCase().includes(search)) return false;
    if (cats.length && !cats.includes(q.category)) return false;
    if (diff !== "all" && q.difficulty !== diff) return false;
    if (type !== "all" && q.type !== type) return false;
    return true;
  });

  currentPage = 1;
  updateStats();
}

function applyFiltersAndRender() {
  perPage = parseInt($("perPage").value, 10) || 25;
  applyFilters();
  render();
}

function resetFilters() {
  $("searchInput").value = "";
  document.querySelectorAll(".cat-cb").forEach((cb) => (cb.checked = false));
  const rAll = document.querySelector("input[name=difficulty][value=all]");
  if (rAll) rAll.checked = true;
  const tAll = document.querySelector("input[name=type][value=all]");
  if (tAll) tAll.checked = true;
  perPage = 25;
  $("perPage").value = "25";
  applyFiltersAndRender();
}

function updateStats() {
  $("totalCount").textContent = allQuestions.length.toLocaleString("ar-SA");
  $("filteredCount").textContent = filteredQuestions.length.toLocaleString("ar-SA");

  const byDiff = { easy: 0, medium: 0, hard: 0, extreme: 0 };
  filteredQuestions.forEach((q) => {
    if (byDiff[q.difficulty] !== undefined) byDiff[q.difficulty]++;
  });

  $("diffBars").innerHTML = Object.entries(byDiff)
    .map(([k, v]) => {
      const label = diffLabels[k] || k;
      return `<span class="diff-bar ${k}">${label}: ${v.toLocaleString("ar-SA")}</span>`;
    })
    .join("");
}

function render() {
  const total = filteredQuestions.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * perPage;
  const slice = filteredQuestions.slice(start, start + perPage);

  $("toolbarInfo").textContent = `يعرض ${start + 1}–${Math.min(start + perPage, total)} من ${total.toLocaleString("ar-SA")} سؤال`;

  const grid = $("questionsGrid");
  grid.innerHTML = slice.map((q) => cardHtml(q)).join("");

  let pagHtml = "";
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      pagHtml += `<button type="button" class="page-btn ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      pagHtml += `<span>…</span>`;
    }
  }
  $("pagination").innerHTML = pagHtml;
  $("pagination").querySelectorAll(".page-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentPage = parseInt(btn.dataset.page, 10);
      render();
    });
  });
}

function cardHtml(q) {
  const cat = escapeHtml(q.category || "");
  const diff = q.difficulty || "medium";
  const diffLabel = diffLabels[diff] || diff;
  const typeLabel = q.type === "tf" ? "صح/خطأ" : "اختيار من متعدد";
  const typeClass = q.type === "tf" ? "tf" : "mcq";
  let optionsHtml = "";
  if (q.type === "mcq" && Array.isArray(q.options_ar)) {
    optionsHtml = q.options_ar
      .map((opt, i) => {
        const isCorrect = i === q.correctIndex;
        return `<li class="${isCorrect ? "correct" : ""}">${escapeHtml(opt)}</li>`;
      })
      .join("");
  } else if (q.type === "tf") {
    optionsHtml = `<li class="correct">${q.correctBoolean ? "صح" : "خطأ"}</li>`;
  }
  const source = escapeHtml((q.source_ar || "").slice(0, 80));
  return `
    <article class="question-card" data-id="${q.id != null ? q.id : ""}">
      <div class="card-meta">
        <span class="badge cat">${cat}</span>
        <span class="badge ${diff}">${diffLabel}</span>
        <span class="badge ${typeClass}">${typeLabel}</span>
      </div>
      <p class="card-q">${escapeHtml(q.question_ar || "")}</p>
      <ul class="card-options">${optionsHtml}</ul>
      ${source ? `<p class="card-source">${source}</p>` : ""}
    </article>`;
}

function openRandom() {
  if (filteredQuestions.length === 0) return;
  const q = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
  $("randomQuestionCard").innerHTML = cardHtml(q);
  $("randomModal").hidden = false;
}

function closeModal() {
  $("randomModal").hidden = true;
}

function copyApiUrl() {
  const url = API_CDN;
  navigator.clipboard.writeText(url).then(() => {
    const btn = $("copyApiBtn");
    const orig = btn.textContent;
    btn.textContent = "تم النسخ!";
    setTimeout(() => (btn.textContent = orig), 2000);
  });
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(filteredQuestions, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "questions_filtered.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

document.addEventListener("DOMContentLoaded", loadQuestions);
