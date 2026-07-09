const apiBase = String(window.KG_CONFIG?.apiBase || "").replace(/\/$/, "");

const state = {
  notes: [],
  detailCache: new Map(),
  currentDetailNote: null,
  editingNote: null,
  query: "",
  type: "all",
  category: "all",
  tag: "all",
  sort: "updated",
  visibleNotes: 6,
  notesPageSize: 6
};

const NOTE_TYPES = ["笔记", "日记", "灵感", "复盘"];
const CATEGORY_OPTIONS = [
  "常识",
  "书单",
  "工作记录",
  "收益详情",
  "学习笔记",
  "编程",
  "读书",
  "GitHub 开源项目",
  "ChatGPT",
  "项目",
  "教程科普",
  "Codex",
  "服务器与域名",
  "Bybit"
];

const sampleNotes = [
  {
    id: "sample-1",
    title: "如何建立稳定的个人知识系统",
    slug: "personal-knowledge-system",
    summary: "从输入、整理、复盘到输出，把笔记变成可持续生长的结构。",
    category: "方法论",
    tags: ["知识管理", "复盘", "输出"],
    cover: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    created: "2026-07-01",
    updated: "2026-07-08",
    type: "笔记",
    pinned: true
  },
  {
    id: "sample-2",
    title: "Notion 数据库字段设计",
    slug: "notion-database-fields",
    summary: "为公开笔记准备标题、摘要、分类、标签、公开状态、短链接等字段。",
    category: "Notion",
    tags: ["数据库", "发布", "结构"],
    cover: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
    created: "2026-07-02",
    updated: "2026-07-07",
    type: "笔记",
    pinned: false
  },
  {
    id: "sample-3",
    title: "阅读笔记的二次整理",
    slug: "reading-note-review",
    summary: "把划线、想法和问题放回主题网络，形成能被再次使用的材料。",
    category: "阅读",
    tags: ["读书", "主题卡片", "朝夕拾光"],
    cover: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1200&q=80",
    created: "2026-06-28",
    updated: "2026-07-05",
    type: "复盘",
    pinned: false
  }
];

const elements = {
  totalNotes: document.querySelector("#totalNotes"),
  totalCategories: document.querySelector("#totalCategories"),
  totalTags: document.querySelector("#totalTags"),
  lastUpdated: document.querySelector("#lastUpdated"),
  growthYear: document.querySelector("#growthYear"),
  growthNotes: document.querySelector("#growthNotes"),
  growthHours: document.querySelector("#growthHours"),
  growthTopics: document.querySelector("#growthTopics"),
  monthlyTrend: document.querySelector("#monthlyTrend"),
  monthlyTrendText: document.querySelector("#monthlyTrendText"),
  topTopics: document.querySelector("#topTopics"),
  heatmapMonths: document.querySelector("#heatmapMonths"),
  knowledgeGraph: document.querySelector("#knowledgeGraph"),
  graphHint: document.querySelector("#graphHint"),
  graphResetButton: document.querySelector("#graphResetButton"),
  graphFullscreenButton: document.querySelector("#graphFullscreenButton"),
  topicMap: document.querySelector("#topicMap"),
  tagCloud: document.querySelector("#tagCloud"),
  recentList: document.querySelector("#recentList"),
  weeklySummary: document.querySelector("#weeklySummary"),
  pinnedList: document.querySelector("#pinnedList"),
  inspirationList: document.querySelector("#inspirationList"),
  dailyMood: document.querySelector("#dailyMood"),
  dailyKeywords: document.querySelector("#dailyKeywords"),
  dailyCount: document.querySelector("#dailyCount"),
  dailyWriteButton: document.querySelector("#dailyWriteButton"),
  diaryList: document.querySelector("#diaryList"),
  quickWriteButton: document.querySelector("#quickWriteButton"),
  randomNoteButton: document.querySelector("#randomNoteButton"),
  focusWriteButton: document.querySelector("#focusWriteButton"),
  focusRandomButton: document.querySelector("#focusRandomButton"),
  focusMapButton: document.querySelector("#focusMapButton"),
  searchInput: document.querySelector("#searchInput"),
  typeFilter: document.querySelector("#typeFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  tagFilter: document.querySelector("#tagFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  loadMoreNotes: document.querySelector("#loadMoreNotes"),
  collapseNotes: document.querySelector("#collapseNotes"),
  refreshButton: document.querySelector("#refreshButton"),
  writerButton: document.querySelector("#writerButton"),
  writerPanel: document.querySelector("#writerPanel"),
  writerForm: document.querySelector("#writerForm"),
  writerNoteId: document.querySelector("#writerNoteId"),
  writerTitle: document.querySelector("#writerTitle"),
  writerModeLabel: document.querySelector("#writerModeLabel"),
  writerSubmitButton: document.querySelector("#writerSubmitButton"),
  writerToken: document.querySelector("#writerToken"),
  writerNoteTitle: document.querySelector("#writerNoteTitle"),
  writerSlug: document.querySelector("#writerSlug"),
  writerTypeSelect: document.querySelector("#writerTypeSelect"),
  writerStatusSelect: document.querySelector("#writerStatusSelect"),
  writerCover: document.querySelector("#writerCover"),
  writerStudyMinutes: document.querySelector("#writerStudyMinutes"),
  writerSummary: document.querySelector("#writerSummary"),
  writerCategory: document.querySelector("#writerCategory"),
  writerTags: document.querySelector("#writerTags"),
  writerContent: document.querySelector("#writerContent"),
  writerPublished: document.querySelector("#writerPublished"),
  writerPinned: document.querySelector("#writerPinned"),
  writerStatus: document.querySelector("#writerStatus"),
  statusLine: document.querySelector("#statusLine"),
  grid: document.querySelector("#notes"),
  template: document.querySelector("#noteCardTemplate"),
  detailPanel: document.querySelector("#detailPanel"),
  detailCover: document.querySelector("#detailCover"),
  detailCategory: document.querySelector("#detailCategory"),
  detailUpdated: document.querySelector("#detailUpdated"),
  detailTitle: document.querySelector("#detailTitle"),
  detailSummary: document.querySelector("#detailSummary"),
  detailTags: document.querySelector("#detailTags"),
  detailContent: document.querySelector("#detailContent"),
  detailEditButton: document.querySelector("#detailEditButton"),
  detailToc: document.querySelector("#detailToc"),
  relatedNotes: document.querySelector("#relatedNotes"),
  previousNote: document.querySelector("#previousNote"),
  nextNote: document.querySelector("#nextNote")
};

let knowledgeChart = null;

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  resetNoteList();
  render();
});

elements.typeFilter?.addEventListener("change", (event) => {
  state.type = event.target.value;
  resetNoteList();
  render();
});

elements.categoryFilter.addEventListener("change", (event) => {
  state.category = event.target.value;
  resetNoteList();
  render();
});

elements.tagFilter.addEventListener("change", (event) => {
  state.tag = event.target.value;
  resetNoteList();
  render();
});

elements.sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  resetNoteList();
  render();
});

elements.refreshButton.addEventListener("click", () => loadNotes({ refresh: true }));
elements.writerButton?.addEventListener("click", () => openWriter("笔记"));
elements.quickWriteButton?.addEventListener("click", () => openWriter("灵感"));
elements.dailyWriteButton?.addEventListener("click", () => openWriter("日记"));
elements.randomNoteButton?.addEventListener("click", openRandomNote);
elements.focusWriteButton?.addEventListener("click", () => openWriter("笔记"));
elements.focusRandomButton?.addEventListener("click", openRandomNote);
elements.focusMapButton?.addEventListener("click", scrollToKnowledgeMap);
elements.graphResetButton?.addEventListener("click", resetGraphFilters);
elements.graphFullscreenButton?.addEventListener("click", toggleKnowledgeGraphFullscreen);
elements.loadMoreNotes?.addEventListener("click", () => {
  state.visibleNotes += state.notesPageSize;
  render();
});
elements.collapseNotes?.addEventListener("click", () => {
  resetNoteList();
  render();
  document.querySelector("#notes")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
elements.writerForm?.addEventListener("submit", createNoteFromWriter);
elements.writerTypeSelect?.addEventListener("change", updateWriterPrivacyDefault);
elements.writerContent?.addEventListener("paste", handleWriterPaste);
elements.detailEditButton?.addEventListener("click", () => {
  if (state.currentDetailNote) openEditor(state.currentDetailNote);
});

document.querySelectorAll("[data-close-detail]").forEach((node) => {
  node.addEventListener("click", closeDetail);
});

document.querySelectorAll("[data-close-writer]").forEach((node) => {
  node.addEventListener("click", closeWriter);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeKnowledgeGraphFullscreen();
    closeDetail();
    closeWriter();
  }
});

loadNotes();

window.addEventListener("resize", () => {
  knowledgeChart?.resize();
});

function openWriter(preferredType = "笔记") {
  state.editingNote = null;
  elements.writerForm?.reset();
  if (elements.writerNoteId) elements.writerNoteId.value = "";
  if (elements.writerTitle) elements.writerTitle.textContent = "写一篇新笔记";
  if (elements.writerModeLabel) elements.writerModeLabel.textContent = "新建笔记";
  if (elements.writerSubmitButton) elements.writerSubmitButton.textContent = "发布到 Notion";
  elements.writerPanel?.setAttribute("aria-hidden", "false");
  const nextType = NOTE_TYPES.includes(preferredType) ? preferredType : "笔记";
  if (elements.writerTypeSelect) elements.writerTypeSelect.value = nextType;
  updateWriterPrivacyDefault();
  if (elements.writerToken) {
    elements.writerToken.value = localStorage.getItem("kgAdminToken") || "";
  }
  if (elements.writerStatus) elements.writerStatus.textContent = "";
  document.body.style.overflow = "hidden";
}

function openEditor(note) {
  state.editingNote = note;
  elements.writerPanel?.setAttribute("aria-hidden", "false");
  if (elements.writerTitle) elements.writerTitle.textContent = "编辑这篇笔记";
  if (elements.writerModeLabel) elements.writerModeLabel.textContent = "保存修改";
  if (elements.writerSubmitButton) elements.writerSubmitButton.textContent = "保存到 Notion";
  if (elements.writerToken) elements.writerToken.value = localStorage.getItem("kgAdminToken") || "";
  if (elements.writerNoteId) elements.writerNoteId.value = note.id || "";
  if (elements.writerNoteTitle) elements.writerNoteTitle.value = note.title || "";
  if (elements.writerSlug) elements.writerSlug.value = note.slug || "";
  if (elements.writerTypeSelect) elements.writerTypeSelect.value = note.type || "笔记";
  if (elements.writerStatusSelect) elements.writerStatusSelect.value = note.status || "进行中";
  if (elements.writerCover) elements.writerCover.value = note.cover || "";
  if (elements.writerStudyMinutes) elements.writerStudyMinutes.value = note.studyMinutes || "";
  if (elements.writerSummary) elements.writerSummary.value = note.summary || "";
  if (elements.writerCategory) elements.writerCategory.value = note.category || "";
  if (elements.writerTags) elements.writerTags.value = (note.tags || []).join(", ");
  if (elements.writerContent) elements.writerContent.value = blocksToMarkdown(note.content || []);
  if (elements.writerPublished) elements.writerPublished.checked = true;
  if (elements.writerPinned) elements.writerPinned.checked = Boolean(note.pinned);
  if (elements.writerStatus) elements.writerStatus.textContent = "";
  document.body.style.overflow = "hidden";
}

function updateWriterPrivacyDefault() {
  if (!elements.writerTypeSelect || !elements.writerPublished) return;
  if (elements.writerTypeSelect.value === "日记") {
    elements.writerPublished.checked = false;
  } else {
    elements.writerPublished.checked = true;
  }
}

function closeWriter() {
  elements.writerPanel?.setAttribute("aria-hidden", "true");
  if (elements.detailPanel?.getAttribute("aria-hidden") !== "false") {
    document.body.style.overflow = "";
  }
}

async function handleWriterPaste(event) {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) return;

  event.preventDefault();
  const file = imageItem.getAsFile();
  if (!file) return;

  const token = elements.writerToken?.value.trim() || localStorage.getItem("kgAdminToken") || "";
  if (!token) {
    setWriterStatus("先填管理密码，再粘贴图片。", true);
    return;
  }

  try {
    setWriterStatus("正在把图片上传到 Notion...");
    const dataUrl = await readFileAsDataUrl(file);
    const response = await fetch(`${apiBase}/api/admin/uploads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        filename: file.name || "pasted-image.png",
        mimeType: file.type,
        dataUrl,
        alt: "粘贴图片"
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "图片上传失败");

    localStorage.setItem("kgAdminToken", token);
    insertAtCursor(elements.writerContent, `\n${data.markdown}\n`);
    setWriterStatus("图片已上传到 Notion，并插入正文。");
  } catch (error) {
    setWriterStatus(error instanceof Error ? error.message : "图片上传失败", true);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function insertAtCursor(textarea, value) {
  if (!textarea) return;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
  const cursor = start + value.length;
  textarea.focus();
  textarea.setSelectionRange(cursor, cursor);
}

async function createNoteFromWriter(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const token = String(formData.get("token") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const noteId = String(formData.get("id") || "").trim();

  if (!token || !title) {
    setWriterStatus("请先填写管理密码和标题。", true);
    return;
  }

  const payload = {
    title,
    type: String(formData.get("type") || "笔记").trim(),
    slug: String(formData.get("slug") || "").trim(),
    summary: String(formData.get("summary") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    cover: String(formData.get("cover") || "").trim(),
    status: String(formData.get("status") || "").trim(),
    studyMinutes: Number(formData.get("studyMinutes") || 0),
    tags: splitTags(String(formData.get("tags") || "")),
    content: String(formData.get("content") || "").trim(),
    published: formData.get("published") === "on",
    pinned: formData.get("pinned") === "on"
  };

  submitButton.disabled = true;
  setWriterStatus(noteId ? "正在保存修改到 Notion..." : "正在同步到 Notion...");

  try {
    const response = await fetch(noteId ? `${apiBase}/api/admin/notes/${encodeURIComponent(noteId)}` : `${apiBase}/api/admin/notes`, {
      method: noteId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "创建笔记失败");

    localStorage.setItem("kgAdminToken", token);
    if (!noteId) {
      form.reset();
      elements.writerToken.value = token;
      if (elements.writerTypeSelect) elements.writerTypeSelect.value = "笔记";
      if (elements.writerPublished) elements.writerPublished.checked = true;
    }
    state.detailCache.clear();
    setWriterStatus(noteId ? `已保存修改：${data.note?.title || title}` : `已同步：${data.note?.title || title}${payload.published ? "" : "。未公开内容只保存在 Notion。"}`);
    await loadNotes({ refresh: true });
  } catch (error) {
    setWriterStatus(error instanceof Error ? error.message : "保存笔记失败", true);
  } finally {
    submitButton.disabled = false;
  }
}

function splitTags(value) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function setWriterStatus(message, isError = false) {
  if (!elements.writerStatus) return;
  elements.writerStatus.textContent = message;
  elements.writerStatus.dataset.error = isError ? "true" : "false";
}

async function loadNotes({ refresh = false } = {}) {
  setStatus("正在读取朝夕拾光...");
  elements.refreshButton.disabled = true;

  try {
    const response = await fetch(`${apiBase}/api/notes${refresh ? "?refresh=1" : ""}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "读取笔记失败");
    state.notes = normalizeNotes(data.notes);
    setStatus(`已载入 ${state.notes.length} 篇公开笔记${data.cached ? "，来自缓存" : ""}`);
  } catch (error) {
    state.notes = normalizeNotes(sampleNotes);
    setStatus(`API 暂不可用，正在展示示例数据。${error instanceof Error ? error.message : ""}`);
  } finally {
    hydrateFilters();
    render();
    elements.refreshButton.disabled = false;
  }
}

function normalizeNotes(notes) {
  return (Array.isArray(notes) ? notes : []).map((note) => ({
    id: String(note.id || note.slug || note.title || crypto.randomUUID()),
    title: String(note.title || "未命名笔记"),
    slug: String(note.slug || note.id || ""),
    summary: String(note.summary || ""),
    type: NOTE_TYPES.includes(String(note.type || "").trim()) ? String(note.type).trim() : "笔记",
    category: String(note.category || "未分类"),
    tags: Array.isArray(note.tags) ? note.tags.map(String).filter(Boolean) : [],
    cover: String(note.cover || ""),
    created: String(note.created || ""),
    updated: String(note.updated || note.created || ""),
    studyMinutes: Number(note.studyMinutes || note.readingMinutes || 0),
    pinned: Boolean(note.pinned),
    content: Array.isArray(note.content) ? note.content : []
  }));
}

function hydrateFilters() {
  const currentType = elements.typeFilter?.value || "all";
  const currentCategory = elements.categoryFilter.value;
  const currentTag = elements.tagFilter.value;
  const types = unique([...NOTE_TYPES, ...state.notes.map((note) => note.type).filter(Boolean)]);
  const categories = unique([...CATEGORY_OPTIONS, ...state.notes.map((note) => note.category).filter(Boolean)]);
  const tags = unique(state.notes.flatMap((note) => note.tags));

  if (elements.typeFilter) fillSelect(elements.typeFilter, "全部类型", types);
  fillSelect(elements.categoryFilter, "全部分类", categories);
  fillSelect(elements.tagFilter, "全部标签", tags);

  if (types.includes(currentType)) elements.typeFilter.value = currentType;
  if (categories.includes(currentCategory)) elements.categoryFilter.value = currentCategory;
  if (tags.includes(currentTag)) elements.tagFilter.value = currentTag;
}

function fillSelect(select, label, values) {
  select.innerHTML = "";
  select.append(new Option(label, "all"));
  for (const value of values) select.append(new Option(value, value));
}

function render() {
  const notes = filteredNotes();
  renderStats(state.notes);
  renderWorkbench(state.notes);
  renderGrid(notes);
}

function resetNoteList() {
  state.visibleNotes = state.notesPageSize;
}

function renderWorkbench(notes) {
  renderKnowledgeGraph(notes);
  renderGrowthMap(notes);
  renderDailyPanel(notes);
  renderDiarySection(notes);
  renderFocusPanel(notes);
  renderTopicMap(notes);
  renderTagCloud(notes);
  renderRecentList(notes);
}

function renderGrowthMap(notes) {
  if (!elements.heatmapMonths) return;

  const year = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const contributionCounts = buildContributionCounts(notes, year);
  const totalEvents = Object.values(contributionCounts).reduce((sum, count) => sum + count, 0);
  const yearNotes = notes.filter((note) => dateKey(note.created || note.updated).startsWith(`${year}-`));
  const topics = unique(yearNotes.map((note) => note.category).filter(Boolean));
  const trackedMinutes = yearNotes.reduce((sum, note) => sum + (Number(note.studyMinutes) || 0), 0);
  const estimatedHours = trackedMinutes > 0
    ? trackedMinutes / 60
    : Math.max(totalEvents * 0.5, yearNotes.length * 0.5);

  elements.growthYear.textContent = String(year);
  elements.growthNotes.textContent = `${yearNotes.length || notes.length}篇`;
  elements.growthHours.textContent = trackedMinutes > 0
    ? `${formatNumber(estimatedHours)}小时`
    : `约${formatNumber(estimatedHours)}小时`;
  elements.growthTopics.textContent = `${topics.length}个`;
  renderMonthlyTrend(notes, contributionCounts, year, currentMonth, trackedMinutes > 0);
  renderTopTopics(yearNotes.length ? yearNotes : notes);

  elements.heatmapMonths.innerHTML = "";
  for (let month = 0; month < 12; month += 1) {
    const monthRow = document.createElement("article");
    monthRow.className = "heatmap-month";

    const monthLabel = document.createElement("span");
    monthLabel.className = "heatmap-month-label";
    monthLabel.textContent = monthName(month);

    const cells = document.createElement("div");
    cells.className = "heatmap-cells";

    const totalDays = daysInMonth(year, month);
    for (let day = 1; day <= totalDays; day += 1) {
      const key = `${year}-${pad2(month + 1)}-${pad2(day)}`;
      const count = contributionCounts[key] || 0;
      const cell = document.createElement("button");
      cell.className = `heat-cell level-${heatLevel(count)}`;
      cell.type = "button";
      cell.title = `${year}年${month + 1}月${day}日：${count} 次学习记录`;
      cell.setAttribute("aria-label", cell.title);
      cells.append(cell);
    }

    monthRow.append(monthLabel, cells);
    elements.heatmapMonths.append(monthRow);
  }
}

function renderMonthlyTrend(notes, contributionCounts, year, currentMonth, hasTrackedMinutes) {
  if (!elements.monthlyTrend || !elements.monthlyTrendText) return;

  const currentPrefix = `${year}-${pad2(currentMonth + 1)}-`;
  const lastMonthDate = new Date(year, currentMonth - 1, 1);
  const lastPrefix = `${lastMonthDate.getFullYear()}-${pad2(lastMonthDate.getMonth() + 1)}-`;
  const currentEvents = sumCountsByPrefix(contributionCounts, currentPrefix);
  const lastEvents = sumCountsByPrefix(contributionCounts, lastPrefix);
  const currentNotes = notes.filter((note) => dateKey(note.created || note.updated).startsWith(currentPrefix));
  const currentMinutes = currentNotes.reduce((sum, note) => sum + (Number(note.studyMinutes) || 0), 0);
  const currentHours = hasTrackedMinutes ? currentMinutes / 60 : currentEvents * 0.5;
  const delta = currentEvents - lastEvents;

  elements.monthlyTrend.textContent = delta > 0 ? `+${delta}` : String(delta);
  elements.monthlyTrendText.textContent = `本月 ${currentEvents} 次学习记录，${hasTrackedMinutes ? "累计" : "估算"} ${formatNumber(currentHours)} 小时。`;
}

function renderTopTopics(notes) {
  if (!elements.topTopics) return;
  elements.topTopics.innerHTML = "";

  const entries = Object.entries(countValues(notes.map((note) => note.category).filter(Boolean)))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
    .slice(0, 4);

  if (!entries.length) {
    elements.topTopics.append(emptyInline("暂无主题数据"));
    return;
  }

  for (const [topic, count] of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "top-topic";
    button.innerHTML = `<span>${escapeHtml(topic)}</span><strong>${count}</strong>`;
    button.addEventListener("click", () => {
      state.category = topic;
      elements.categoryFilter.value = topic;
      render();
      scrollToNotes();
    });
    elements.topTopics.append(button);
  }
}

function buildContributionCounts(notes, year) {
  const counts = {};
  const seen = new Set();

  for (const note of notes) {
    for (const value of [note.created, note.updated]) {
      const key = dateKey(value);
      if (!key || !key.startsWith(`${year}-`)) continue;
      const eventKey = `${note.id}:${key}`;
      if (seen.has(eventKey)) continue;
      seen.add(eventKey);
      counts[key] = (counts[key] || 0) + 1;
    }
  }

  return counts;
}

function renderDailyPanel(notes) {
  const today = dateKey(new Date());
  const todayNotes = notes.filter((note) => dateKey(note.created || note.updated) === today);
  const todayDiaries = todayNotes.filter(isDiary);
  const keywords = unique(todayNotes.flatMap((note) => note.tags).filter(Boolean)).slice(0, 3);

  if (elements.dailyMood) {
    elements.dailyMood.textContent = todayDiaries.length ? "已留下今天" : "等待记录";
  }
  if (elements.dailyKeywords) {
    elements.dailyKeywords.textContent = keywords.length ? keywords.join("、") : "暂无关键词";
  }
  if (elements.dailyCount) {
    elements.dailyCount.textContent = `${todayNotes.length} 条`;
  }
}

function renderDiarySection(notes) {
  if (!elements.diaryList) return;
  elements.diaryList.innerHTML = "";

  const diaries = notes
    .filter(isDiary)
    .sort((a, b) => compareDate(b.updated || b.created, a.updated || a.created))
    .slice(0, 6);

  if (!diaries.length) {
    elements.diaryList.append(emptyInline("还没有公开的拾光日记。私密日记会留在 Notion，不会显示在这里。"));
    return;
  }

  for (const note of diaries) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "diary-entry";
    button.innerHTML = `
      <span>${escapeHtml(formatDate(note.updated || note.created) || "今日")}</span>
      <strong>${escapeHtml(note.title)}</strong>
      <p>${escapeHtml(note.summary || "这一天也被好好收起来了。")}</p>
    `;
    button.addEventListener("click", () => openDetail(note));
    elements.diaryList.append(button);
  }
}

function renderFocusPanel(notes) {
  if (!elements.weeklySummary) return;

  const recentNotes = [...notes].sort((a, b) => compareDate(b.updated, a.updated));
  const weeklyNotes = recentNotes.filter((note) => isWithinDays(note.updated || note.created, 7));
  const weeklyTopics = unique(weeklyNotes.map((note) => note.category).filter(Boolean));
  const pinnedNotes = recentNotes.filter((note) => note.pinned).slice(0, 3);

  if (weeklyNotes.length) {
    const topicText = weeklyTopics.length ? `，覆盖 ${weeklyTopics.slice(0, 3).join("、")} ${weeklyTopics.length > 3 ? "等" : ""}主题` : "";
    elements.weeklySummary.textContent = `本周更新 ${weeklyNotes.length} 篇笔记${topicText}。可以先复盘最近的灵感，再补上摘要和标签。`;
  } else if (notes.length) {
    elements.weeklySummary.textContent = "本周还没有新的公开笔记。可以从一条灵感开始，给这个星期留下一点痕迹。";
  } else {
    elements.weeklySummary.textContent = "知识花园还在等待第一粒种子。先写一篇笔记，之后这里会自动生成本周摘要。";
  }

  renderFocusList(elements.pinnedList, pinnedNotes.length ? pinnedNotes : recentNotes.slice(0, 2), "暂无置顶笔记");
  renderFocusList(elements.inspirationList, recentNotes.slice(0, 3), "暂无最近灵感");
}

function renderFocusList(container, notes, emptyText) {
  if (!container) return;
  container.innerHTML = "";

  if (!notes.length) {
    container.append(emptyInline(emptyText));
    return;
  }

  for (const note of notes) {
    const button = document.createElement("button");
    button.className = "focus-item";
    button.type = "button";
    button.innerHTML = `
      <strong>${escapeHtml(note.title)}</strong>
      <span>${escapeHtml(note.category || "未分类")} · ${escapeHtml(formatDate(note.updated || note.created) || "-")}</span>
    `;
    button.addEventListener("click", () => openDetail(note));
    container.append(button);
  }
}

function renderKnowledgeGraph(notes) {
  if (!elements.knowledgeGraph) return;
  if (!window.echarts) {
    elements.knowledgeGraph.textContent = "知识地图组件加载中...";
    return;
  }

  const graph = buildKnowledgeGraph(notes);
  if (!knowledgeChart) {
    knowledgeChart = window.echarts.init(elements.knowledgeGraph, null, { renderer: "canvas" });
    knowledgeChart.on("click", (params) => {
      const data = params.data || {};
      if (data.kind === "category") {
        state.category = data.value;
        elements.categoryFilter.value = data.value;
        elements.graphHint.textContent = `已筛选分类：${data.value}`;
        render();
        scrollToNotes();
      } else if (data.kind === "tag") {
        state.tag = data.value;
        elements.tagFilter.value = data.value;
        elements.graphHint.textContent = `已筛选标签：${data.value}`;
        render();
        scrollToNotes();
      } else if (data.kind === "note") {
        const note = state.notes.find((item) => item.id === data.noteId || item.slug === data.noteId);
        if (note) openDetail(note);
      }
    });
  }

  knowledgeChart.setOption({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (params) => params.data?.tooltip || params.name
    },
    animationDurationUpdate: 500,
    series: [
      {
        type: "graph",
        layout: "force",
        roam: true,
        draggable: true,
        top: 8,
        bottom: 8,
        left: 8,
        right: 8,
        force: {
          repulsion: 170,
          edgeLength: [54, 118],
          gravity: 0.08
        },
        lineStyle: {
          color: "rgba(214, 235, 226, 0.42)",
          width: 1.2,
          curveness: 0.08
        },
        label: {
          show: true,
          color: "#f7fbf7",
          fontWeight: 700,
          formatter: "{b}"
        },
        emphasis: {
          focus: "adjacency",
          lineStyle: { width: 2.5, color: "#b9e8d8" }
        },
        data: graph.nodes,
        links: graph.links
      }
    ]
  });
}

function resetGraphFilters() {
  state.category = "all";
  state.tag = "all";
  if (elements.categoryFilter) elements.categoryFilter.value = "all";
  if (elements.tagFilter) elements.tagFilter.value = "all";
  if (elements.graphHint) elements.graphHint.textContent = "点击节点进入对应知识";
  render();
  scrollToNotes();
}

function toggleKnowledgeGraphFullscreen() {
  const panel = elements.knowledgeGraph?.closest(".graph-panel");
  if (!panel) return;
  const isFullscreen = panel.classList.toggle("graph-fullscreen");
  document.body.classList.toggle("graph-open", isFullscreen);
  elements.graphFullscreenButton.textContent = isFullscreen ? "退出全屏" : "全屏";
  elements.graphFullscreenButton.setAttribute("aria-expanded", String(isFullscreen));
  setTimeout(() => knowledgeChart?.resize(), 180);
}

function closeKnowledgeGraphFullscreen() {
  const panel = elements.knowledgeGraph?.closest(".graph-panel");
  if (!panel?.classList.contains("graph-fullscreen")) return;
  panel.classList.remove("graph-fullscreen");
  document.body.classList.remove("graph-open");
  if (elements.graphFullscreenButton) {
    elements.graphFullscreenButton.textContent = "全屏";
    elements.graphFullscreenButton.setAttribute("aria-expanded", "false");
  }
  setTimeout(() => knowledgeChart?.resize(), 180);
}

function buildKnowledgeGraph(notes) {
  const nodes = new Map();
  const links = [];
  const addNode = (id, node) => {
    if (!nodes.has(id)) nodes.set(id, { id, ...node });
  };
  const addLink = (source, target) => {
    if (source !== target) links.push({ source, target });
  };

  addNode("root", {
    name: "朝夕拾光",
    kind: "root",
    value: "root",
    symbolSize: 58,
    tooltip: "朝夕拾光：你的知识中心",
    itemStyle: { color: "#31a17d", shadowBlur: 18, shadowColor: "rgba(49, 161, 125, 0.45)" },
    label: { fontSize: 15 }
  });

  const categoryCounts = countValues(notes.map((note) => note.category).filter(Boolean));
  const tagCounts = countValues(notes.flatMap((note) => note.tags));

  for (const note of notes.slice(0, 36)) {
    const category = note.category || "未分类";
    const categoryId = `category:${category}`;
    addNode(categoryId, {
      name: category,
      kind: "category",
      value: category,
      symbolSize: 34 + Math.min((categoryCounts[category] || 1) * 4, 18),
      tooltip: `分类：${category} / ${categoryCounts[category] || 1} 篇`,
      itemStyle: { color: "#c68a3a" }
    });
    addLink("root", categoryId);

    const noteId = `note:${note.id}`;
    addNode(noteId, {
      name: compactLabel(note.title),
      kind: "note",
      noteId: note.id,
      symbolSize: note.pinned ? 34 : 28,
      tooltip: `笔记：${note.title}`,
      itemStyle: { color: note.pinned ? "#f0d39d" : "#dce8e4" },
      label: { color: note.pinned ? "#fff4d8" : "#f7fbf7", fontSize: 11 }
    });
    addLink(categoryId, noteId);

    for (const tag of note.tags.slice(0, 5)) {
      const tagId = `tag:${tag}`;
      addNode(tagId, {
        name: tag,
        kind: "tag",
        value: tag,
        symbolSize: 24 + Math.min((tagCounts[tag] || 1) * 3, 14),
        tooltip: `标签：${tag} / ${tagCounts[tag] || 1} 次`,
        itemStyle: { color: "#6f9fd2" },
        label: { fontSize: 11 }
      });
      addLink(categoryId, tagId);
      addLink(tagId, noteId);
    }
  }

  return {
    nodes: [...nodes.values()],
    links
  };
}

function renderTopicMap(notes) {
  if (!elements.topicMap) return;
  elements.topicMap.innerHTML = "";
  const counts = countValues(notes.map((note) => note.category).filter(Boolean));
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"));

  if (!entries.length) {
    elements.topicMap.append(emptyInline("暂无分类"));
    return;
  }

  for (const [category, count] of entries.slice(0, 8)) {
    const button = document.createElement("button");
    button.className = "topic-pill";
    button.type = "button";
    button.innerHTML = `<span>${escapeHtml(category)}</span><strong>${count}</strong>`;
    button.addEventListener("click", () => {
      state.category = category;
      elements.categoryFilter.value = category;
      render();
      scrollToNotes();
    });
    elements.topicMap.append(button);
  }
}

function renderTagCloud(notes) {
  if (!elements.tagCloud) return;
  elements.tagCloud.innerHTML = "";
  const counts = countValues(notes.flatMap((note) => note.tags));
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"));

  if (!entries.length) {
    elements.tagCloud.append(emptyInline("暂无标签"));
    return;
  }

  for (const [tag, count] of entries.slice(0, 14)) {
    const button = document.createElement("button");
    button.className = "cloud-tag";
    button.type = "button";
    button.textContent = `${tag} ${count}`;
    button.addEventListener("click", () => {
      state.tag = tag;
      elements.tagFilter.value = tag;
      render();
      scrollToNotes();
    });
    elements.tagCloud.append(button);
  }
}

function renderRecentList(notes) {
  if (!elements.recentList) return;
  elements.recentList.innerHTML = "";
  const recent = [...notes]
    .sort((a, b) => compareDate(b.updated, a.updated))
    .slice(0, 3);

  if (!recent.length) {
    elements.recentList.append(emptyInline("暂无更新"));
    return;
  }

  for (const note of recent) {
    const button = document.createElement("button");
    button.className = "recent-item";
    button.type = "button";
    button.innerHTML = `
      <span>${escapeHtml(formatDate(note.updated) || "-")}</span>
      <strong>${escapeHtml(note.title)}</strong>
    `;
    button.addEventListener("click", () => openDetail(note));
    elements.recentList.append(button);
  }
}

function openRandomNote() {
  if (!state.notes.length) {
    setStatus("还没有可以漫游的公开笔记。");
    return;
  }
  const note = state.notes[Math.floor(Math.random() * state.notes.length)];
  openDetail(note);
}

function filteredNotes() {
  const query = state.query;
  return [...state.notes]
    .filter((note) => state.type === "all" || note.type === state.type)
    .filter((note) => state.category === "all" || note.category === state.category)
    .filter((note) => state.tag === "all" || note.tags.includes(state.tag))
    .filter((note) => {
      if (!query) return true;
      return [note.title, note.summary, note.type, note.category, ...note.tags].join(" ").toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (state.sort === "title") return a.title.localeCompare(b.title, "zh-Hans-CN");
      if (state.sort === "created") return compareDate(b.created, a.created);
      return compareDate(b.updated, a.updated);
    });
}

function renderStats(notes) {
  const categories = unique(notes.map((note) => note.category).filter(Boolean));
  const tags = unique(notes.flatMap((note) => note.tags));
  const latest = notes.map((note) => note.updated).filter(Boolean).sort(compareDate).at(-1);

  elements.totalNotes.textContent = String(notes.length);
  elements.totalCategories.textContent = String(categories.length);
  elements.totalTags.textContent = String(tags.length);
  elements.lastUpdated.textContent = formatDate(latest) || "-";
}

function renderGrid(notes) {
  elements.grid.innerHTML = "";
  if (!notes.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "没有匹配的公开笔记。";
    elements.grid.append(empty);
    renderNoteListActions(0, 0);
    return;
  }

  const fragment = document.createDocumentFragment();
  const visibleNotes = notes.slice(0, state.visibleNotes);
  for (const note of visibleNotes) fragment.append(createCard(note));
  elements.grid.append(fragment);
  renderNoteListActions(notes.length, visibleNotes.length);
}

function renderNoteListActions(total, visible) {
  if (elements.loadMoreNotes) {
    const hasMore = visible < total;
    elements.loadMoreNotes.hidden = !hasMore;
    elements.loadMoreNotes.textContent = hasMore ? `加载更多（${visible}/${total}）` : "已显示全部";
  }
  if (elements.collapseNotes) {
    elements.collapseNotes.hidden = visible <= state.notesPageSize;
  }
}

function createCard(note) {
  const node = elements.template.content.firstElementChild.cloneNode(true);
  const button = node.querySelector(".note-open");
  const cover = node.querySelector(".note-cover");
  const category = node.querySelector(".note-category");
  const date = node.querySelector(".note-date");
  const title = node.querySelector("h3");
  const summary = node.querySelector("p");
  const tags = node.querySelector(".tag-row");

  if (note.cover) {
    cover.src = note.cover;
    cover.alt = `${note.title} 封面`;
    cover.hidden = false;
  }
  category.textContent = `${note.type || "笔记"} · ${note.category}`;
  date.textContent = formatDate(note.updated);
  title.textContent = note.title;
  summary.textContent = note.summary || "这篇笔记还没有摘要。";
  renderTags(tags, note.tags.slice(0, 4));
  button.addEventListener("click", () => openDetail(note));

  return node;
}

async function openDetail(note) {
  openPanel();
  renderDetail({ ...note, content: note.content?.length ? note.content : loadingBlocks() });

  try {
    const key = note.slug || note.id;
    const detail = state.detailCache.get(key) || await fetchDetail(key);
    state.detailCache.set(key, detail);
    renderDetail({ ...note, ...detail.note });
  } catch (error) {
    const content = note.content?.length ? note.content : sampleContent(note, error);
    renderDetail({ ...note, content });
  }
}

async function fetchDetail(key) {
  const response = await fetch(`${apiBase}/api/notes/${encodeURIComponent(key)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "读取详情失败");
  return data;
}

function renderDetail(note) {
  state.currentDetailNote = note;
  if (note.cover) {
    elements.detailCover.src = note.cover;
    elements.detailCover.alt = `${note.title} 封面`;
    elements.detailCover.hidden = false;
  } else {
    elements.detailCover.hidden = true;
  }

  elements.detailCategory.textContent = `${note.type || "笔记"} · ${note.category || "未分类"}`;
  elements.detailUpdated.textContent = formatDate(note.updated);
  elements.detailTitle.textContent = note.title;
  elements.detailSummary.textContent = note.summary || "";
  renderTags(elements.detailTags, note.tags || []);
  const headings = renderBlocks(elements.detailContent, note.content || []);
  renderToc(headings);
  renderRelatedNotes(note);
  renderDetailNavigation(note);
}

function renderTags(container, tags) {
  container.innerHTML = "";
  for (const value of tags) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = value;
    container.append(tag);
  }
}

function renderBlocks(container, blocks) {
  container.innerHTML = "";
  const headings = [];
  if (!blocks.length) {
    const empty = document.createElement("p");
    empty.textContent = "这篇笔记暂时没有可展示的正文。";
    container.append(empty);
    return headings;
  }

  let activeList = null;
  let activeListType = "";

  for (const [index, block] of blocks.entries()) {
    const type = block.type || "paragraph";
    if (type === "bulleted_list_item" || type === "numbered_list_item") {
      const listTag = type === "numbered_list_item" ? "ol" : "ul";
      if (!activeList || activeListType !== listTag) {
        activeList = document.createElement(listTag);
        activeListType = listTag;
        container.append(activeList);
      }
      const item = document.createElement("li");
      item.textContent = block.text || "";
      activeList.append(item);
      continue;
    }

    activeList = null;
    activeListType = "";
    container.append(renderBlock(block, headings, index));
  }

  return headings;
}

function renderBlock(block, headings = [], index = 0) {
  const type = block.type || "paragraph";
  if (type === "divider") return document.createElement("hr");
  if (type === "image") {
    const figure = document.createElement("figure");
    figure.className = "article-image";
    const image = document.createElement("img");
    image.src = block.url || "";
    image.alt = block.caption || "笔记图片";
    image.loading = "lazy";
    figure.append(image);
    if (block.caption) {
      const caption = document.createElement("figcaption");
      caption.textContent = block.caption;
      figure.append(caption);
    }
    return figure;
  }
  if (type === "quote" || type === "callout") {
    const quote = document.createElement("blockquote");
    quote.textContent = block.text || "";
    return quote;
  }
  if (type === "code") {
    const figure = document.createElement("figure");
    figure.className = "code-card";
    const caption = document.createElement("figcaption");
    caption.textContent = block.language || "code";
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = block.text || "";
    pre.append(code);
    figure.append(caption, pre);
    return figure;
  }
  if (type === "heading_1" || type === "heading_2") {
    const heading = document.createElement("h2");
    heading.textContent = block.text || "";
    heading.id = headingId(block.text, index);
    headings.push({ id: heading.id, text: block.text || "", level: 2 });
    return heading;
  }
  if (type === "heading_3") {
    const heading = document.createElement("h3");
    heading.textContent = block.text || "";
    heading.id = headingId(block.text, index);
    headings.push({ id: heading.id, text: block.text || "", level: 3 });
    return heading;
  }
  const paragraph = document.createElement("p");
  paragraph.textContent = block.text || "";
  return paragraph;
}

function blocksToMarkdown(blocks) {
  return (blocks || []).map((block, index) => {
    const text = block.text || "";
    if (block.type === "heading_1") return `# ${text}`;
    if (block.type === "heading_2") return `## ${text}`;
    if (block.type === "heading_3") return `### ${text}`;
    if (block.type === "quote" || block.type === "callout") return `> ${text}`;
    if (block.type === "bulleted_list_item") return `- ${text}`;
    if (block.type === "numbered_list_item") return `${index + 1}. ${text}`;
    if (block.type === "divider") return "---";
    if (block.type === "code") return `\`\`\`${block.language || ""}\n${text}\n\`\`\``;
    if (block.type === "image") {
      if (block.fileUploadId) return `![${block.caption || "笔记图片"}](notion-upload:${block.fileUploadId})`;
      return block.url ? `![${block.caption || "笔记图片"}](${block.url})` : "";
    }
    return text;
  }).filter(Boolean).join("\n\n");
}

function renderToc(headings) {
  if (!elements.detailToc) return;
  elements.detailToc.innerHTML = "";

  if (!headings.length) {
    elements.detailToc.append(emptyInline("这篇笔记还没有标题层级"));
    return;
  }

  for (const heading of headings.slice(0, 12)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = heading.level === 3 ? "toc-child" : "";
    button.textContent = heading.text;
    button.addEventListener("click", () => {
      document.getElementById(heading.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    elements.detailToc.append(button);
  }
}

function renderRelatedNotes(currentNote) {
  if (!elements.relatedNotes) return;
  elements.relatedNotes.innerHTML = "";

  const related = state.notes
    .filter((note) => note.id !== currentNote.id)
    .map((note) => ({
      note,
      score: relatedScore(currentNote, note)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || compareDate(b.note.updated, a.note.updated))
    .slice(0, 3)
    .map((item) => item.note);

  if (!related.length) {
    elements.relatedNotes.append(emptyInline("暂无相关笔记"));
    return;
  }

  for (const note of related) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "related-item";
    button.innerHTML = `
      <strong>${escapeHtml(note.title)}</strong>
      <span>${escapeHtml(note.category || "未分类")} · ${escapeHtml(formatDate(note.updated) || "-")}</span>
    `;
    button.addEventListener("click", () => openDetail(note));
    elements.relatedNotes.append(button);
  }
}

function renderDetailNavigation(currentNote) {
  const ordered = [...state.notes].sort((a, b) => compareDate(b.updated, a.updated));
  const index = ordered.findIndex((note) => note.id === currentNote.id || note.slug === currentNote.slug);
  const previous = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;

  bindNavButton(elements.previousNote, previous, "上一篇");
  bindNavButton(elements.nextNote, next, "下一篇");
}

function bindNavButton(button, note, fallbackText) {
  if (!button) return;
  button.disabled = !note;
  button.textContent = note ? `${fallbackText}：${compactLabel(note.title)}` : fallbackText;
  button.onclick = note ? () => openDetail(note) : null;
}

function relatedScore(source, target) {
  let score = 0;
  if (source.type && source.type === target.type) score += 1;
  if (source.category && source.category === target.category) score += 3;
  const sourceTags = new Set(source.tags || []);
  for (const tag of target.tags || []) {
    if (sourceTags.has(tag)) score += 2;
  }
  return score;
}

function openPanel() {
  elements.detailPanel.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeDetail() {
  elements.detailPanel.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function loadingBlocks() {
  return [{ type: "paragraph", text: "正在打开这片花园..." }];
}

function sampleContent(note, error) {
  return [
    { type: "heading_2", text: note.title },
    { type: "paragraph", text: note.summary || "这里会显示 Notion 页面正文。" },
    { type: "quote", text: "只有 Published 勾选的笔记会出现在网站中。" },
    { type: "paragraph", text: error instanceof Error ? `详情 API 暂不可用：${error.message}` : "详情 API 暂不可用。" }
  ];
}

function compareDate(a, b) {
  return new Date(a || 0).getTime() - new Date(b || 0).getTime();
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function dateKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function monthName(monthIndex) {
  return ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"][monthIndex];
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function heatLevel(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

function formatNumber(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function countValues(values) {
  return values.reduce((counts, value) => {
    const key = String(value || "").trim();
    if (!key) return counts;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function sumCountsByPrefix(counts, prefix) {
  return Object.entries(counts).reduce((sum, [key, count]) => {
    return key.startsWith(prefix) ? sum + count : sum;
  }, 0);
}

function emptyInline(text) {
  const empty = document.createElement("p");
  empty.className = "inline-empty";
  empty.textContent = text;
  return empty;
}

function scrollToNotes() {
  document.querySelector("#notes")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToKnowledgeMap() {
  elements.knowledgeGraph?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function headingId(text, index) {
  return `heading-${index}-${slugifyText(text) || "section"}`;
}

function slugifyText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isWithinDays(value, days) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function isDiary(note) {
  return note?.type === "日记";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function compactLabel(value) {
  const text = String(value || "").trim();
  return text.length > 8 ? `${text.slice(0, 8)}…` : text;
}

function setStatus(message) {
  elements.statusLine.textContent = message;
}
