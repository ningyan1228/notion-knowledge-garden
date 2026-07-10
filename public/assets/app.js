const apiBase = String(window.KG_CONFIG?.apiBase || "").replace(/\/$/, "");
const authTokenSessionKey = "kgUserToken";
const authTokenLocalKey = "kgUserTokenRemembered";
const authUserSessionKey = "kgCurrentUser";
const authUserLocalKey = "kgCurrentUserRemembered";
const writerDraftPrefix = "kgWriterDraft:v2";
const folderRegistryPrefix = "kgFolders:v1";
const writerDraftDelayMs = 500;
let authToken =
  sessionStorage.getItem(authTokenSessionKey) ||
  localStorage.getItem(authTokenLocalKey) ||
  "";
let currentUser = readStoredUser();

const state = {
  notes: [],
  detailCache: new Map(),
  currentDetailNote: null,
  editingNote: null,
  query: "",
  scope: "all",
  type: "all",
  visibility: "all",
  category: "all",
  tag: "all",
  folder: "all",
  favoritesOnly: false,
  author: "all",
  month: "all",
  sort: "updated",
  visibleNotes: 6,
  notesPageSize: 6
};

const NOTE_TYPES = ["笔记", "日记", "灵感", "复盘"];
const CATEGORY_OPTIONS = [
  "常识",
  "日记",
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
  graphRetryButton: document.querySelector("#graphRetryButton"),
  graphResetButton: document.querySelector("#graphResetButton"),
  graphFullscreenButton: document.querySelector("#graphFullscreenButton"),
  topicMap: document.querySelector("#topicMap"),
  tagCloud: document.querySelector("#tagCloud"),
  recentList: document.querySelector("#recentList"),
  timelineList: document.querySelector("#timelineList"),
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
  visibilityFilter: document.querySelector("#visibilityFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  tagFilter: document.querySelector("#tagFilter"),
  folderFilter: document.querySelector("#folderFilter"),
  authorFilter: document.querySelector("#authorFilter"),
  monthFilter: document.querySelector("#monthFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  scopeSwitch: document.querySelector("#scopeSwitch"),
  closeNotesLibrary: document.querySelector("#closeNotesLibrary"),
  favoriteFilterButton: document.querySelector("#favoriteFilterButton"),
  favoriteCount: document.querySelector("#favoriteCount"),
  folderList: document.querySelector("#folderList"),
  folderCreateForm: document.querySelector("#folderCreateForm"),
  newFolderInput: document.querySelector("#newFolderInput"),
  activeFilters: document.querySelector("#activeFilters"),
  filterResultCount: document.querySelector("#filterResultCount"),
  resetFilters: document.querySelector("#resetFilters"),
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
  writerCoverFile: document.querySelector("#writerCoverFile"),
  writerCoverUploadButton: document.querySelector("#writerCoverUploadButton"),
  writerStudyMinutes: document.querySelector("#writerStudyMinutes"),
  writerSummary: document.querySelector("#writerSummary"),
  writerCategory: document.querySelector("#writerCategory"),
  writerTags: document.querySelector("#writerTags"),
  writerFolder: document.querySelector("#writerFolder"),
  writerFolderOptions: document.querySelector("#writerFolderOptions"),
  writerContent: document.querySelector("#writerContent"),
  writerVisualEditor: document.querySelector("#writerVisualEditor"),
  editorModeSwitch: document.querySelector(".editor-mode-switch"),
  writerFormatToolbar: document.querySelector(".writer-format-toolbar"),
  writerPreview: document.querySelector("#writerPreview"),
  writerDraftStatus: document.querySelector("#writerDraftStatus"),
  writerContentFile: document.querySelector("#writerContentFile"),
  writerContentUploadButton: document.querySelector("#writerContentUploadButton"),
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
  detailAuthor: document.querySelector("#detailAuthor"),
  detailReadingTime: document.querySelector("#detailReadingTime"),
  detailCard: document.querySelector(".detail-card"),
  readingProgress: document.querySelector("#readingProgress"),
  detailEditButton: document.querySelector("#detailEditButton"),
  detailFavoriteButton: document.querySelector("#detailFavoriteButton"),
  detailFolderWidget: document.querySelector("#detailFolderWidget"),
  detailFolderInput: document.querySelector("#detailFolderInput"),
  detailFolderSaveButton: document.querySelector("#detailFolderSaveButton"),
  detailToc: document.querySelector("#detailToc"),
  relatedNotes: document.querySelector("#relatedNotes"),
  previousNote: document.querySelector("#previousNote"),
  nextNote: document.querySelector("#nextNote"),
  siteLock: document.querySelector("#siteLock"),
  sitePasswordForm: document.querySelector("#sitePasswordForm"),
  siteUsernameInput: document.querySelector("#siteUsernameInput"),
  sitePasswordInput: document.querySelector("#sitePasswordInput"),
  sitePasswordRemember: document.querySelector("#sitePasswordRemember"),
  sitePasswordError: document.querySelector("#sitePasswordError"),
  currentUserLabel: document.querySelector("#currentUserLabel"),
  logoutButton: document.querySelector("#logoutButton")
};

let knowledgeChart = null;
let graphRetryTimer = null;
let graphResizeObserver = null;
let writerDraftTimer = null;
let detailHeadingObserver = null;
let writerEditorMode = "visual";

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

elements.visibilityFilter?.addEventListener("change", (event) => {
  state.visibility = event.target.value;
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

elements.folderFilter?.addEventListener("change", (event) => {
  state.folder = event.target.value;
  resetNoteList();
  render();
});

elements.favoriteFilterButton?.addEventListener("click", () => {
  state.favoritesOnly = !state.favoritesOnly;
  resetNoteList();
  render();
});

elements.folderList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-folder]");
  if (!button) return;
  state.folder = button.dataset.folder || "all";
  if (elements.folderFilter) elements.folderFilter.value = state.folder;
  resetNoteList();
  render();
});

elements.folderCreateForm?.addEventListener("submit", createCustomFolder);

elements.authorFilter?.addEventListener("change", (event) => {
  state.author = event.target.value;
  resetNoteList();
  render();
});

elements.monthFilter?.addEventListener("change", (event) => {
  state.month = event.target.value;
  resetNoteList();
  render();
});

elements.scopeSwitch?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-scope]");
  if (!button) return;
  state.scope = button.dataset.scope || "all";
  resetNoteList();
  render();
});

elements.resetFilters?.addEventListener("click", resetFilters);
elements.closeNotesLibrary?.addEventListener("click", closeNotesLibrary);
document.querySelectorAll("[data-open-notes-library]").forEach((node) => {
  node.addEventListener("click", openNotesLibrary);
});
window.addEventListener("hashchange", syncPageViewFromHash);
elements.activeFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-clear-filter]");
  if (!button) return;
  clearFilter(button.dataset.clearFilter);
});

elements.detailCard?.addEventListener("scroll", updateReadingProgress);

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
elements.graphRetryButton?.addEventListener("click", () => {
  if (elements.graphHint) elements.graphHint.textContent = "正在重新绘制知识星图...";
  renderKnowledgeGraph(state.notes, 0, true);
});
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
elements.writerForm?.addEventListener("input", handleWriterFormInput);
elements.writerForm?.addEventListener("change", handleWriterFormInput);
elements.sitePasswordForm?.addEventListener("submit", unlockSite);
elements.writerTypeSelect?.addEventListener("change", updateWriterPrivacyDefault);
elements.writerContent?.addEventListener("paste", handleWriterPaste);
elements.writerContent?.addEventListener("keydown", handleWriterContentKeydown);
elements.writerVisualEditor?.addEventListener("input", handleVisualEditorInput);
elements.writerVisualEditor?.addEventListener("paste", handleVisualEditorPaste);
elements.writerVisualEditor?.addEventListener("keydown", handleWriterContentKeydown);
elements.editorModeSwitch?.addEventListener("click", handleEditorModeSwitch);
elements.writerFormatToolbar?.addEventListener("pointerdown", (event) => event.preventDefault());
elements.writerFormatToolbar?.addEventListener("click", handleFormatToolbarClick);
elements.writerCover?.addEventListener("paste", handleCoverPaste);
elements.writerCoverUploadButton?.addEventListener("click", () => elements.writerCoverFile?.click());
elements.writerContentUploadButton?.addEventListener("click", () => elements.writerContentFile?.click());
elements.writerCoverFile?.addEventListener("change", handleCoverFileSelect);
elements.writerContentFile?.addEventListener("change", handleContentFileSelect);
elements.logoutButton?.addEventListener("click", () => clearAuth("已退出登录，请重新输入用户名和密码。"));
elements.detailEditButton?.addEventListener("click", () => {
  if (!state.currentDetailNote) return;
  const note = state.currentDetailNote;
  closeDetail();
  openEditor(note);
});
elements.detailFavoriteButton?.addEventListener("click", () => {
  if (state.currentDetailNote) toggleFavorite(state.currentDetailNote);
});
elements.detailFolderSaveButton?.addEventListener("click", moveCurrentDetailToFolder);

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

syncPageViewFromHash();

bootSite();
setupKnowledgeGraphObserver();

window.addEventListener("resize", () => {
  scheduleKnowledgeGraphResize();
});

function bootSite() {
  updateCurrentUserLabel();
  if (authToken) {
    hideSiteLock();
    loadNotes();
    return;
  }

  showSiteLock();
  hydrateFilters();
  render();
}

async function unlockSite(event) {
  event.preventDefault();
  const username = elements.siteUsernameInput?.value.trim() || "";
  const password = elements.sitePasswordInput?.value.trim() || "";
  if (!username || !password) {
    showSiteLock("请输入用户名和登录密码。");
    return;
  }

  try {
    const response = await fetch(`${apiBase}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) throw new Error(data.error || "登录失败");

    authToken = data.token;
    currentUser = data.user || null;
    persistAuth(authToken, currentUser, Boolean(elements.sitePasswordRemember?.checked));
    updateCurrentUserLabel();
    hideSiteLock();
    await loadNotes();
  } catch (error) {
    clearAuth(error instanceof Error ? error.message : "登录失败，请重试。", true);
  }
}

function showSiteLock(message = "") {
  elements.siteLock?.classList.add("is-visible");
  elements.siteLock?.setAttribute("aria-hidden", "false");
  if (elements.sitePasswordError) elements.sitePasswordError.textContent = message;
  window.setTimeout(() => elements.siteUsernameInput?.focus(), 60);
}

function hideSiteLock() {
  elements.siteLock?.classList.remove("is-visible");
  elements.siteLock?.setAttribute("aria-hidden", "true");
  if (elements.sitePasswordError) elements.sitePasswordError.textContent = "";
}

function persistAuth(token, user, remember) {
  sessionStorage.setItem(authTokenSessionKey, token);
  sessionStorage.setItem(authUserSessionKey, JSON.stringify(user || null));
  if (remember) {
    localStorage.setItem(authTokenLocalKey, token);
    localStorage.setItem(authUserLocalKey, JSON.stringify(user || null));
  } else {
    localStorage.removeItem(authTokenLocalKey);
    localStorage.removeItem(authUserLocalKey);
  }
}

function clearAuth(message = "请重新登录。", showLock = true) {
  authToken = "";
  currentUser = null;
  sessionStorage.removeItem(authTokenSessionKey);
  sessionStorage.removeItem(authUserSessionKey);
  localStorage.removeItem(authTokenLocalKey);
  localStorage.removeItem(authUserLocalKey);
  if (elements.sitePasswordInput) elements.sitePasswordInput.value = "";
  updateCurrentUserLabel();
  if (showLock) showSiteLock(message);
}

function siteHeaders(headers = {}) {
  return authToken
    ? { ...headers, Authorization: `Bearer ${authToken}` }
    : headers;
}

function readStoredUser() {
  try {
    const raw = sessionStorage.getItem(authUserSessionKey) || localStorage.getItem(authUserLocalKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function updateCurrentUserLabel() {
  if (!elements.currentUserLabel) return;
  elements.currentUserLabel.textContent = currentUser?.name || currentUser?.username || "未登录";
}

async function readJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && data?.requiresAccess) {
    clearAuth(data.error || "登录已失效，请重新输入用户名和密码。");
  }
  return data;
}

function openWriter(preferredType = "笔记") {
  state.editingNote = null;
  elements.writerForm?.reset();
  setWriterMarkdown("");
  if (elements.writerNoteId) elements.writerNoteId.value = "";
  if (elements.writerTitle) elements.writerTitle.textContent = "写一篇新笔记";
  if (elements.writerModeLabel) elements.writerModeLabel.textContent = "新建笔记";
  if (elements.writerSubmitButton) elements.writerSubmitButton.textContent = "发布到 Notion";
  elements.writerPanel?.setAttribute("aria-hidden", "false");
  const nextType = NOTE_TYPES.includes(preferredType) ? preferredType : "笔记";
  if (elements.writerTypeSelect) elements.writerTypeSelect.value = nextType;
  updateWriterPrivacyDefault();
  const restored = restoreWriterDraft();
  if (!restored && nextType === "日记") applyDiaryDefaults({ forceTemplate: true });
  syncVisualFromMarkdown();
  renderWriterPreview();
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
  if (elements.writerFolder) elements.writerFolder.value = note.folder || "";
  setWriterMarkdown(blocksToMarkdown(note.content || []));
  if (elements.writerPublished) elements.writerPublished.checked = Boolean(note.published);
  if (elements.writerPinned) elements.writerPinned.checked = Boolean(note.pinned);
  if (elements.writerStatus) elements.writerStatus.textContent = "";
  renderWriterPreview();
  updateWriterDraftStatus("正在编辑已有笔记，草稿会保存在本机");
  document.body.style.overflow = "hidden";
}

function updateWriterPrivacyDefault() {
  if (!elements.writerTypeSelect || !elements.writerPublished) return;
  if (elements.writerTypeSelect.value === "日记") {
    elements.writerPublished.checked = false;
    if (elements.writerCategory) elements.writerCategory.value = "日记";
    applyDiaryDefaults();
  } else {
    elements.writerPublished.checked = true;
    if (elements.writerCategory?.value === "日记") elements.writerCategory.value = "常识";
  }
  renderWriterPreview();
  scheduleWriterDraftSave();
}

function closeWriter() {
  saveWriterDraft();
  elements.writerPanel?.setAttribute("aria-hidden", "true");
  if (elements.detailPanel?.getAttribute("aria-hidden") !== "false") {
    document.body.style.overflow = "";
  }
}

function handleEditorModeSwitch(event) {
  const button = event.target.closest("[data-editor-mode]");
  if (!button) return;
  const nextMode = button.dataset.editorMode === "markdown" ? "markdown" : "visual";
  if (nextMode === writerEditorMode) return;
  if (nextMode === "markdown") syncMarkdownFromVisual();
  else syncVisualFromMarkdown();
  writerEditorMode = nextMode;
  elements.writerContent.hidden = nextMode !== "markdown";
  elements.writerVisualEditor.hidden = nextMode !== "visual";
  elements.editorModeSwitch?.querySelectorAll("[data-editor-mode]").forEach((node) => {
    const active = node.dataset.editorMode === nextMode;
    node.classList.toggle("is-active", active);
    node.setAttribute("aria-pressed", String(active));
  });
  (nextMode === "visual" ? elements.writerVisualEditor : elements.writerContent)?.focus();
}

function handleVisualEditorInput() {
  syncMarkdownFromVisual();
  emitWriterChanged();
}

async function handleVisualEditorPaste(event) {
  const data = await uploadPastedImage(event, "粘贴图片");
  if (!data) return;
  setWriterMarkdown(`${elements.writerContent?.value || ""}\n${data.markdown}\n`);
  emitWriterChanged();
  setWriterStatus("图片已上传到 Notion，并插入正文。");
}

function setWriterMarkdown(value, { syncVisual = true } = {}) {
  if (elements.writerContent) elements.writerContent.value = String(value || "");
  if (syncVisual) syncVisualFromMarkdown();
}

function syncMarkdownFromVisual() {
  if (!elements.writerVisualEditor || !elements.writerContent) return;
  elements.writerContent.value = visualHtmlToMarkdown(elements.writerVisualEditor);
}

function syncVisualFromMarkdown() {
  if (!elements.writerVisualEditor) return;
  const blocks = markdownToPreviewBlocks(elements.writerContent?.value || "");
  elements.writerVisualEditor.innerHTML = blocks.map(blockToEditorHtml).join("") || "<p><br></p>";
}

function blockToEditorHtml(block) {
  const content = richTextToEditorHtml(block.richText, block.text || "");
  if (block.type === "image") {
    const caption = escapeHtml(block.caption || "图片");
    if (String(block.url || "").startsWith("notion-upload:")) {
      return `<p data-image-source="${escapeHtml(block.url)}" data-image-caption="${caption}">图片已插入，保存后即可显示：${caption}</p>`;
    }
    return `<figure><img src="${escapeHtml(block.url || "")}" alt="${caption}"><figcaption>${caption}</figcaption></figure>`;
  }
  if (block.type === "heading_1") return `<h1>${content}</h1>`;
  if (block.type === "heading_2") return `<h2>${content}</h2>`;
  if (block.type === "heading_3") return `<h3>${content}</h3>`;
  if (block.type === "quote" || block.type === "callout") return `<blockquote>${content}</blockquote>`;
  if (block.type === "bulleted_list_item") return `<ul><li>${content}</li></ul>`;
  if (block.type === "numbered_list_item") return `<ol><li>${content}</li></ol>`;
  if (block.type === "to_do") return `<p data-todo="true">☐ ${content}</p>`;
  if (block.type === "code") return `<pre><code>${escapeHtml(block.text || "")}</code></pre>`;
  if (block.type === "divider") return "<hr>";
  return `<p>${content || "<br>"}</p>`;
}

function richTextToEditorHtml(parts, fallback) {
  const values = Array.isArray(parts) && parts.length ? parts : [{ text: fallback }];
  return values.map((part) => {
    let html = escapeHtml(part.text || "");
    if (part.code) html = `<code>${html}</code>`;
    if (part.bold) html = `<strong>${html}</strong>`;
    if (part.italic) html = `<em>${html}</em>`;
    if (part.underline) html = `<u>${html}</u>`;
    if (part.strikethrough) html = `<s>${html}</s>`;
    const color = normalizeRichColor(part.color);
    if (color) html = `<span data-text-color="${color}">${html}</span>`;
    return html;
  }).join("");
}

function visualHtmlToMarkdown(editor) {
  const readInline = (node) => Array.from(node.childNodes).map((child) => {
    if (child.nodeType === Node.TEXT_NODE) return child.textContent || "";
    const tag = child.nodeName.toLowerCase();
    let text = readInline(child);
    if (tag === "strong" || tag === "b") text = `**${text}**`;
    else if (tag === "code") text = `\`${text}\``;
    else if (tag === "em" || tag === "i") text = `*${text}*`;
    const color = child.getAttribute?.("data-text-color") || colorToName(child.getAttribute?.("color") || child.style?.color || "");
    if (color) text = `{${color}:${text}}`;
    return text;
  }).join("");
  const blocks = Array.from(editor.children).flatMap((node) => {
    const tag = node.nodeName.toLowerCase();
    if (tag === "h1") return [`# ${readInline(node)}`];
    if (tag === "h2") return [`## ${readInline(node)}`];
    if (tag === "h3") return [`### ${readInline(node)}`];
    if (tag === "blockquote") return readInline(node).split("\n").map((line) => `> ${line}`);
    if (tag === "ul") return Array.from(node.children).map((item) => `- ${readInline(item)}`);
    if (tag === "ol") return Array.from(node.children).map((item, index) => `${index + 1}. ${readInline(item)}`);
    if (tag === "pre") return [`\`\`\`\n${node.textContent || ""}\n\`\`\``];
    if (tag === "hr") return ["---"];
    if (tag === "figure") {
      const image = node.querySelector("img");
      const caption = node.querySelector("figcaption")?.textContent?.trim() || image?.alt || "图片";
      return image?.src ? [`![${caption}](${image.src})`] : [];
    }
    if (node.dataset.imageSource) return [`![${node.dataset.imageCaption || "图片"}](${node.dataset.imageSource})`];
    const text = readInline(node).replace(/^☐\s*/, "");
    return node.dataset.todo === "true" ? [`- [ ] ${text}`] : [text];
  });
  return blocks.filter(Boolean).join("\n\n");
}

function colorToName(value) {
  const normalized = String(value || "").replace(/\s/g, "").toLowerCase();
  const colors = { "#8e8e93": "gray", "rgb(142,142,147)": "gray", "#8a5a44": "brown", "rgb(138,90,68)": "brown", "#ff9500": "orange", "rgb(255,149,0)": "orange", "#ffcc00": "yellow", "rgb(255,204,0)": "yellow", "#34c759": "green", "rgb(52,199,89)": "green", "#007aff": "blue", "rgb(0,122,255)": "blue", "#af52de": "purple", "rgb(175,82,222)": "purple", "#ff2d55": "pink", "rgb(255,45,85)": "pink", "#ff3b30": "red", "rgb(255,59,48)": "red" };
  return colors[normalized] || "";
}

function insertVisualHtml(html) {
  const editor = elements.writerVisualEditor;
  if (!editor) return;
  editor.focus();
  document.execCommand("insertHTML", false, html);
  syncMarkdownFromVisual();
  emitWriterChanged();
}

async function handleWriterPaste(event) {
  const data = await uploadPastedImage(event, "粘贴图片");
  if (!data) return;

  if (writerEditorMode === "visual") syncVisualFromMarkdown();
  insertAtCursor(elements.writerContent, `\n${data.markdown}\n`);
  if (writerEditorMode === "visual") syncVisualFromMarkdown();
  setWriterStatus("图片已上传到 Notion，并插入正文。");
}

function handleFormatToolbarClick(event) {
  const button = event.target.closest("[data-format]");
  if (!button || !elements.writerContent) return;
  const format = button.dataset.format || "";
  applyWriterFormat(format, button.dataset.color || "");
}

function handleWriterContentKeydown(event) {
  const isShortcut = event.ctrlKey || event.metaKey;
  if (!isShortcut) return;

  if (event.key.toLowerCase() === "b") {
    event.preventDefault();
    applyWriterFormat("bold");
    return;
  }

  if (event.altKey && ["1", "2", "3"].includes(event.key)) {
    event.preventDefault();
    applyWriterFormat(`h${event.key}`);
  }
}

function applyWriterFormat(format, color = "") {
  if (writerEditorMode === "visual") {
    applyVisualFormat(format, color);
    return;
  }
  const textarea = elements.writerContent;
  if (!textarea) return;

  if (format === "bold") {
    wrapSelection(textarea, "**", "**", "加粗文字");
  } else if (format === "quote") {
    prefixSelectedLines(textarea, "> ");
  } else if (format === "bullet") {
    prefixSelectedLines(textarea, "- ");
  } else if (format === "todo") {
    prefixSelectedLines(textarea, "- [ ] ");
  } else if (format === "code") {
    wrapBlockSelection(textarea, "```\n", "\n```", "代码内容");
  } else if (["h1", "h2", "h3"].includes(format)) {
    prefixSelectedLines(textarea, `${"#".repeat(Number(format.slice(1)))} `, /^(#{1,6}\s*)/);
  } else if (format === "color" && color) {
    wrapSelection(textarea, `{${color}:`, "}", "彩色文字");
  } else if (format === "date") {
    insertAtCursor(textarea, formatTodayLine());
  } else if (format === "divider") {
    insertAtCursor(textarea, "\n\n---\n\n");
  } else if (format === "diary-template") {
    insertDiaryTemplate();
  }

  textarea.focus();
  emitWriterChanged();
}

function applyVisualFormat(format, color = "") {
  const editor = elements.writerVisualEditor;
  if (!editor) return;
  editor.focus();
  if (format === "bold") document.execCommand("bold");
  else if (format === "quote") document.execCommand("formatBlock", false, "blockquote");
  else if (format === "bullet") document.execCommand("insertUnorderedList");
  else if (format === "todo") insertVisualHtml('<p data-todo="true">☐ 待办事项</p>');
  else if (format === "code") document.execCommand("formatBlock", false, "pre");
  else if (["h1", "h2", "h3"].includes(format)) document.execCommand("formatBlock", false, format);
  else if (format === "color" && color) {
    const colors = { gray: "#8e8e93", brown: "#8a5a44", orange: "#ff9500", yellow: "#ffcc00", green: "#34c759", blue: "#007aff", purple: "#af52de", pink: "#ff2d55", red: "#ff3b30" };
    document.execCommand("foreColor", false, colors[color] || "#1f2937");
  } else if (format === "date") document.execCommand("insertText", false, formatTodayLine().trim());
  else if (format === "divider") insertVisualHtml("<hr><p><br></p>");
  else if (format === "diary-template") {
    setWriterMarkdown((elements.writerContent?.value || "").trim() ? `${elements.writerContent.value}\n\n${diaryTemplate()}` : diaryTemplate());
  }
  syncMarkdownFromVisual();
  emitWriterChanged();
}

function wrapSelection(textarea, before, after, fallback) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const selected = textarea.value.slice(start, end) || fallback;
  const next = `${before}${selected}${after}`;
  textarea.value = `${textarea.value.slice(0, start)}${next}${textarea.value.slice(end)}`;
  textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
}

function wrapBlockSelection(textarea, before, after, fallback) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const selected = textarea.value.slice(start, end).trim() || fallback;
  const next = `${before}${selected}${after}`;
  textarea.value = `${textarea.value.slice(0, start)}${next}${textarea.value.slice(end)}`;
  textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
}

function prefixSelectedLines(textarea, prefix, replacePattern = null) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const value = textarea.value;
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const lineEndIndex = value.indexOf("\n", end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const selected = value.slice(lineStart, lineEnd) || "";
  const lines = selected.split("\n");
  const next = lines
    .map((line) => {
      const clean = replacePattern ? line.replace(replacePattern, "") : line;
      if (!clean.trim()) return clean;
      return clean.startsWith(prefix) ? clean : `${prefix}${clean}`;
    })
    .join("\n");

  textarea.value = `${value.slice(0, lineStart)}${next}${value.slice(lineEnd)}`;
  textarea.setSelectionRange(lineStart, lineStart + next.length);
}

function handleWriterFormInput() {
  renderWriterPreview();
  scheduleWriterDraftSave();
}

function emitWriterChanged() {
  renderWriterPreview();
  scheduleWriterDraftSave();
}

function writerDraftKey() {
  const userKey = currentUser?.id || currentUser?.username || "guest";
  const noteKey = elements.writerNoteId?.value?.trim() || "new";
  return `${writerDraftPrefix}:${userKey}:${noteKey}`;
}

function collectWriterDraft() {
  return {
    savedAt: new Date().toISOString(),
    id: elements.writerNoteId?.value || "",
    title: elements.writerNoteTitle?.value || "",
    slug: elements.writerSlug?.value || "",
    type: elements.writerTypeSelect?.value || "笔记",
    status: elements.writerStatusSelect?.value || "进行中",
    cover: elements.writerCover?.value || "",
    studyMinutes: elements.writerStudyMinutes?.value || "",
    summary: elements.writerSummary?.value || "",
    category: elements.writerCategory?.value || "",
    tags: elements.writerTags?.value || "",
    folder: elements.writerFolder?.value || "",
    content: elements.writerContent?.value || "",
    published: Boolean(elements.writerPublished?.checked),
    pinned: Boolean(elements.writerPinned?.checked)
  };
}

function scheduleWriterDraftSave() {
  window.clearTimeout(writerDraftTimer);
  writerDraftTimer = window.setTimeout(saveWriterDraft, writerDraftDelayMs);
}

function saveWriterDraft() {
  if (!elements.writerForm || elements.writerPanel?.getAttribute("aria-hidden") === "true") return;
  const draft = collectWriterDraft();
  if (!draft.title && !draft.summary && !draft.content && !draft.cover) {
    localStorage.removeItem(writerDraftKey());
    updateWriterDraftStatus("草稿会自动保存在本机");
    return;
  }
  localStorage.setItem(writerDraftKey(), JSON.stringify(draft));
  updateWriterDraftStatus(`草稿已自动保存 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`);
}

function restoreWriterDraft() {
  if (elements.writerNoteId?.value) return false;
  const raw = localStorage.getItem(writerDraftKey());
  if (!raw) {
    updateWriterDraftStatus("草稿会自动保存在本机");
    return false;
  }

  try {
    const draft = JSON.parse(raw);
    if (elements.writerNoteTitle) elements.writerNoteTitle.value = draft.title || "";
    if (elements.writerSlug) elements.writerSlug.value = draft.slug || "";
    if (elements.writerTypeSelect) elements.writerTypeSelect.value = NOTE_TYPES.includes(draft.type) ? draft.type : "笔记";
    if (elements.writerStatusSelect) elements.writerStatusSelect.value = draft.status || "进行中";
    if (elements.writerCover) elements.writerCover.value = draft.cover || "";
    if (elements.writerStudyMinutes) elements.writerStudyMinutes.value = draft.studyMinutes || "";
    if (elements.writerSummary) elements.writerSummary.value = draft.summary || "";
    if (elements.writerCategory) elements.writerCategory.value = draft.category || "";
    if (elements.writerTags) elements.writerTags.value = draft.tags || "";
    if (elements.writerFolder) elements.writerFolder.value = draft.folder || "";
    setWriterMarkdown(draft.content || "");
    if (elements.writerPublished) elements.writerPublished.checked = Boolean(draft.published);
    if (elements.writerPinned) elements.writerPinned.checked = Boolean(draft.pinned);
    updateWriterDraftStatus("已恢复上次未发布草稿");
    return true;
  } catch {
    localStorage.removeItem(writerDraftKey());
    updateWriterDraftStatus("草稿会自动保存在本机");
    return false;
  }
}

function clearWriterDraft() {
  window.clearTimeout(writerDraftTimer);
  localStorage.removeItem(writerDraftKey());
  updateWriterDraftStatus("已发布，草稿已清除");
}

function updateWriterDraftStatus(message) {
  if (elements.writerDraftStatus) elements.writerDraftStatus.textContent = message;
}

function applyDiaryDefaults({ forceTemplate = false } = {}) {
  if (elements.writerCategory) elements.writerCategory.value = "日记";
  if (!elements.writerTags?.value.trim()) elements.writerTags.value = "日记, 记录";
  if (!elements.writerStudyMinutes?.value) elements.writerStudyMinutes.value = "10";
  if (!elements.writerContent) return;
  if (forceTemplate && !elements.writerContent.value.trim()) {
    setWriterMarkdown(diaryTemplate());
  }
}

function insertDiaryTemplate() {
  if (!elements.writerContent) return;
  if (!elements.writerContent.value.trim()) {
    setWriterMarkdown(diaryTemplate());
    (writerEditorMode === "visual" ? elements.writerVisualEditor : elements.writerContent)?.focus();
    emitWriterChanged();
    return;
  }
  setWriterMarkdown(`${elements.writerContent.value}\n\n${diaryTemplate()}`);
  emitWriterChanged();
}

function diaryTemplate() {
  return `## ${formatDate(new Date()) || "今天"}\n\n### 今日关键词\n- \n\n### 今天发生了什么\n\n\n### 我的想法\n\n\n### 明天想做\n- [ ] `;
}

function formatTodayLine() {
  return `\n${formatDate(new Date()) || new Date().toISOString().slice(0, 10)}\n`;
}

async function handleCoverPaste(event) {
  const data = await uploadPastedImage(event, "封面图片");
  if (!data) return;

  if (elements.writerCover) elements.writerCover.value = `notion-upload:${data.fileUploadId}`;
  setWriterStatus("封面已上传到 Notion，保存笔记后生效。");
}

async function handleCoverFileSelect(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  const data = await uploadImageFile(file, "封面图片", "选择封面图片");
  if (!data) return;

  if (elements.writerCover) elements.writerCover.value = `notion-upload:${data.fileUploadId}`;
  setWriterStatus("封面已上传到 Notion，保存笔记后生效。");
}

async function handleContentFileSelect(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  const data = await uploadImageFile(file, "正文图片", "插入正文图片");
  if (!data) return;

  if (writerEditorMode === "visual") {
    setWriterMarkdown(`${elements.writerContent?.value || ""}\n${data.markdown}\n`);
    emitWriterChanged();
  } else {
    insertAtCursor(elements.writerContent, `\n${data.markdown}\n`);
  }
  setWriterStatus("图片已上传到 Notion，并插入正文。");
}

async function uploadPastedImage(event, altText) {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) return null;

  event.preventDefault();
  const file = imageItem.getAsFile();
  if (!file) return null;

  return uploadImageFile(file, altText, "粘贴图片");
}

async function uploadImageFile(file, altText, actionLabel = "上传图片") {
  if (!file.type.startsWith("image/")) {
    setWriterStatus("请选择图片文件：PNG、JPG、GIF 或 WebP。", true);
    return null;
  }

  const adminToken = elements.writerToken?.value.trim() || localStorage.getItem("kgAdminToken") || "";
  if (!authToken && !adminToken) {
    setWriterStatus(`请先登录，再${actionLabel}。`, true);
    return null;
  }

  try {
    setWriterStatus("正在处理图片...");
    const uploadFile = await prepareImageForUpload(file);
    setWriterStatus(uploadFile === file ? "正在把图片上传到 Notion..." : "图片已压缩，正在上传到 Notion...");
    const dataUrl = await readFileAsDataUrl(uploadFile);
    const response = await fetch(`${apiBase}/api/admin/uploads`, {
      method: "POST",
      headers: siteHeaders({
        "Content-Type": "application/json",
        ...(authToken ? {} : { Authorization: `Bearer ${adminToken}` })
      }),
      body: JSON.stringify({
        filename: uploadFile.name || "notion-image.jpg",
        mimeType: uploadFile.type,
        dataUrl,
        alt: altText
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "图片上传失败");

    if (adminToken && !authToken) localStorage.setItem("kgAdminToken", adminToken);
    return data;
  } catch (error) {
    const message = error instanceof TypeError
      ? "图片上传连接失败：可能是图片过大、网络中断或服务器上传限制。请刷新后重试，或换一张更小的图片。"
      : error instanceof Error ? error.message : "图片上传失败";
    setWriterStatus(message, true);
    return null;
  }
}

async function prepareImageForUpload(file) {
  const maxUploadBytes = 650 * 1024;
  if (file.size <= maxUploadBytes) return file;
  if (/image\/gif/i.test(file.type)) {
    throw new Error("GIF 图片太大，请换成 JPG / PNG / WebP，或先压缩后再上传。");
  }
  if (!/image\/(?:png|jpe?g|webp)/i.test(file.type)) return file;

  const image = await loadImageElement(file);
  const sourceMax = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  let scale = sourceMax > 1600 ? 1600 / sourceMax : 1;
  let quality = 0.82;
  let blob = null;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    blob = await renderImageBlob(image, width, height, quality);
    if (blob.size <= maxUploadBytes) break;
    if (quality > 0.58) {
      quality -= 0.08;
    } else {
      scale *= 0.82;
    }
  }

  if (!blob || blob.size >= file.size) return file;
  const filename = file.name
    ? file.name.replace(/\.[a-z0-9]+$/i, ".jpg")
    : "notion-image.jpg";
  return new File([blob], filename, { type: "image/jpeg", lastModified: Date.now() });
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("读取图片失败，请换一张图片重试。"));
    };
    image.src = url;
  });
}

function renderImageBlob(image, width, height, quality) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("浏览器不支持图片压缩。"));
      return;
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("图片压缩失败，请换一张图片重试。"));
    }, "image/jpeg", quality);
  });
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
  emitWriterChanged();
}

async function createNoteFromWriter(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const adminToken = String(formData.get("token") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const noteId = String(formData.get("id") || "").trim();

  if ((!authToken && !adminToken) || !title) {
    setWriterStatus(authToken || adminToken ? "请填写标题。" : "请先登录，再填写标题。", true);
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
    folder: String(formData.get("folder") || "").trim(),
    content: String(formData.get("content") || "").trim(),
    published: formData.get("published") === "on",
    pinned: formData.get("pinned") === "on"
  };

  submitButton.disabled = true;
  setWriterStatus(noteId ? "正在保存修改到 Notion..." : "正在同步到 Notion...");

  try {
    const response = await fetch(noteId ? `${apiBase}/api/admin/notes/${encodeURIComponent(noteId)}` : `${apiBase}/api/admin/notes`, {
      method: noteId ? "PUT" : "POST",
      headers: siteHeaders({
        "Content-Type": "application/json",
        ...(authToken ? {} : { Authorization: `Bearer ${adminToken}` })
      }),
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "创建笔记失败");

    if (adminToken && !authToken) localStorage.setItem("kgAdminToken", adminToken);
    if (!noteId) {
      form.reset();
      if (elements.writerToken) elements.writerToken.value = adminToken;
      if (elements.writerTypeSelect) elements.writerTypeSelect.value = "笔记";
      if (elements.writerPublished) elements.writerPublished.checked = true;
      renderWriterPreview();
    }
    state.detailCache.clear();
    clearWriterDraft();
    setWriterStatus(noteId ? `已保存修改：${data.note?.title || title}` : `已同步：${data.note?.title || title}${payload.published ? "" : "。可在“我的笔记-私密”里查看。"}`);
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
    const response = await fetch(`${apiBase}/api/notes${refresh ? "?refresh=1" : ""}`, {
      headers: siteHeaders()
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.error || "读取笔记失败");
    if (data.user) {
      currentUser = data.user;
      persistAuth(authToken, currentUser, Boolean(localStorage.getItem(authTokenLocalKey)));
      updateCurrentUserLabel();
    }
    state.notes = normalizeNotes(data.notes);
    setStatus(`已载入 ${state.notes.length} 篇可查看笔记${data.cached ? "，来自缓存" : ""}`);
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
    author: String(note.author || ""),
    userId: String(note.userId || ""),
    folder: String(note.folder || "").trim(),
    favorite: Boolean(note.favorite),
    visibility: String(note.visibility || ""),
    published: Boolean(note.published),
    pinned: Boolean(note.pinned),
    content: Array.isArray(note.content) ? note.content : []
  }));
}

function hydrateFilters() {
  const currentType = elements.typeFilter?.value || "all";
  const currentCategory = elements.categoryFilter.value;
  const currentTag = elements.tagFilter.value;
  const currentAuthor = elements.authorFilter?.value || "all";
  const currentMonth = elements.monthFilter?.value || "all";
  const currentFolder = elements.folderFilter?.value || "all";
  const types = unique([...NOTE_TYPES, ...state.notes.map((note) => note.type).filter(Boolean)]);
  const categories = unique([...CATEGORY_OPTIONS, ...state.notes.map((note) => note.category).filter(Boolean)]);
  const tags = unique(state.notes.flatMap((note) => note.tags));
  const authors = unique(state.notes.map(noteAuthorLabel).filter(Boolean));
  const months = unique(state.notes.map(noteMonth).filter(Boolean)).sort().reverse();
  const folders = knownFolders();

  if (elements.typeFilter) fillSelect(elements.typeFilter, "全部类型", types);
  fillSelect(elements.categoryFilter, "全部分类", categories);
  fillSelect(elements.tagFilter, "全部标签", tags);
  if (elements.authorFilter) fillSelect(elements.authorFilter, "全部作者", authors);
  if (elements.monthFilter) fillSelect(elements.monthFilter, "全部月份", months, formatMonthLabel);
  if (elements.folderFilter) fillSelect(elements.folderFilter, "全部文件夹", folders);
  if (elements.writerFolderOptions) {
    elements.writerFolderOptions.innerHTML = "";
    folders.forEach((folder) => elements.writerFolderOptions.append(new Option(folder, folder)));
  }

  if (types.includes(currentType)) elements.typeFilter.value = currentType;
  if (categories.includes(currentCategory)) elements.categoryFilter.value = currentCategory;
  if (tags.includes(currentTag)) elements.tagFilter.value = currentTag;
  if (authors.includes(currentAuthor)) elements.authorFilter.value = currentAuthor;
  if (months.includes(currentMonth)) elements.monthFilter.value = currentMonth;
  if (folders.includes(currentFolder)) elements.folderFilter.value = currentFolder;
}

function fillSelect(select, label, values, labelFormatter = (value) => value) {
  select.innerHTML = "";
  select.append(new Option(label, "all"));
  for (const value of values) select.append(new Option(labelFormatter(value), value));
}

function render() {
  const notes = filteredNotes();
  renderStats(state.notes);
  renderWorkbench(state.notes);
  renderGrid(notes);
  renderFilterSummary(notes.length);
  renderOrganization();
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
  renderTimeline(notes);
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

function renderTimeline(notes) {
  if (!elements.timelineList) return;
  elements.timelineList.innerHTML = "";

  const timelineNotes = [...notes]
    .sort((a, b) => compareDate(b.updated || b.created, a.updated || a.created))
    .slice(0, 8);

  if (!timelineNotes.length) {
    elements.timelineList.append(emptyInline("暂无更新记录"));
    return;
  }

  let lastDate = "";
  for (const note of timelineNotes) {
    const rawDate = note.updated || note.created;
    const currentDate = dateKey(rawDate);
    if (currentDate && currentDate !== lastDate) {
      const day = document.createElement("div");
      day.className = "timeline-day";
      day.textContent = formatDate(currentDate) || currentDate;
      elements.timelineList.append(day);
      lastDate = currentDate;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "timeline-item";
    button.innerHTML = `
      <span>${escapeHtml(note.type || "笔记")}</span>
      <strong>${escapeHtml(note.title)}</strong>
      <p>${escapeHtml(note.summary || note.category || "没有摘要")}</p>
    `;
    button.addEventListener("click", () => openDetail(note));
    elements.timelineList.append(button);
  }
}

function renderKnowledgeGraph(notes, attempt = 0, force = false) {
  if (!elements.knowledgeGraph) return;
  if (!window.echarts) {
    setKnowledgeGraphMessage("知识星图正在加载，稍后会自动重试。");
    scheduleKnowledgeGraphRetry(notes, attempt);
    return;
  }

  const width = elements.knowledgeGraph.clientWidth;
  const height = elements.knowledgeGraph.clientHeight;
  if (width < 160 || height < 140) {
    setKnowledgeGraphMessage("知识星图将在区域显示后自动绘制。");
    scheduleKnowledgeGraphRetry(notes, attempt);
    return;
  }

  try {
    if (force && knowledgeChart) {
      knowledgeChart.dispose();
      knowledgeChart = null;
    }
    knowledgeChart ||= window.echarts.getInstanceByDom(elements.knowledgeGraph);
    if (!knowledgeChart) {
      elements.knowledgeGraph.replaceChildren();
      knowledgeChart = window.echarts.init(elements.knowledgeGraph, null, { renderer: "canvas" });
      knowledgeChart.on("click", handleKnowledgeGraphClick);
    }

    const compact = height < 300;
    const graph = buildKnowledgeGraph(notes, compact ? 14 : 26);

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
          repulsion: compact ? 92 : 150,
          edgeLength: compact ? [36, 72] : [48, 104],
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
    }, { notMerge: true });
    if (elements.graphHint) elements.graphHint.textContent = "点击节点进入对应知识";
    window.clearTimeout(graphRetryTimer);
    scheduleKnowledgeGraphResize();
  } catch (error) {
    knowledgeChart?.dispose();
    knowledgeChart = null;
    setKnowledgeGraphMessage("知识星图暂时未准备好，正在重试…");
    scheduleKnowledgeGraphRetry(notes, attempt);
  }
}

function handleKnowledgeGraphClick(params) {
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
}

function setKnowledgeGraphMessage(message) {
  if (!knowledgeChart) elements.knowledgeGraph.textContent = message;
  if (elements.graphHint) elements.graphHint.textContent = message;
}

function scheduleKnowledgeGraphRetry(notes, attempt = 0) {
  if (attempt >= 5) return;
  window.clearTimeout(graphRetryTimer);
  graphRetryTimer = window.setTimeout(() => renderKnowledgeGraph(notes, attempt + 1), 240 + attempt * 220);
}

function setupKnowledgeGraphObserver() {
  if (!elements.knowledgeGraph || !window.ResizeObserver) return;
  graphResizeObserver = new ResizeObserver((entries) => {
    const { width, height } = entries[0]?.contentRect || {};
    if (width < 160 || height < 140) return;
    if (knowledgeChart) scheduleKnowledgeGraphResize();
    else renderKnowledgeGraph(state.notes);
  });
  graphResizeObserver.observe(elements.knowledgeGraph);
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
  scheduleKnowledgeGraphResize();
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
  scheduleKnowledgeGraphResize();
}

function scheduleKnowledgeGraphResize() {
  if (!knowledgeChart) return;
  requestAnimationFrame(() => knowledgeChart?.resize());
  setTimeout(() => knowledgeChart?.resize(), 80);
  setTimeout(() => knowledgeChart?.resize(), 220);
  setTimeout(() => knowledgeChart?.resize(), 420);
}

function buildKnowledgeGraph(notes, noteLimit = 26) {
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

  for (const note of notes.slice(0, noteLimit)) {
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
  const reviewNotes = [...notes]
    .filter((note) => !note.pinned)
    .sort((a, b) => compareDate(a.updated || a.created, b.updated || b.created))
    .slice(0, 3);

  if (!reviewNotes.length) {
    elements.recentList.append(emptyInline("暂无待回看"));
    return;
  }

  for (const note of reviewNotes) {
    const button = document.createElement("button");
    button.className = "recent-item";
    button.type = "button";
    button.innerHTML = `
      <span>${escapeHtml(formatDate(note.updated || note.created) || "待回看")}</span>
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
    .filter((note) => {
      if (state.scope === "mine") return isMyNote(note);
      if (state.scope === "others-public") return isPublicNote(note) && !isMyNote(note);
      return true;
    })
    .filter((note) => state.type === "all" || note.type === state.type)
    .filter((note) => {
      if (state.visibility === "public") return isPublicNote(note);
      if (state.visibility === "private") return !isPublicNote(note) && isMyNote(note);
      if (state.visibility === "others-public") return isPublicNote(note) && !isMyNote(note);
      return true;
    })
    .filter((note) => state.category === "all" || note.category === state.category)
    .filter((note) => state.tag === "all" || note.tags.includes(state.tag))
    .filter((note) => state.folder === "all" || note.folder === state.folder)
    .filter((note) => !state.favoritesOnly || (isMyNote(note) && note.favorite))
    .filter((note) => state.author === "all" || noteAuthorLabel(note) === state.author)
    .filter((note) => state.month === "all" || noteMonth(note) === state.month)
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

function isPublicNote(note) {
  return Boolean(note.published || note.visibility === "公开");
}

function isMyNote(note) {
  const identities = [currentUser?.id, currentUser?.username]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  const ownerId = String(note.userId || "").trim().toLowerCase();
  return Boolean(ownerId) && identities.includes(ownerId);
}

function noteAuthorLabel(note) {
  if (isMyNote(note)) return currentUser?.name || currentUser?.username || note.author || "我";
  return String(note.author || note.userId || "未知作者");
}

function noteMonth(note) {
  const value = String(note.updated || note.created || "");
  const match = value.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function formatMonthLabel(value) {
  const [year, month] = String(value).split("-");
  return year && month ? `${year} 年 ${Number(month)} 月` : value;
}

function renderFilterSummary(count) {
  if (elements.filterResultCount) elements.filterResultCount.textContent = `${count} 篇笔记`;
  elements.scopeSwitch?.querySelectorAll("[data-scope]").forEach((button) => {
    const active = button.dataset.scope === state.scope;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (!elements.activeFilters) return;
  elements.activeFilters.innerHTML = "";
  const values = [
    ["query", state.query && `搜索：${state.query}`],
    ["type", state.type !== "all" && state.type],
    ["visibility", state.visibility !== "all" && elements.visibilityFilter?.selectedOptions[0]?.textContent],
    ["category", state.category !== "all" && state.category],
    ["tag", state.tag !== "all" && `#${state.tag}`],
    ["folder", state.folder !== "all" && `文件夹：${state.folder}`],
    ["favoritesOnly", state.favoritesOnly && "我的收藏"],
    ["author", state.author !== "all" && `作者：${state.author}`],
    ["month", state.month !== "all" && formatMonthLabel(state.month)]
  ].filter(([, value]) => value);
  if (!values.length) {
    const hint = document.createElement("span");
    hint.className = "filter-hint";
    hint.textContent = "可同时选择类型、分类、标签、作者和月份";
    elements.activeFilters.append(hint);
    return;
  }
  for (const [key, value] of values) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "active-filter-chip";
    chip.dataset.clearFilter = key;
    chip.textContent = `${value} ×`;
    chip.setAttribute("aria-label", `移除筛选：${value}`);
    elements.activeFilters.append(chip);
  }
}

function clearFilter(key) {
  const defaults = { query: "", type: "all", visibility: "all", category: "all", tag: "all", folder: "all", favoritesOnly: false, author: "all", month: "all" };
  if (!(key in defaults)) return;
  state[key] = defaults[key];
  const controls = { query: elements.searchInput, type: elements.typeFilter, visibility: elements.visibilityFilter, category: elements.categoryFilter, tag: elements.tagFilter, folder: elements.folderFilter, author: elements.authorFilter, month: elements.monthFilter };
  if (controls[key]) controls[key].value = defaults[key];
  resetNoteList();
  render();
}

function resetFilters() {
  state.scope = "all";
  ["query", "type", "visibility", "category", "tag", "folder", "author", "month"].forEach((key) => {
    const defaults = { query: "", type: "all", visibility: "all", category: "all", tag: "all", folder: "all", author: "all", month: "all" };
    state[key] = defaults[key];
  });
  state.favoritesOnly = false;
  [elements.searchInput, elements.typeFilter, elements.visibilityFilter, elements.categoryFilter, elements.tagFilter, elements.folderFilter, elements.authorFilter, elements.monthFilter]
    .filter(Boolean).forEach((control) => { control.value = control === elements.searchInput ? "" : "all"; });
  resetNoteList();
  render();
}

function folderRegistryKey() {
  return `${folderRegistryPrefix}:${currentUser?.id || currentUser?.username || "guest"}`;
}

function knownFolders() {
  const fromNotes = state.notes.filter(isMyNote).map((note) => note.folder).filter(Boolean);
  try {
    const saved = JSON.parse(localStorage.getItem(folderRegistryKey()) || "[]");
    return unique([...fromNotes, ...(Array.isArray(saved) ? saved : [])]).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  } catch {
    return unique(fromNotes);
  }
}

function saveFolderRegistry(folders) {
  localStorage.setItem(folderRegistryKey(), JSON.stringify(unique(folders.map((value) => String(value).trim()).filter(Boolean))));
}

function createCustomFolder(event) {
  event.preventDefault();
  const folder = elements.newFolderInput?.value.trim().slice(0, 40);
  if (!folder) return;
  const folders = knownFolders();
  if (!folders.includes(folder)) saveFolderRegistry([...folders, folder]);
  if (elements.newFolderInput) elements.newFolderInput.value = "";
  state.folder = folder;
  hydrateFilters();
  if (elements.folderFilter) elements.folderFilter.value = folder;
  resetNoteList();
  render();
}

function renderOrganization() {
  const folders = knownFolders();
  const ownNotes = state.notes.filter(isMyNote);
  const favorites = ownNotes.filter((note) => note.favorite).length;
  if (elements.favoriteCount) elements.favoriteCount.textContent = String(favorites);
  if (elements.favoriteFilterButton) {
    elements.favoriteFilterButton.classList.toggle("is-active", state.favoritesOnly);
    elements.favoriteFilterButton.setAttribute("aria-pressed", String(state.favoritesOnly));
  }
  if (!elements.folderList) return;
  elements.folderList.innerHTML = "";
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `folder-chip${state.folder === "all" ? " is-active" : ""}`;
  allButton.dataset.folder = "all";
  allButton.textContent = `全部文件夹 ${ownNotes.length}`;
  elements.folderList.append(allButton);
  for (const folder of folders) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `folder-chip${state.folder === folder ? " is-active" : ""}`;
    button.dataset.folder = folder;
    button.textContent = `${folder} ${ownNotes.filter((note) => note.folder === folder).length}`;
    elements.folderList.append(button);
  }
}

async function toggleFavorite(note) {
  if (!isMyNote(note)) return;
  const next = !note.favorite;
  try {
    await saveNoteOrganization(note, { favorite: next });
    note.favorite = next;
    state.notes.forEach((item) => {
      if (item.id === note.id || item.slug === note.slug) item.favorite = next;
    });
    state.detailCache.clear();
    render();
    if (state.currentDetailNote?.id === note.id) renderDetail({ ...state.currentDetailNote, favorite: next });
    setStatus(next ? "已加入收藏。" : "已取消收藏。");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "更新收藏失败。", true);
  }
}

async function moveCurrentDetailToFolder() {
  const note = state.currentDetailNote;
  if (!note || !isMyNote(note)) return;
  const folder = elements.detailFolderInput?.value.trim().slice(0, 40) || "";
  const button = elements.detailFolderSaveButton;
  if (button) button.disabled = true;
  try {
    await saveNoteOrganization(note, { folder });
    note.folder = folder;
    state.notes.forEach((item) => {
      if (item.id === note.id || item.slug === note.slug) item.folder = folder;
    });
    if (folder) saveFolderRegistry([...knownFolders(), folder]);
    hydrateFilters();
    render();
    renderDetail(note);
    setStatus(folder ? `已移入“${folder}”。` : "已移出文件夹。");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "移动笔记失败。", true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function saveNoteOrganization(note, changes) {
  if (!authToken) throw new Error("请先登录，再整理笔记。");
  const payload = {
    title: note.title,
    type: note.type,
    slug: note.slug,
    summary: note.summary,
    category: note.category,
    cover: note.cover,
    status: note.status,
    studyMinutes: note.studyMinutes,
    tags: note.tags,
    folder: note.folder || "",
    favorite: Boolean(note.favorite),
    published: Boolean(note.published),
    pinned: Boolean(note.pinned),
    ...changes
  };
  const response = await fetch(`${apiBase}/api/admin/notes/${encodeURIComponent(note.id || note.slug)}`, {
    method: "PATCH",
    headers: siteHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload)
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "更新笔记组织信息失败");
  return data.note;
}

function openNotesLibrary() {
  document.body.classList.add("notes-library-mode");
}

function closeNotesLibrary() {
  history.pushState("", document.title, `${window.location.pathname}${window.location.search}`);
  document.body.classList.remove("notes-library-mode");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function syncPageViewFromHash() {
  document.body.classList.toggle("notes-library-mode", window.location.hash === "#notesLibrary");
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
    empty.textContent = state.visibility === "private"
      ? "没有匹配的私密笔记。"
      : state.visibility === "others-public" ? "没有其他用户公开的匹配笔记。" : "没有匹配的笔记。";
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
  const favoriteButton = node.querySelector(".note-favorite");
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
  if (favoriteButton) {
    favoriteButton.hidden = !isMyNote(note);
    favoriteButton.classList.toggle("is-active", Boolean(note.favorite));
    favoriteButton.textContent = note.favorite ? "★" : "☆";
    favoriteButton.setAttribute("aria-label", note.favorite ? "取消收藏笔记" : "收藏笔记");
    favoriteButton.addEventListener("click", () => toggleFavorite(note));
  }

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
  const response = await fetch(`${apiBase}/api/notes/${encodeURIComponent(key)}`, {
    headers: siteHeaders()
  });
  const data = await readJsonResponse(response);
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
  if (elements.detailAuthor) elements.detailAuthor.textContent = `作者 · ${noteAuthorLabel(note)}`;
  if (elements.detailReadingTime) elements.detailReadingTime.textContent = `${estimateReadingMinutes(note)} 分钟阅读`;
  renderTags(elements.detailTags, note.tags || []);
  const headings = renderBlocks(elements.detailContent, note.content || []);
  renderToc(headings);
  observeDetailHeadings();
  renderRelatedNotes(note);
  renderDetailNavigation(note);
  if (elements.detailEditButton) elements.detailEditButton.hidden = !isMyNote(note);
  if (elements.detailFavoriteButton) {
    elements.detailFavoriteButton.hidden = !isMyNote(note);
    elements.detailFavoriteButton.classList.toggle("is-active", Boolean(note.favorite));
    elements.detailFavoriteButton.textContent = note.favorite ? "★ 已收藏" : "☆ 收藏笔记";
  }
  if (elements.detailFolderWidget) elements.detailFolderWidget.hidden = !isMyNote(note);
  if (elements.detailFolderInput) elements.detailFolderInput.value = note.folder || "";
  if (elements.detailCard) elements.detailCard.scrollTop = 0;
  updateReadingProgress();
}

function estimateReadingMinutes(note) {
  const text = (note.content || []).map((block) => block.text || block.caption || "").join(" ");
  const characterCount = text.replace(/\s/g, "").length;
  return Math.max(1, Math.ceil(characterCount / 450));
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

function renderWriterPreview() {
  if (!elements.writerPreview) return;
  const markdown = elements.writerContent?.value || "";
  const blocks = markdownToPreviewBlocks(markdown);
  renderBlocks(elements.writerPreview, blocks);
}

function markdownToPreviewBlocks(markdown) {
  const blocks = [];
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  let paragraph = [];
  let inCode = false;
  let codeLines = [];
  let codeLanguage = "";

  const flushParagraph = () => {
    const text = paragraph.join("\n").trim();
    paragraph = [];
    if (text) blocks.push(previewTextBlock("paragraph", text));
  };

  const flushCode = () => {
    blocks.push({
      type: "code",
      text: codeLines.join("\n"),
      language: codeLanguage || "plain text"
    });
    codeLines = [];
    codeLanguage = "";
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const codeFence = line.trim().match(/^```(.*)$/);
    if (codeFence) {
      if (inCode) flushCode();
      else {
        flushParagraph();
        codeLanguage = codeFence[1]?.trim() || "";
      }
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: "divider" });
      continue;
    }

    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/i);
    if (image) {
      flushParagraph();
      blocks.push({ type: "image", url: image[2], caption: image[1] || "图片" });
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push(previewTextBlock(`heading_${heading[1].length}`, heading[2]));
      continue;
    }

    const todo = trimmed.match(/^[-*]\s+\[( |x|X)\]\s+(.+)$/);
    if (todo) {
      flushParagraph();
      blocks.push(previewTextBlock("to_do", todo[2], { checked: todo[1].toLowerCase() === "x" }));
      continue;
    }

    const quote = trimmed.match(/^>\s+(.+)$/);
    if (quote) {
      flushParagraph();
      blocks.push(previewTextBlock("quote", quote[1]));
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      blocks.push(previewTextBlock("bulleted_list_item", bullet[1]));
      continue;
    }

    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      blocks.push(previewTextBlock("numbered_list_item", numbered[1]));
      continue;
    }

    paragraph.push(line);
  }

  if (inCode) flushCode();
  flushParagraph();
  return blocks;
}

function previewTextBlock(type, text, extra = {}) {
  return {
    type,
    text,
    richText: parsePreviewRichText(text),
    ...extra
  };
}

function parsePreviewRichText(text) {
  const source = String(text || "");
  const parts = [];
  let index = 0;

  const push = (value, attrs = {}) => {
    if (!value) return;
    parts.push({ text: value, ...attrs });
  };

  while (index < source.length) {
    const rest = source.slice(index);
    const boldEnd = rest.startsWith("**") ? source.indexOf("**", index + 2) : -1;
    if (boldEnd !== -1) {
      push(source.slice(index + 2, boldEnd), { bold: true });
      index = boldEnd + 2;
      continue;
    }

    const codeEnd = rest.startsWith("`") ? source.indexOf("`", index + 1) : -1;
    if (codeEnd !== -1) {
      push(source.slice(index + 1, codeEnd), { code: true });
      index = codeEnd + 1;
      continue;
    }

    const colorMatch = rest.match(/^\{([a-zA-Z\u4e00-\u9fa5]+):/);
    if (colorMatch) {
      const contentStart = index + colorMatch[0].length;
      const colorEnd = source.indexOf("}", contentStart);
      if (colorEnd !== -1) {
        push(source.slice(contentStart, colorEnd), { color: colorMatch[1] });
        index = colorEnd + 1;
        continue;
      }
    }

    const nextMarkers = [
      source.indexOf("**", index + 1),
      source.indexOf("`", index + 1),
      source.slice(index + 1).search(/\{[a-zA-Z\u4e00-\u9fa5]+:/)
    ]
      .map((position, markerIndex) => {
        if (position < 0) return -1;
        return markerIndex === 2 ? index + 1 + position : position;
      })
      .filter((position) => position > index);
    const nextIndex = nextMarkers.length ? Math.min(...nextMarkers) : source.length;
    push(source.slice(index, nextIndex));
    index = nextIndex;
  }

  return parts.length ? parts : [{ text: source }];
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
    if (type === "to_do") {
      activeList = null;
      activeListType = "";
      container.append(renderBlock(block, headings, index));
      continue;
    }
    if (type === "bulleted_list_item" || type === "numbered_list_item") {
      const listTag = type === "numbered_list_item" ? "ol" : "ul";
      if (!activeList || activeListType !== listTag) {
        activeList = document.createElement(listTag);
        activeListType = listTag;
        container.append(activeList);
      }
      const item = document.createElement("li");
      appendRichText(item, block);
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
    appendRichText(quote, block);
    return quote;
  }
  if (type === "to_do") {
    const item = document.createElement("label");
    item.className = "article-todo";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(block.checked);
    checkbox.disabled = true;
    const text = document.createElement("span");
    appendRichText(text, block);
    item.append(checkbox, text);
    return item;
  }
  if (type === "code") {
    const figure = document.createElement("figure");
    figure.className = "code-card";
    const caption = document.createElement("figcaption");
    const language = document.createElement("span");
    language.textContent = block.language || "code";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "code-copy-button";
    copy.textContent = "复制";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(block.text || "");
        copy.textContent = "已复制";
        window.setTimeout(() => { copy.textContent = "复制"; }, 1400);
      } catch {
        copy.textContent = "复制失败";
      }
    });
    caption.append(language, copy);
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = block.text || "";
    pre.append(code);
    figure.append(caption, pre);
    return figure;
  }
  if (type === "heading_1" || type === "heading_2") {
    const heading = document.createElement("h2");
    appendRichText(heading, block);
    heading.id = headingId(block.text, index);
    headings.push({ id: heading.id, text: block.text || "", level: 2 });
    return heading;
  }
  if (type === "heading_3") {
    const heading = document.createElement("h3");
    appendRichText(heading, block);
    heading.id = headingId(block.text, index);
    headings.push({ id: heading.id, text: block.text || "", level: 3 });
    return heading;
  }
  const paragraph = document.createElement("p");
  appendRichText(paragraph, block);
  return paragraph;
}

function appendRichText(container, block) {
  const parts = Array.isArray(block.richText) && block.richText.length
    ? block.richText
    : [{ text: block.text || "" }];
  for (const part of parts) {
    const span = document.createElement(part.code ? "code" : "span");
    span.textContent = part.text || "";
    if (part.bold) span.classList.add("rt-bold");
    if (part.italic) span.classList.add("rt-italic");
    if (part.underline) span.classList.add("rt-underline");
    if (part.strikethrough) span.classList.add("rt-strike");
    const color = normalizeRichColor(part.color);
    if (color) span.classList.add(`rt-${color}`);
    container.append(span);
  }
}

function normalizeRichColor(color) {
  const value = String(color || "").replace(/_background$/i, "").toLowerCase();
  return ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"].includes(value) ? value : "";
}

function blocksToMarkdown(blocks) {
  return (blocks || []).map((block, index) => {
    const text = richBlockToMarkdown(block);
    if (block.type === "heading_1") return `# ${text}`;
    if (block.type === "heading_2") return `## ${text}`;
    if (block.type === "heading_3") return `### ${text}`;
    if (block.type === "quote" || block.type === "callout") return `> ${text}`;
    if (block.type === "to_do") return `- [${block.checked ? "x" : " "}] ${text}`;
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

function richBlockToMarkdown(block) {
  if (!Array.isArray(block.richText) || !block.richText.length) return block.text || "";
  return block.richText.map((part) => {
    let value = part.text || "";
    const color = normalizeRichColor(part.color);
    if (color) value = `{${color}:${value}}`;
    if (part.code) value = `\`${value}\``;
    if (part.bold) value = `**${value}**`;
    return value;
  }).join("");
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
    button.dataset.headingId = heading.id;
    button.textContent = heading.text;
    button.addEventListener("click", () => {
      document.getElementById(heading.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    elements.detailToc.append(button);
  }
}

function observeDetailHeadings() {
  detailHeadingObserver?.disconnect();
  const headings = elements.detailContent?.querySelectorAll("h2[id], h3[id]") || [];
  if (!headings.length || !elements.detailCard) return;
  detailHeadingObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    elements.detailToc?.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.headingId === visible.target.id);
    });
  }, { root: elements.detailCard, rootMargin: "-12% 0px -72%", threshold: 0 });
  headings.forEach((heading) => detailHeadingObserver.observe(heading));
}

function updateReadingProgress() {
  if (!elements.detailCard || !elements.readingProgress) return;
  const max = elements.detailCard.scrollHeight - elements.detailCard.clientHeight;
  const progress = max > 0 ? Math.min(1, elements.detailCard.scrollTop / max) : 0;
  elements.readingProgress.style.transform = `scaleX(${progress})`;
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
  detailHeadingObserver?.disconnect();
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
