const apiBase = String(window.KG_CONFIG?.apiBase || "").replace(/\/$/, "");
const authTokenSessionKey = "kgUserToken";
const authTokenLocalKey = "kgUserTokenRemembered";
const authUserSessionKey = "kgCurrentUser";
const authUserLocalKey = "kgCurrentUserRemembered";
const writerDraftPrefix = "kgWriterDraft:v2";
const folderRegistryPrefix = "kgFolders:v1";
const visitorModeRequested = new URLSearchParams(window.location.search).get("mode") === "visitor";
const folderPathSeparator = " / ";
let folderBrowserPath = "";
const expandedFolderPaths = new Set();
const writerDraftDelayMs = 500;
const detailRequestTimeoutMs = 12000;
let detailFolderFeedbackTimer = null;
let authToken =
  sessionStorage.getItem(authTokenSessionKey) ||
  localStorage.getItem(authTokenLocalKey) ||
  "";
let currentUser = readStoredUser();
// Existing owner identity wins over a visitor URL. This also handles sessions saved by earlier app versions.
const hasStoredOwnerSession = Boolean(authToken || currentUser?.id || currentUser?.username || currentUser?.name);
let isVisitorMode = visitorModeRequested && !hasStoredOwnerSession;

const state = {
  notes: [],
  detailCache: new Map(),
  currentDetailNote: null,
  detailRequestId: 0,
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
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  calendarSelectedDate: dateKey(new Date()),
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
  todayMetricNotes: document.querySelector("#todayMetricNotes"),
  todayMetricCategories: document.querySelector("#todayMetricCategories"),
  todayMetricTags: document.querySelector("#todayMetricTags"),
  todayMetricUpdated: document.querySelector("#todayMetricUpdated"),
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
  insightReading: document.querySelector("#insightReading"),
  insightNewNotes: document.querySelector("#insightNewNotes"),
  insightIdeas: document.querySelector("#insightIdeas"),
  insightStreak: document.querySelector("#insightStreak"),
  insightActiveTopics: document.querySelector("#insightActiveTopics"),
  insightTip: document.querySelector("#insightTip"),
  insightRecentUpdates: document.querySelector("#insightRecentUpdates"),
  aiAssistantButton: document.querySelector("#aiAssistantButton"),
  aiAssistantPanel: document.querySelector("#aiAssistantPanel"),
  aiAssistantClose: document.querySelector("#aiAssistantClose"),
  aiAssistantInput: document.querySelector("#aiAssistantInput"),
  aiAssistantOrganize: document.querySelector("#aiAssistantOrganize"),
  aiAssistantResult: document.querySelector("#aiAssistantResult"),
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
  pageTitle: document.querySelector("#pageTitle"),
  pageSubtitle: document.querySelector("#pageSubtitle"),
  globalSearch: document.querySelector("#globalSearch"),
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
  folderBreadcrumb: document.querySelector("#folderBreadcrumb"),
  folderHub: document.querySelector("#folderHub"),
  folderPageMount: document.querySelector("#folderPageMount"),
  folderContent: document.querySelector("#folderContent"),
  folderContentMeta: document.querySelector("#folderContentMeta"),
  folderLocationTitle: document.querySelector("#folderLocationTitle"),
  folderBackButton: document.querySelector("#folderBackButton"),
  folderRootButton: document.querySelector("#folderRootButton"),
  folderOpenNotesButton: document.querySelector("#folderOpenNotesButton"),
  finderFavoriteCount: document.querySelector("#finderFavoriteCount"),
  folderPickerButton: document.querySelector("#folderPickerButton"),
  folderPickerLabel: document.querySelector("#folderPickerLabel"),
  newFolderButton: document.querySelector("#newFolderButton"),
  activeFilters: document.querySelector("#activeFilters"),
  filterResultCount: document.querySelector("#filterResultCount"),
  resetFilters: document.querySelector("#resetFilters"),
  loadMoreNotes: document.querySelector("#loadMoreNotes"),
  collapseNotes: document.querySelector("#collapseNotes"),
  refreshButton: document.querySelector("#refreshButton"),
  writerButton: document.querySelector("#writerButton"),
  sidebarWriteButton: document.querySelector("#sidebarWriteButton"),
  sidebarDiaryButton: document.querySelector("#sidebarDiaryButton"),
  sidebarRefreshButton: document.querySelector("#sidebarRefreshButton"),
  calendarPrev: document.querySelector("#calendarPrev"),
  calendarNext: document.querySelector("#calendarNext"),
  calendarLabel: document.querySelector("#calendarLabel"),
  calendarGrid: document.querySelector("#calendarGrid"),
  calendarDetailDate: document.querySelector("#calendarDetailDate"),
  calendarDetailSummary: document.querySelector("#calendarDetailSummary"),
  calendarDetailList: document.querySelector("#calendarDetailList"),
  calendarWriteDiary: document.querySelector("#calendarWriteDiary"),
  calendarWriteNote: document.querySelector("#calendarWriteNote"),
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
  writerTableFile: document.querySelector("#writerTableFile"),
  writerTableUploadButton: document.querySelector("#writerTableUploadButton"),
  writerImageCaption: document.querySelector("#writerImageCaption"),
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
  detailToolsToggle: document.querySelector("#detailToolsToggle"),
  detailEditButton: document.querySelector("#detailEditButton"),
  detailDeleteWidget: document.querySelector("#detailDeleteWidget"),
  detailDeleteButton: document.querySelector("#detailDeleteButton"),
  detailExportWidget: document.querySelector("#detailExportWidget"),
  detailExportMarkdown: document.querySelector("#detailExportMarkdown"),
  detailExportPdf: document.querySelector("#detailExportPdf"),
  detailShareWidget: document.querySelector("#detailShareWidget"),
  detailShareButton: document.querySelector("#detailShareButton"),
  detailDisableShareButton: document.querySelector("#detailDisableShareButton"),
  detailShareLinkWrap: document.querySelector("#detailShareLinkWrap"),
  detailShareLink: document.querySelector("#detailShareLink"),
  detailCopyShareButton: document.querySelector("#detailCopyShareButton"),
  detailShareStatus: document.querySelector("#detailShareStatus"),
  detailFavoriteButton: document.querySelector("#detailFavoriteButton"),
  detailFolderWidget: document.querySelector("#detailFolderWidget"),
  detailFolderInput: document.querySelector("#detailFolderInput"),
  detailFolderSaveButton: document.querySelector("#detailFolderSaveButton"),
  detailFolderFeedback: document.querySelector("#detailFolderFeedback"),
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
  logoutButton: document.querySelector("#logoutButton"),
  logoutConfirmDialog: document.querySelector("#logoutConfirmDialog"),
  logoutConfirmCancel: document.querySelector("#logoutConfirmCancel"),
  logoutConfirmAccept: document.querySelector("#logoutConfirmAccept"),
  visitorModeIndicator: document.querySelector("#visitorModeIndicator"),
  sharedNoteView: document.querySelector("#sharedNoteView"),
  sharedNoteCover: document.querySelector("#sharedNoteCover"),
  sharedNoteMeta: document.querySelector("#sharedNoteMeta"),
  sharedNoteTitle: document.querySelector("#sharedNoteTitle"),
  sharedNoteSummary: document.querySelector("#sharedNoteSummary"),
  sharedNoteTags: document.querySelector("#sharedNoteTags"),
  sharedNoteContent: document.querySelector("#sharedNoteContent"),
  sharedNoteError: document.querySelector("#sharedNoteError")
};

let knowledgeChart = null;
let graphRetryTimer = null;
let graphResizeObserver = null;
let writerDraftTimer = null;
let writerRemoteSaveTimer = null;
let writerRemoteSaveSignature = "";
let detailHeadingObserver = null;
let writerEditorMode = "visual";
let writerHistoryTimer = null;
// Images are uploaded to Notion before a note is saved. Keep the original data
// URL locally for this editor session: Notion file-upload IDs expire, so we can
// renew a pending image just before publishing.
const writerPendingImagePreviews = new Map();
const writerHistory = [];
let writerHistoryIndex = -1;
let selectedWriterImage = null;

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
  if (document.body.dataset.appView === "folders") window.location.hash = "#notesLibrary";
});

elements.folderList?.addEventListener("click", (event) => {
  const action = event.target.closest("[data-folder-action]");
  if (action) {
    event.preventDefault();
    event.stopPropagation();
    const folder = action.dataset.folder || "";
    if (action.dataset.folderAction === "add-child") promptNewSubfolder(folder);
    if (action.dataset.folderAction === "open-folder") openFolderBrowser(folder);
    if (action.dataset.folderAction === "rename") renameCustomFolder(folder);
    if (action.dataset.folderAction === "delete") deleteCustomFolder(folder);
    return;
  }
  const button = event.target.closest("[data-folder]");
  if (!button) return;
  if (document.body.dataset.appView === "folders") {
    openNotesForFolder(button.dataset.folder || "all");
    return;
  }
  state.folder = button.dataset.folder || "all";
  elements.folderHub?.classList.remove("is-open");
  elements.folderPickerButton?.setAttribute("aria-expanded", "false");
  if (elements.folderFilter) elements.folderFilter.value = state.folder;
  resetNoteList();
  render();
  if (document.body.dataset.appView === "folders") window.location.hash = "#notesLibrary";
});

elements.folderBreadcrumb?.addEventListener("click", (event) => {
  if (!event.target.closest("[data-folder-back]")) return;
  folderBrowserPath = parentFolderOf(folderBrowserPath);
  renderOrganization();
});

elements.folderBackButton?.addEventListener("click", () => {
  folderBrowserPath = parentFolderOf(folderBrowserPath);
  renderOrganization();
});

elements.folderRootButton?.addEventListener("click", () => {
  folderBrowserPath = "";
  state.folder = "all";
  renderOrganization();
});

elements.folderOpenNotesButton?.addEventListener("click", () => {
  openNotesForFolder(folderBrowserPath || "all");
});

document.querySelectorAll("[data-folder-favorites]").forEach((node) => {
  node.addEventListener("click", () => {
    state.favoritesOnly = true;
    resetNoteList();
    render();
    window.location.hash = "#notesLibrary";
  });
});

elements.folderContent?.addEventListener("click", (event) => {
  const action = event.target.closest("[data-folder-action]");
  if (action) {
    event.preventDefault();
    event.stopPropagation();
    const folder = action.dataset.folder || "";
    if (action.dataset.folderAction === "add-child") promptNewSubfolder(folder);
    if (action.dataset.folderAction === "rename") renameCustomFolder(folder);
    if (action.dataset.folderAction === "delete") deleteCustomFolder(folder);
    return;
  }
  const tile = event.target.closest("[data-folder-tile]");
  if (!tile) return;
  openNotesForFolder(tile.dataset.folderTile || "all");
});

elements.newFolderButton?.addEventListener("click", promptNewFolder);
elements.folderPickerButton?.addEventListener("click", () => {
  const open = elements.folderHub?.classList.toggle("is-open");
  elements.folderPickerButton?.setAttribute("aria-expanded", String(Boolean(open)));
});
document.addEventListener("click", (event) => {
  if (!elements.folderHub?.contains(event.target)) {
    elements.folderHub?.classList.remove("is-open");
    elements.folderPickerButton?.setAttribute("aria-expanded", "false");
  }
});

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
elements.sidebarWriteButton?.addEventListener("click", () => openWriter("笔记"));
elements.sidebarDiaryButton?.addEventListener("click", () => openWriter("日记"));
elements.sidebarRefreshButton?.addEventListener("click", () => window.location.reload());
elements.calendarPrev?.addEventListener("click", () => changeCalendarMonth(-1));
elements.calendarNext?.addEventListener("click", () => changeCalendarMonth(1));
elements.calendarWriteDiary?.addEventListener("click", () => openWriter("日记"));
elements.calendarWriteNote?.addEventListener("click", () => openWriter("笔记"));
elements.quickWriteButton?.addEventListener("click", () => openWriter("灵感"));
elements.dailyWriteButton?.addEventListener("click", () => openWriter("日记"));
elements.randomNoteButton?.addEventListener("click", openRandomNote);
elements.focusWriteButton?.addEventListener("click", () => openWriter("笔记"));
elements.focusRandomButton?.addEventListener("click", openRandomNote);
elements.focusMapButton?.addEventListener("click", scrollToKnowledgeMap);
elements.graphResetButton?.addEventListener("click", resetGraphFilters);
elements.graphRetryButton?.addEventListener("click", () => {
  if (elements.graphHint) elements.graphHint.textContent = "正在重新整理知识地图...";
  renderKnowledgeGraph(state.notes, 0, true);
});
elements.graphFullscreenButton?.addEventListener("click", toggleKnowledgeGraphFullscreen);
elements.globalSearch?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  state.query = event.currentTarget.value.trim();
  if (elements.searchInput) elements.searchInput.value = state.query;
  resetNoteList();
  render();
  window.location.hash = "#notesLibrary";
});
elements.aiAssistantButton?.addEventListener("click", toggleAiAssistant);
elements.aiAssistantClose?.addEventListener("click", () => setAiAssistantOpen(false));
elements.aiAssistantOrganize?.addEventListener("click", organizeWithLocalAssistant);
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
elements.writerVisualEditor?.addEventListener("click", handleVisualEditorClick);
elements.writerVisualEditor?.addEventListener("keydown", handleVisualEditorKeydown);
document.addEventListener("keydown", handleSelectedWriterImageShortcut, true);
document.addEventListener("keydown", handleGlobalWriterUndo, true);
elements.editorModeSwitch?.addEventListener("click", handleEditorModeSwitch);
elements.writerFormatToolbar?.addEventListener("pointerdown", (event) => event.preventDefault());
elements.writerFormatToolbar?.addEventListener("click", handleFormatToolbarClick);
elements.writerCover?.addEventListener("paste", handleCoverPaste);
elements.writerCoverUploadButton?.addEventListener("click", () => elements.writerCoverFile?.click());
elements.writerContentUploadButton?.addEventListener("click", () => elements.writerContentFile?.click());
elements.writerTableUploadButton?.addEventListener("click", () => elements.writerTableFile?.click());
elements.writerCoverFile?.addEventListener("change", handleCoverFileSelect);
elements.writerContentFile?.addEventListener("change", handleContentFileSelect);
elements.writerTableFile?.addEventListener("change", handleTableFileSelect);
elements.logoutButton?.addEventListener("click", openLogoutConfirm);
elements.logoutConfirmCancel?.addEventListener("click", closeLogoutConfirm);
elements.logoutConfirmAccept?.addEventListener("click", confirmLogout);
document.querySelectorAll("[data-close-logout-confirm]").forEach((node) => {
  node.addEventListener("click", closeLogoutConfirm);
});
elements.detailEditButton?.addEventListener("click", () => {
  if (!state.currentDetailNote) return;
  const note = state.currentDetailNote;
  closeDetail();
  openEditor(note);
});
elements.detailDeleteButton?.addEventListener("click", deleteCurrentDetailNote);
elements.detailToolsToggle?.addEventListener("click", () => {
  const willOpen = !elements.detailCard?.classList.contains("is-tools-open");
  setDetailToolsOpen(willOpen);
});
elements.detailFavoriteButton?.addEventListener("click", () => {
  if (state.currentDetailNote) toggleFavorite(state.currentDetailNote);
});
elements.detailFolderSaveButton?.addEventListener("click", moveCurrentDetailToFolder);
elements.detailExportMarkdown?.addEventListener("click", exportCurrentNoteMarkdown);
elements.detailExportPdf?.addEventListener("click", exportCurrentNotePdf);
elements.detailShareButton?.addEventListener("click", createCurrentNoteShare);
elements.detailDisableShareButton?.addEventListener("click", disableCurrentNoteShare);
elements.detailCopyShareButton?.addEventListener("click", copyCurrentShareLink);

document.querySelectorAll("[data-close-detail]").forEach((node) => {
  node.addEventListener("click", closeDetail);
});

document.querySelectorAll("[data-close-writer]").forEach((node) => {
  node.addEventListener("click", closeWriter);
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.globalSearch?.focus();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s"
    && elements.writerPanel?.getAttribute("aria-hidden") === "false") {
    event.preventDefault();
    const submitButton = elements.writerForm?.querySelector('button[type="submit"]');
    if (!submitButton?.disabled) elements.writerForm?.requestSubmit();
    return;
  }
  if (event.key === "Escape") {
    closeLogoutConfirm();
    closeKnowledgeGraphFullscreen();
    closeDetail();
    closeWriter();
    setAiAssistantOpen(false);
  }
});

mountFolderHub();
syncPageViewFromHash();

bootSite();
setupKnowledgeGraphObserver();

window.addEventListener("resize", () => {
  scheduleKnowledgeGraphResize();
});

function bootSite() {
  // A remembered login must always take precedence over a visitor link. This
  // also repairs a page restored from the browser back/forward cache where the
  // old visitor badge is still present in the DOM.
  exitVisitorModeForOwner();
  if (!isVisitorMode) {
    document.body.classList.remove("is-visitor-mode");
    elements.visitorModeIndicator?.setAttribute("hidden", "");
  }
  updateCurrentUserLabel();
  if (openSharedNoteFromLocation()) return;
  if (isVisitorMode) {
    activateVisitorMode();
    loadNotes();
    return;
  }
  if (authToken) {
    hideSiteLock();
    loadNotes();
    return;
  }

  showSiteLock();
  hydrateFilters();
  render();
}

function openLogoutConfirm() {
  if (!authToken && !currentUser) return;
  elements.logoutConfirmDialog?.removeAttribute("hidden");
  window.setTimeout(() => elements.logoutConfirmCancel?.focus(), 0);
}

function closeLogoutConfirm() {
  if (!elements.logoutConfirmDialog || elements.logoutConfirmDialog.hidden) return;
  elements.logoutConfirmDialog?.setAttribute("hidden", "");
  elements.logoutButton?.focus();
}

function confirmLogout() {
  elements.logoutConfirmDialog?.setAttribute("hidden", "");
  clearAuth("已退出登录，请重新输入用户名和密码。");
}

function activateVisitorMode() {
  document.body.classList.add("is-visitor-mode");
  elements.visitorModeIndicator?.removeAttribute("hidden");
  state.scope = "all";
  state.visibility = "public";
  state.favoritesOnly = false;
  if (window.location.hash !== "#notesLibrary") {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}#notesLibrary`);
  }
  syncPageViewFromHash();
}

function exitVisitorModeForOwner() {
  const hasOwnerSession = Boolean(
    authToken || currentUser?.id || currentUser?.username || currentUser?.name
  );
  if (!hasOwnerSession) return false;

  const visitorBadgeShown = Boolean(
    elements.visitorModeIndicator && !elements.visitorModeIndicator.hasAttribute("hidden")
  );
  const needsVisitorCleanup = isVisitorMode
    || visitorBadgeShown
    || document.body.classList.contains("is-visitor-mode");

  isVisitorMode = false;
  document.body.classList.remove("is-visitor-mode");
  elements.visitorModeIndicator?.setAttribute("hidden", "");
  if (!needsVisitorCleanup) return false;

  state.scope = currentUser?.id || currentUser?.username ? "mine" : "all";
  state.visibility = "all";
  state.favoritesOnly = false;

  const url = new URL(window.location.href);
  url.searchParams.delete("mode");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  syncPageViewFromHash();
  return true;
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
    exitVisitorModeForOwner();
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
  // User data can also be refreshed by /api/notes outside the login form.
  // Keep the visitor presentation in sync for that path as well.
  exitVisitorModeForOwner();
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

function openWriter(preferredType = "笔记", diaryDate = "") {
  state.editingNote = null;
  elements.writerForm?.reset();
  setWriterMarkdown("");
  if (elements.writerNoteId) elements.writerNoteId.value = "";
  if (elements.writerTitle) elements.writerTitle.textContent = "写一篇新笔记";
  if (elements.writerModeLabel) elements.writerModeLabel.textContent = "新建笔记";
  if (elements.writerSubmitButton) elements.writerSubmitButton.textContent = "发布到 Notion";
  elements.writerPanel?.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-writing");
  const nextType = NOTE_TYPES.includes(preferredType) ? preferredType : "笔记";
  if (elements.writerTypeSelect) elements.writerTypeSelect.value = nextType;
  updateWriterPrivacyDefault();
  const restored = restoreWriterDraft();
  if (!restored && nextType === "日记") {
    applyDiaryDefaults({ forceTemplate: true });
    if (diaryDate && elements.writerNoteTitle) {
      elements.writerNoteTitle.value = `${formatDate(new Date(`${diaryDate}T12:00:00`))} 日记`;
    }
  }
  syncVisualFromMarkdown();
  renderWriterPreview();
  resetWriterHistory();
  if (elements.writerToken) {
    elements.writerToken.value = localStorage.getItem("kgAdminToken") || "";
  }
  if (elements.writerStatus) elements.writerStatus.textContent = "";
  document.body.style.overflow = "hidden";
}

function openEditor(note) {
  state.editingNote = note;
  elements.writerPanel?.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-writing");
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
  resetWriterHistory();
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
  document.body.classList.remove("is-writing");
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
  const tableRows = clipboardTableRows(event);
  if (tableRows) {
    event.preventDefault();
    insertVisualHtml(tableEditorHtml(tableRows));
    setWriterStatus(`已粘贴 ${tableRows.length} 行 × ${tableRows[0].length} 列表格。`);
    return;
  }
  const caption = elements.writerImageCaption?.value.trim() || "";
  const data = await uploadPastedImage(event, caption);
  if (!data) return;
  if (elements.writerImageCaption) elements.writerImageCaption.value = "";
  insertWriterImageMarkdown(data.markdown);
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
  setSelectedWriterImage(null);
  const blocks = markdownToPreviewBlocks(elements.writerContent?.value || "");
  elements.writerVisualEditor.innerHTML = blocks.map(blockToEditorHtml).join("") || "<p><br></p>";
}

function normalizeImageCaption(value) {
  const caption = String(value || "").trim();
  return ["粘贴图片", "正文图片", "笔记图片", "图片"].includes(caption) ? "" : caption;
}

function blockToEditorHtml(block) {
  const content = richTextToEditorHtml(block.richText, block.text || "");
  if (block.type === "spreadsheet") return spreadsheetEditorHtml(block);
  if (block.type === "image") {
    const caption = escapeHtml(normalizeImageCaption(block.caption));
    const source = String(block.url || "");
    const previewUrl = getWriterPendingImagePreview(source);
    if (source.startsWith("notion-upload:") && previewUrl) {
      return `<figure class="writer-pending-image" contenteditable="false" data-image-source="${escapeHtml(source)}" data-image-caption="${caption}"><img src="${escapeHtml(previewUrl)}" alt="${caption}">${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
    }
    if (source.startsWith("notion-upload:")) {
      return `<p data-image-source="${escapeHtml(block.url)}" data-image-caption="${caption}">图片已插入，保存后即可显示。</p>`;
    }
    return `<figure contenteditable="false" data-image-caption="${caption}"><img src="${escapeHtml(block.url || "")}" alt="${caption}">${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
  }
  const headingLevel = headingLevelForType(block.type);
  if (headingLevel) return `<h${headingLevel}>${content}</h${headingLevel}>`;
  if (block.type === "quote" || block.type === "callout") return `<blockquote>${content}</blockquote>`;
  if (block.type === "bulleted_list_item") return `<ul><li>${content}</li></ul>`;
  if (block.type === "numbered_list_item") return `<ol><li>${content}</li></ol>`;
  if (block.type === "to_do") return `<p data-todo="true">☐ ${content}</p>`;
  if (block.type === "code") return `<pre><code>${escapeHtml(block.text || "")}</code></pre>`;
  if (block.type === "divider") return "<hr>";
  if (block.type === "table") return tableEditorHtml(block.rows);
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
    if (node.dataset.spreadsheetUrl) return [spreadsheetMarker(node.dataset.spreadsheetName || "table.xlsx", node.dataset.spreadsheetUrl)];
    if (/^h[1-6]$/.test(tag)) return [`${"#".repeat(Number(tag.slice(1)))} ${readInline(node)}`];
    if (tag === "blockquote") return readInline(node).split("\n").map((line) => `> ${line}`);
    if (tag === "ul") return Array.from(node.children).map((item) => `- ${readInline(item)}`);
    if (tag === "ol") return Array.from(node.children).map((item, index) => `${index + 1}. ${readInline(item)}`);
    if (tag === "pre") return [`\`\`\`\n${node.textContent || ""}\n\`\`\``];
    if (tag === "hr") return ["---"];
    if (tag === "table") {
      const rows = Array.from(node.querySelectorAll("tr"))
        .map((row) => Array.from(row.querySelectorAll("th, td")).map((cell) => readInline(cell)))
        .filter((row) => row.length >= 2);
      return rows.length >= 2 ? [tableRowsToMarkdown(normalizeTableRows(rows))] : [];
    }
    if (tag === "figure") {
      const image = node.querySelector("img");
      const caption = node.dataset.imageCaption ?? node.querySelector("figcaption")?.textContent?.trim() ?? image?.alt ?? "";
      const source = node.dataset.imageSource;
      if (source) return [`![${caption}](${source})`];
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
  const tableRows = clipboardTableRows(event);
  if (tableRows) {
    event.preventDefault();
    insertAtCursor(elements.writerContent, `\n\n${tableRowsToMarkdown(tableRows)}\n\n`);
    setWriterStatus(`已粘贴 ${tableRows.length} 行 × ${tableRows[0].length} 列表格。`);
    return;
  }
  const caption = elements.writerImageCaption?.value.trim() || "";
  const data = await uploadPastedImage(event, caption);
  if (!data) return;
  if (elements.writerImageCaption) elements.writerImageCaption.value = "";
  insertWriterImageMarkdown(data.markdown);
  setWriterStatus("图片已上传到 Notion，并插入正文。");
}

function clipboardTableRows(event) {
  const clipboard = event.clipboardData;
  if (!clipboard) return null;
  const html = clipboard.getData("text/html");
  if (html) {
    const table = new DOMParser().parseFromString(html, "text/html").querySelector("table");
    const rows = Array.from(table?.querySelectorAll("tr") || [])
      .map((row) => Array.from(row.querySelectorAll("th, td")).map((cell) => String(cell.innerText || cell.textContent || "").replace(/\s+/g, " ").trim()))
      .filter((row) => row.length);
    if (rows.length >= 2 && rows[0].length >= 2) return normalizeTableRows(rows);
  }

  const text = clipboard.getData("text/plain");
  const rows = String(text || "").split(/\r?\n/).filter(Boolean).map((line) => line.split("\t").map((cell) => cell.trim()));
  return rows.length >= 2 && rows[0].length >= 2 ? normalizeTableRows(rows) : null;
}

function normalizeTableRows(rows) {
  const width = Math.max(2, Math.max(...rows.map((row) => row.length)));
  return rows.map((row) => Array.from({ length: width }, (_, index) => row[index] || ""));
}

function insertWriterImageMarkdown(markdown) {
  const content = elements.writerContent;
  if (!content || !markdown) return;

  // Always create a distinct before/after checkpoint for an image. Uploading is
  // asynchronous and changes the editor DOM, so relying on browser undo alone
  // is unreliable here.
  recordWriterHistory();
  if (writerEditorMode === "visual") {
    setWriterMarkdown(`${content.value || ""}\n${markdown}\n`);
  } else {
    const start = content.selectionStart ?? content.value.length;
    const end = content.selectionEnd ?? content.value.length;
    const next = `\n${markdown}\n`;
    content.value = `${content.value.slice(0, start)}${next}${content.value.slice(end)}`;
    content.setSelectionRange(start + next.length, start + next.length);
  }
  recordWriterHistory();
  emitWriterChanged();
}

function handleFormatToolbarClick(event) {
  const button = event.target.closest("[data-format]");
  if (!button || !elements.writerContent) return;
  const format = button.dataset.format || "";
  applyWriterFormat(format, button.dataset.color || "");
}

function handleWriterContentKeydown(event) {
  if (event.defaultPrevented) return;
  const isShortcut = event.ctrlKey || event.metaKey;
  if (!isShortcut) return;

  const key = event.key.toLowerCase();
  if (key === "z") {
    event.preventDefault();
    if (event.shiftKey) redoWriterHistory();
    else undoWriterHistory();
    return;
  }

  if (key === "y") {
    event.preventDefault();
    redoWriterHistory();
    return;
  }

  if (key === "b") {
    event.preventDefault();
    applyWriterFormat("bold");
    return;
  }

  if (event.altKey && ["1", "2", "3"].includes(event.key)) {
    event.preventDefault();
    applyWriterFormat(`h${event.key}`);
  }
}

function handleVisualEditorKeydown(event) {
  if (["Backspace", "Delete"].includes(event.key) && removeSelectedWriterImage(event)) return;
  if (event.key === "Enter" && !event.shiftKey && insertVisualEditorParagraphAfterImage(event)) return;
  handleWriterContentKeydown(event);
}

function handleSelectedWriterImageShortcut(event) {
  const editor = elements.writerVisualEditor;
  if (elements.writerPanel?.getAttribute("aria-hidden") !== "false"
    || !editor
    || !selectedWriterImage
    || !editor.contains(selectedWriterImage)) return;

  const handled = ["Backspace", "Delete"].includes(event.key)
    ? removeSelectedWriterImage(event)
    : event.key === "Enter" && !event.shiftKey
      ? insertVisualEditorParagraphAfterImage(event)
      : false;
  if (handled) event.stopPropagation();
}

function handleVisualEditorClick(event) {
  const editor = elements.writerVisualEditor;
  const imageBlock = event.target.closest("figure");
  if (!editor || !imageBlock || !editor.contains(imageBlock)) {
    setSelectedWriterImage(null);
    return;
  }

  event.preventDefault();
  setSelectedWriterImage(imageBlock);
  editor.focus();
  const selection = window.getSelection();
  selection?.removeAllRanges();
}

function setSelectedWriterImage(imageBlock) {
  selectedWriterImage?.classList.remove("is-selected");
  selectedWriterImage = imageBlock || null;
  selectedWriterImage?.classList.add("is-selected");
}

function removeSelectedWriterImage(event) {
  const editor = elements.writerVisualEditor;
  if (!editor) return false;

  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const imageBlock = selectedWriterImage && editor.contains(selectedWriterImage)
    ? selectedWriterImage
    : range && Array.from(editor.querySelectorAll("figure")).find((figure) => range.intersectsNode(figure));
  if (!imageBlock) return false;

  event.preventDefault();
  const nextBlock = imageBlock.nextElementSibling;
  const previousBlock = imageBlock.previousElementSibling;
  imageBlock.remove();
  setSelectedWriterImage(null);

  let caretBlock = nextBlock?.nodeName?.toLowerCase() === "figure" ? null : nextBlock;
  let collapseAtEnd = false;
  if (!caretBlock && previousBlock?.nodeName?.toLowerCase() !== "figure") {
    caretBlock = previousBlock;
    collapseAtEnd = true;
  }
  if (!caretBlock) {
    caretBlock = document.createElement("p");
    caretBlock.append(document.createElement("br"));
    if (nextBlock) nextBlock.before(caretBlock);
    else editor.append(caretBlock);
  }

  const caretRange = document.createRange();
  caretRange.selectNodeContents(caretBlock);
  caretRange.collapse(!collapseAtEnd);
  selection?.removeAllRanges();
  selection?.addRange(caretRange);
  syncMarkdownFromVisual();
  emitWriterChanged();
  return true;
}

function insertVisualEditorParagraphAfterImage(event) {
  const editor = elements.writerVisualEditor;
  const selection = window.getSelection();
  if (!editor || !selection) return false;

  const clickedImage = selectedWriterImage && editor.contains(selectedWriterImage)
    ? selectedWriterImage
    : null;
  if (clickedImage) return insertParagraphAfterWriterImage(event, clickedImage);
  if (selection.rangeCount !== 1) return false;

  const anchor = selection.anchorNode;
  const anchorElement = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
  const range = selection.getRangeAt(0);
  const adjacentBlocks = anchor === editor
    ? [editor.children[selection.anchorOffset - 1], editor.children[selection.anchorOffset]]
    : [];
  const imageBlock = [
    anchorElement?.closest("figure"),
    ...adjacentBlocks,
    ...Array.from(editor.querySelectorAll("figure")).filter((figure) => range.intersectsNode(figure))
  ].find((node) => node?.nodeName?.toLowerCase() === "figure");
  if (!imageBlock || !editor.contains(imageBlock)) return false;

  return insertParagraphAfterWriterImage(event, imageBlock);
}

function insertParagraphAfterWriterImage(event, imageBlock) {
  const selection = window.getSelection();
  event.preventDefault();
  const paragraph = document.createElement("p");
  paragraph.append(document.createElement("br"));
  imageBlock.after(paragraph);

  const caretRange = document.createRange();
  caretRange.selectNodeContents(paragraph);
  caretRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(caretRange);
  setSelectedWriterImage(null);
  syncMarkdownFromVisual();
  emitWriterChanged();
  return true;
}

function handleGlobalWriterUndo(event) {
  if (elements.writerPanel?.getAttribute("aria-hidden") !== "false") return;
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key !== "z" && key !== "y") return;

  const target = event.target;
  const isAnotherFormField = (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)
    && target !== elements.writerContent;
  if (isAnotherFormField) return;

  event.preventDefault();
  event.stopPropagation();
  if (key === "z" && !event.shiftKey) undoWriterHistory();
  else redoWriterHistory();
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
  } else if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(format)) {
    prefixSelectedLines(textarea, `${"#".repeat(Number(format.slice(1)))} `, /^(#{1,6}\s*)/);
  } else if (format === "color" && color) {
    wrapSelection(textarea, `{${color}:`, "}", "彩色文字");
  } else if (format === "date") {
    insertAtCursor(textarea, formatTodayLine());
  } else if (format === "table") {
    insertAtCursor(textarea, tableMarkdownTemplate());
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
  else if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(format)) document.execCommand("formatBlock", false, format);
  else if (format === "color" && color) {
    const colors = { gray: "#8e8e93", brown: "#8a5a44", orange: "#ff9500", yellow: "#ffcc00", green: "#34c759", blue: "#007aff", purple: "#af52de", pink: "#ff2d55", red: "#ff3b30" };
    document.execCommand("foreColor", false, colors[color] || "#1f2937");
  } else if (format === "date") document.execCommand("insertText", false, formatTodayLine().trim());
  else if (format === "table") insertVisualHtml(tableEditorHtml());
  else if (format === "divider") insertVisualHtml("<hr><p><br></p>");
  else if (format === "diary-template") {
    setWriterMarkdown((elements.writerContent?.value || "").trim() ? `${elements.writerContent.value}\n\n${diaryTemplate()}` : diaryTemplate());
  }
  syncMarkdownFromVisual();
  emitWriterChanged();
}

function selectedTableSize() {
  const rows = Math.min(8, Math.max(2, Number(document.querySelector("#writerTableRows")?.value || 3)));
  const columns = Math.min(8, Math.max(2, Number(document.querySelector("#writerTableCols")?.value || 3)));
  return { rows, columns };
}

function tableMarkdownTemplate() {
  const { rows, columns } = selectedTableSize();
  const header = Array.from({ length: columns }, (_, index) => `列 ${index + 1}`);
  const body = Array.from({ length: rows - 1 }, (_, rowIndex) => header.map((_, columnIndex) => `内容 ${rowIndex + 1}-${columnIndex + 1}`));
  return `\n\n${tableRowsToMarkdown([header, ...body])}\n\n`;
}

function tableEditorHtml(rows = null) {
  const { rows: rowCount, columns } = selectedTableSize();
  const cells = rows?.length ? rows : [
    Array.from({ length: columns }, (_, index) => `列 ${index + 1}`),
    ...Array.from({ length: rowCount - 1 }, (_, rowIndex) => Array.from({ length: columns }, (_, columnIndex) => `内容 ${rowIndex + 1}-${columnIndex + 1}`))
  ];
  const [header = [], ...body] = cells;
  const toCells = (row, tag) => row.map((value) => `<${tag}>${escapeHtml(value)}</${tag}>`).join("");
  return `<table class="writer-table"><thead><tr>${toCells(header, "th")}</tr></thead><tbody>${body.map((row) => `<tr>${toCells(row, "td")}</tr>`).join("")}</tbody></table><p><br></p>`;
}

function tableRowsToMarkdown(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return "";
  const cleanCell = (value) => String(value || "").replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
  const line = (row) => `| ${row.map(cleanCell).join(" | ")} |`;
  const width = rows[0].length;
  return [line(rows[0]), `| ${Array.from({ length: width }, () => "---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n");
}

function splitImportedTableRows(rows, maxBodyRows = 80) {
  const [header, ...body] = rows;
  if (!header || !body.length) return [];
  const chunks = [];
  for (let index = 0; index < body.length; index += maxBodyRows) chunks.push([header, ...body.slice(index, index + maxBodyRows)]);
  return chunks;
}

function importedTableMarkdown(rows) {
  return splitImportedTableRows(rows)
    .map((chunk, index) => `${index ? `> 表格续表（第 ${index + 1} 部分）\n\n` : ""}${tableRowsToMarkdown(chunk)}`)
    .join("\n\n");
}

function importedTableEditorHtml(rows) {
  return splitImportedTableRows(rows).map((chunk) => tableEditorHtml(chunk)).join("");
}

function spreadsheetMarker(filename, url) {
  return `{{excel-preview|${encodeURIComponent(String(filename || "table.xlsx"))}|${url}}}`;
}

function parseSpreadsheetMarker(value) {
  const match = String(value || "").trim().match(/^\{\{excel-preview\|([^|]*)\|(https?:\/\/[^}]+)\}\}$/i);
  return match ? { type: "spreadsheet", filename: decodeURIComponent(match[1] || "table.xlsx"), url: match[2] } : null;
}

function spreadsheetEditorHtml(block) {
  const filename = escapeHtml(block?.filename || "Excel 表格");
  const url = escapeHtml(block?.url || "");
  return `<figure class="writer-spreadsheet-placeholder" contenteditable="false" data-spreadsheet-url="${url}" data-spreadsheet-name="${filename}"><strong>▦ Excel 表格预览</strong><span>${filename}</span><small>已保留原始文件，保存后可在笔记内直接查看。</small></figure><p><br></p>`;
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

function handleWriterFormInput(event) {
  renderWriterPreview();
  scheduleWriterDraftSave();
  scheduleWriterRemoteAutoSave();
  const activeEditor = writerEditorMode === "visual" ? elements.writerVisualEditor : elements.writerContent;
  if (event?.target === activeEditor) scheduleWriterHistory();
}

function emitWriterChanged() {
  renderWriterPreview();
  scheduleWriterDraftSave();
  scheduleWriterRemoteAutoSave();
  scheduleWriterHistory();
}

function resetWriterHistory() {
  window.clearTimeout(writerHistoryTimer);
  writerHistory.length = 0;
  writerHistoryIndex = -1;
  recordWriterHistory();
}

function scheduleWriterHistory() {
  window.clearTimeout(writerHistoryTimer);
  writerHistoryTimer = window.setTimeout(recordWriterHistory, 320);
}

function recordWriterHistory() {
  window.clearTimeout(writerHistoryTimer);
  const content = String(elements.writerContent?.value || "");
  if (writerHistory[writerHistoryIndex] === content) return;
  writerHistory.splice(writerHistoryIndex + 1);
  writerHistory.push(content);
  if (writerHistory.length > 80) writerHistory.shift();
  writerHistoryIndex = writerHistory.length - 1;
}

function undoWriterHistory() {
  recordWriterHistory();
  if (writerHistoryIndex <= 0) return;
  writerHistoryIndex -= 1;
  restoreWriterHistory(writerHistory[writerHistoryIndex]);
}

function redoWriterHistory() {
  recordWriterHistory();
  if (writerHistoryIndex >= writerHistory.length - 1) return;
  writerHistoryIndex += 1;
  restoreWriterHistory(writerHistory[writerHistoryIndex]);
}

function restoreWriterHistory(content) {
  setWriterMarkdown(content);
  renderWriterPreview();
  scheduleWriterDraftSave();
  const editor = writerEditorMode === "visual" ? elements.writerVisualEditor : elements.writerContent;
  editor?.focus();
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

function scheduleWriterRemoteAutoSave() {
  window.clearTimeout(writerRemoteSaveTimer);
  if (elements.writerPanel?.getAttribute("aria-hidden") !== "false") return;
  if (!elements.writerNoteId?.value.trim()) return;

  writerRemoteSaveSignature = writerAutoSaveSignature();
  writerRemoteSaveTimer = window.setTimeout(saveWriterAutomatically, 1500);
}

function writerAutoSaveSignature() {
  const { savedAt, ...draft } = collectWriterDraft();
  return JSON.stringify(draft);
}

function saveWriterAutomatically() {
  const form = elements.writerForm;
  const submitButton = form?.querySelector('button[type="submit"]');
  if (!form || elements.writerPanel?.getAttribute("aria-hidden") !== "false" || !elements.writerNoteId?.value.trim()) return;
  if (!elements.writerNoteTitle?.value.trim()) return;
  if (submitButton?.disabled) {
    writerRemoteSaveTimer = window.setTimeout(saveWriterAutomatically, 500);
    return;
  }

  updateWriterDraftStatus("正在自动保存到 Notion...");
  form.requestSubmit();
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
  window.clearTimeout(writerRemoteSaveTimer);
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

  const caption = elements.writerImageCaption?.value.trim() || "";
  const data = await uploadImageFile(file, caption, "插入正文图片");
  if (!data) return;
  if (elements.writerImageCaption) elements.writerImageCaption.value = "";

  insertWriterImageMarkdown(data.markdown);
  setWriterStatus("图片已上传到 Notion，并插入正文。");
}

async function handleTableFileSelect(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    setWriterStatus("正在上传原始表格并保留版式...");
    const upload = await uploadSpreadsheetFile(file);
    const marker = spreadsheetMarker(upload.filename || file.name, upload.url);
    if (writerEditorMode === "visual") {
      insertVisualHtml(spreadsheetEditorHtml({ filename: upload.filename || file.name, url: upload.url }));
    } else {
      insertAtCursor(elements.writerContent, `\n\n${marker}\n\n`);
    }
    setWriterStatus(`已导入「${file.name}」。笔记会以 Excel 预览方式展示原始布局。`);
  } catch (error) {
    setWriterStatus(error instanceof Error ? error.message : "表格导入失败，请换一个 Excel 或 CSV 文件重试。", true);
  }
}

async function uploadSpreadsheetFile(file) {
  const filename = String(file.name || "").toLowerCase();
  if (!/\.(xlsx|xls|csv)$/i.test(filename)) throw new Error("请选择 .xlsx、.xls 或 .csv 表格文件。");
  if (file.size > 15 * 1024 * 1024) throw new Error("表格文件不能超过 15MB。");
  const adminToken = elements.writerToken?.value.trim() || localStorage.getItem("kgAdminToken") || "";
  if (!authToken && !adminToken) throw new Error("请先登录，再导入表格。");
  const response = await fetch(`${apiBase}/api/admin/spreadsheets`, {
    method: "POST",
    headers: siteHeaders({
      "Content-Type": "application/json",
      ...(authToken ? {} : { Authorization: `Bearer ${adminToken}` })
    }),
    body: JSON.stringify({ filename: file.name || "table.xlsx", mimeType: file.type, dataUrl: await readFileAsDataUrl(file) })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new Error(data.error || "表格上传失败，请稍后重试。");
  if (adminToken && !authToken) localStorage.setItem("kgAdminToken", adminToken);
  return data;
}

let spreadsheetLibraryPromise;
function loadSpreadsheetLibrary() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (spreadsheetLibraryPromise) return spreadsheetLibraryPromise;
  spreadsheetLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error("表格解析组件加载失败，请刷新后重试。"));
    script.onerror = () => reject(new Error("Excel 解析组件加载失败，请检查网络后重试，或先另存为 CSV 再导入。"));
    document.head.append(script);
  });
  return spreadsheetLibraryPromise;
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
    const data = await uploadImageDataUrl(dataUrl, uploadFile.name || "notion-image.jpg", altText, adminToken);

    if (adminToken && !authToken) localStorage.setItem("kgAdminToken", adminToken);
    rememberWriterImagePreview(data?.markdown, dataUrl, uploadFile.name || "notion-image.jpg");
    return data;
  } catch (error) {
    const message = error instanceof TypeError
      ? "图片上传连接失败：可能是图片过大、网络中断或服务器上传限制。请刷新后重试，或换一张更小的图片。"
      : error instanceof Error ? error.message : "图片上传失败";
    setWriterStatus(message, true);
    return null;
  }
}

async function uploadImageDataUrl(dataUrl, filename, altText, adminToken) {
  const response = await fetch(`${apiBase}/api/admin/uploads`, {
    method: "POST",
    headers: siteHeaders({
      "Content-Type": "application/json",
      ...(authToken ? {} : { Authorization: `Bearer ${adminToken}` })
    }),
    body: JSON.stringify({ filename, dataUrl, alt: altText })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "图片上传失败");
  return data;
}

function rememberWriterImagePreview(markdown, previewUrl, filename = "notion-image.jpg") {
  const match = String(markdown || "").match(/^!\[[^\]]*\]\((notion-upload:[^)]+)\)$/m);
  if (match?.[1] && previewUrl) {
    writerPendingImagePreviews.set(match[1], { previewUrl, dataUrl: previewUrl, filename });
  }
}

function getWriterPendingImagePreview(source) {
  const pending = writerPendingImagePreviews.get(String(source || ""));
  return typeof pending === "string" ? pending : pending?.previewUrl || "";
}

async function refreshPendingWriterImages(payload, adminToken) {
  let skippedExpiredImages = 0;
  const renewReference = async (source, altText) => {
    const pending = writerPendingImagePreviews.get(source);
    const dataUrl = typeof pending === "string" ? pending : pending?.dataUrl;
    if (!dataUrl) return "";

    setWriterStatus("正在确认图片上传状态...");
    const filename = typeof pending === "string" ? "notion-image.jpg" : pending.filename || "notion-image.jpg";
    const data = await uploadImageDataUrl(dataUrl, filename, altText, adminToken);
    const nextSource = `notion-upload:${data.fileUploadId}`;
    rememberWriterImagePreview(data.markdown, dataUrl, filename);
    return nextSource;
  };

  const references = [...String(payload.content || "").matchAll(/!\[([^\]]*)\]\((notion-upload:[a-f0-9-]+)\)/gi)];
  for (const [raw, caption, source] of references) {
    const nextSource = await renewReference(source, caption);
    if (!nextSource) {
      const note = `> 图片${caption ? `（${caption}）` : ""}的临时上传已过期，请重新上传。`;
      payload.content = payload.content.replace(raw, note);
      skippedExpiredImages += 1;
    } else if (nextSource !== source) {
      payload.content = payload.content.replace(raw, `![${caption}](${nextSource})`);
    }
  }

  if (String(payload.cover || "").startsWith("notion-upload:")) {
    const nextCover = await renewReference(payload.cover, "封面图片");
    if (!nextCover) {
      payload.cover = "";
      skippedExpiredImages += 1;
    } else {
      payload.cover = nextCover;
    }
  }

  if (skippedExpiredImages) setWriterStatus(`检测到 ${skippedExpiredImages} 张过期图片，正在保存文字并跳过这些图片...`);
  return skippedExpiredImages;
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
  window.clearTimeout(writerRemoteSaveTimer);
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const adminToken = String(formData.get("token") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const noteId = String(formData.get("id") || "").trim();
  const submittedRemoteSignature = noteId ? writerAutoSaveSignature() : "";

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
    const skippedExpiredImages = await refreshPendingWriterImages(payload, adminToken);
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
    if (noteId && writerRemoteSaveSignature && writerRemoteSaveSignature !== submittedRemoteSignature) {
      scheduleWriterRemoteAutoSave();
    } else {
      writerRemoteSaveSignature = "";
    }
    const skippedNotice = skippedExpiredImages ? `；已跳过 ${skippedExpiredImages} 张过期图片，请重新上传` : "";
    setWriterStatus(noteId
      ? `已保存修改：${data.note?.title || title}${skippedNotice}`
      : `已同步：${data.note?.title || title}${payload.published ? "" : "。可在“我的笔记-私密”里查看。"}${skippedNotice}`);
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
  const notesPath = isVisitorMode ? "/api/public/notes" : "/api/notes";
  setStatus(isVisitorMode ? "正在读取公开笔记..." : "正在读取朝夕拾光...");
  elements.refreshButton.disabled = true;

  try {
    const response = await fetch(`${apiBase}${notesPath}${refresh ? "?refresh=1" : ""}`, {
      headers: isVisitorMode ? {} : siteHeaders()
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.error || "读取笔记失败");
    if (data.user) {
      currentUser = data.user;
      persistAuth(authToken, currentUser, Boolean(localStorage.getItem(authTokenLocalKey)));
      const leftVisitorMode = exitVisitorModeForOwner();
      updateCurrentUserLabel();
      // The first request may have been sent to the guest endpoint. Once the
      // owner is identified, reload through the authenticated endpoint so the
      // full private library is available immediately.
      if (leftVisitorMode) return await loadNotes({ refresh });
    }
    state.notes = normalizeNotes(data.notes);
    setStatus(`已载入 ${state.notes.length} 篇${isVisitorMode ? "公开" : "可查看"}笔记${data.cached ? "，来自缓存" : ""}`);
  } catch (error) {
    state.notes = isVisitorMode ? [] : normalizeNotes(sampleNotes);
    setStatus(isVisitorMode
      ? `暂时无法读取公开笔记。${error instanceof Error ? error.message : ""}`
      : `API 暂不可用，正在展示示例数据。${error instanceof Error ? error.message : ""}`);
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
    shareEnabled: Boolean(note.shareEnabled),
    shareExpiresAt: String(note.shareExpiresAt || ""),
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
  renderGraphInsights(notes);
  renderGrowthMap(notes);
  renderDailyPanel(notes);
  renderDiarySection(notes);
  renderCalendar(notes);
  renderFocusPanel(notes);
  renderTimeline(notes);
  renderTopicMap(notes);
  renderTagCloud(notes);
  renderRecentList(notes);
}

function renderGraphInsights(notes) {
  const today = dateKey(new Date());
  const todayNotes = notes.filter((note) => dateKey(note.created || note.updated) === today);
  const monthPrefix = today.slice(0, 7);
  const monthNotes = notes.filter((note) => dateKey(note.created || note.updated).startsWith(monthPrefix));
  const minutes = monthNotes.reduce((total, note) => total + (Number(note.studyMinutes) || 0), 0);
  const ideas = monthNotes.filter((note) => String(note.type || "").includes("灵感") || String(note.category || "").includes("灵感")).length;
  const activeTopics = Object.entries(countValues(notes.map((note) => note.category || "未分类")))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hans-CN"))
    .slice(0, 3);
  const recordDays = new Set(notes.map((note) => dateKey(note.created || note.updated)).filter(Boolean));
  let streak = 0;
  const cursor = new Date();
  while (recordDays.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  if (elements.insightReading) elements.insightReading.textContent = `${minutes || Math.max(0, monthNotes.length * 8)} 分钟`;
  if (elements.insightNewNotes) elements.insightNewNotes.textContent = `${todayNotes.length} 条`;
  if (elements.insightIdeas) elements.insightIdeas.textContent = `${ideas} 个`;
  if (elements.insightStreak) elements.insightStreak.textContent = `${streak} 天`;
  if (elements.insightActiveTopics) {
    elements.insightActiveTopics.replaceChildren(...activeTopics.map(([topic, count]) => {
      const item = document.createElement("div");
      item.innerHTML = `<span>${escapeHtml(topic)}</span><b>${count}</b>`;
      return item;
    }));
  }
  if (elements.insightTip) {
    const [first, second] = activeTopics;
    elements.insightTip.textContent = first && second
      ? `“${first[0]}”与“${second[0]}”是当前最活跃的两条知识线索。`
      : first
        ? `“${first[0]}”正在成为你的知识重心。`
        : "从第一篇笔记开始，建立属于你的知识连接。";
  }
  if (elements.insightRecentUpdates) {
    const recent = [...notes]
      .sort((left, right) => new Date(right.updated || right.created || 0) - new Date(left.updated || left.created || 0))
      .slice(0, 3);
    elements.insightRecentUpdates.replaceChildren(...recent.map((note) => {
      const item = document.createElement("div");
      item.innerHTML = `<span>${escapeHtml(note.category || "未分类")}</span><small>${escapeHtml(formatDate(note.updated || note.created) || "刚刚")}</small>`;
      return item;
    }));
  }
}

function toggleAiAssistant() {
  const open = elements.aiAssistantPanel?.getAttribute("aria-hidden") !== "false";
  setAiAssistantOpen(open);
}

function setAiAssistantOpen(open) {
  if (!elements.aiAssistantPanel) return;
  elements.aiAssistantPanel.setAttribute("aria-hidden", String(!open));
  elements.aiAssistantButton?.setAttribute("aria-expanded", String(open));
  if (open) window.setTimeout(() => elements.aiAssistantInput?.focus(), 120);
}

function organizeWithLocalAssistant() {
  const text = String(elements.aiAssistantInput?.value || "").trim();
  if (!elements.aiAssistantResult) return;
  if (!text) {
    elements.aiAssistantResult.innerHTML = `<p>先写下一段内容，我再帮你梳理方向。</p>`;
    return;
  }
  const lower = text.toLowerCase();
  const rules = [
    { match: /linux|服务器|docker|nginx|域名/, category: "服务器与域名", tags: ["Linux", "实践"] },
    { match: /代码|c\+\+|qt|javascript|python|编程/, category: "学习笔记", tags: ["编程", "学习"] },
    { match: /阅读|书|读书/, category: "书单", tags: ["阅读", "摘录"] },
    { match: /项目|产品|网站|设计/, category: "项目", tags: ["项目", "复盘"] }
  ];
  const matched = rules.find((rule) => rule.match.test(lower));
  const category = matched?.category || "常识";
  const tags = matched?.tags || ["灵感", "待整理"];
  const folders = knownFolders();
  const folder = folders.find((name) => lower.includes(String(folderLabel(name)).toLowerCase())) || folders.find((name) => name.includes(category)) || "收件箱";
  elements.aiAssistantResult.innerHTML = `
    <span>本地整理建议</span>
    <strong>${escapeHtml(category)}</strong>
    <p>建议归档至：${escapeHtml(folder)}</p>
    <div>${tags.map((tag) => `<i>${escapeHtml(tag)}</i>`).join("")}</div>`;
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
    const empty = document.createElement("section");
    empty.className = "diary-empty-state";
    empty.innerHTML = `
      <span class="diary-empty-icon" aria-hidden="true"></span>
      <h3>还没有公开的拾光日记</h3>
      <p>私密日记仍会安全保存在 Notion，公开后才会出现在这里。</p>
      <div><button type="button" data-empty-diary-write>写一篇日记</button></div>`;
    empty.querySelector("[data-empty-diary-write]")?.addEventListener("click", () => openWriter("日记"));
    elements.diaryList.append(empty);
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

function changeCalendarMonth(offset) {
  const next = new Date(state.calendarYear, state.calendarMonth + offset, 1);
  state.calendarYear = next.getFullYear();
  state.calendarMonth = next.getMonth();
  state.calendarSelectedDate = `${state.calendarYear}-${pad2(state.calendarMonth + 1)}-01`;
  renderCalendar(state.notes);
}

function renderCalendar(notes) {
  if (!elements.calendarGrid || !elements.calendarLabel) return;
  const year = state.calendarYear;
  const month = state.calendarMonth;
  const monthStart = new Date(year, month, 1);
  const today = dateKey(new Date());
  const ownNotes = authToken ? notes.filter(isMyNote) : notes;
  const byDate = new Map();

  for (const note of ownNotes) {
    const key = dateKey(note.updated || note.created);
    if (!key) continue;
    const values = byDate.get(key) || [];
    values.push(note);
    byDate.set(key, values);
  }

  elements.calendarLabel.textContent = `${year} 年 ${month + 1} 月`;
  elements.calendarGrid.innerHTML = "";
  const leadingDays = (monthStart.getDay() + 6) % 7;
  for (let index = 0; index < leadingDays; index += 1) {
    const blank = document.createElement("div");
    blank.className = "calendar-day is-empty";
    blank.setAttribute("aria-hidden", "true");
    elements.calendarGrid.append(blank);
  }

  const totalDays = daysInMonth(year, month);
  for (let day = 1; day <= totalDays; day += 1) {
    const key = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const dayNotes = byDate.get(key) || [];
    const diaries = dayNotes.filter(isDiary);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `calendar-day${key === today ? " is-today" : ""}${key === state.calendarSelectedDate ? " is-selected" : ""}${dayNotes.length ? " has-record" : ""}${diaries.length ? " has-diary" : ""}`;
    button.innerHTML = `<span class="calendar-day-number">${day}</span><span class="calendar-day-count">${dayNotes.length ? `${dayNotes.length} 条记录` : ""}</span>`;
    button.title = dayNotes.length
      ? `${key}：${dayNotes.length} 条记录${diaries.length ? `，其中 ${diaries.length} 篇日记` : ""}`
      : `${key}：写一篇日记`;
    button.addEventListener("click", () => {
      state.calendarSelectedDate = key;
      renderCalendarDetail(key, dayNotes);
      if (diaries.length === 1) openDetail(diaries[0]);
      else openWriter("日记", key);
    });
    button.addEventListener("mouseenter", () => {
      state.calendarSelectedDate = key;
      renderCalendarDetail(key, dayNotes);
    });
    button.addEventListener("focus", () => {
      state.calendarSelectedDate = key;
      renderCalendarDetail(key, dayNotes);
    });
    elements.calendarGrid.append(button);
  }
  const selectedNotes = byDate.get(state.calendarSelectedDate) || [];
  renderCalendarDetail(state.calendarSelectedDate, selectedNotes);
}

function renderCalendarDetail(key, notes) {
  if (elements.calendarDetailDate) elements.calendarDetailDate.textContent = formatDate(key) || key || "今天";
  if (elements.calendarDetailSummary) {
    elements.calendarDetailSummary.textContent = notes.length
      ? `这一天留下了 ${notes.length} 条记录。`
      : "这一天还没有留下内容。";
  }
  if (!elements.calendarDetailList) return;
  elements.calendarDetailList.innerHTML = "";
  if (!notes.length) return;
  notes.slice(0, 4).forEach((note) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<strong>${escapeHtml(note.title)}</strong><span>${escapeHtml(note.type || "笔记")}</span>`;
    button.addEventListener("click", () => openDetail(note));
    elements.calendarDetailList.append(button);
  });
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
  knowledgeChart?.dispose();
  knowledgeChart = null;
  window.clearTimeout(graphRetryTimer);

  const categoryCounts = countValues(notes.map((note) => note.category || "未分类"));
  const categories = unique(notes.map((note) => note.category || "未分类"))
    .sort((left, right) => (categoryCounts[right] || 0) - (categoryCounts[left] || 0) || left.localeCompare(right, "zh-Hans-CN"));
  const latest = notes.map((note) => note.updated || note.created).filter(Boolean).sort(compareDate).at(-1);
  const kindFor = (category) => {
    const name = String(category).toLowerCase();
    if (/项目|产品|网站/.test(name)) return "project";
    if (/codex/.test(name)) return "codex";
    if (/工具|服务器|技术|计算机/.test(name)) return "infrastructure";
    if (/学习|读书/.test(name)) return "learning";
    if (/常识|知识/.test(name)) return "general";
    return "practice";
  };
  const toneFor = (kind) => ({ general: "blue", learning: "purple", project: "green", codex: "amber", infrastructure: "orange", practice: "pink" }[kind] || "blue");
  const groups = [
    { id: "learning", title: "学习与认知", kinds: ["general", "learning"], tone: "learning" },
    { id: "technology", title: "项目与技术", kinds: ["project", "codex", "infrastructure"], tone: "technology" },
    { id: "practice", title: "工作与实践", kinds: ["practice"], tone: "practice" }
  ];

  const map = document.createElement("div");
  map.className = "knowledge-map-fixed";
  const relations = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  relations.classList.add("knowledge-map-relations");
  relations.setAttribute("aria-hidden", "true");
  map.append(relations);

  const core = document.createElement("section");
  core.className = "knowledge-map-core";
  core.innerHTML = `<img src="assets/morning-dusk-logo-v2.png" alt="" /><div><strong>朝夕拾光</strong><span>个人知识系统</span><small>${notes.length} 篇笔记 · ${categories.length} 个主题 · 更新于 ${escapeHtml(formatDate(latest) || "今日")}</small></div>`;
  map.append(core);

  for (const group of groups) {
    const groupCategories = categories.filter((category) => group.kinds.includes(kindFor(category)));
    const groupNotes = groupCategories.reduce((total, category) => total + (categoryCounts[category] || 0), 0);
    const groupLatest = notes
      .filter((note) => group.kinds.includes(kindFor(note.category || "未分类")))
      .map((note) => note.updated || note.created)
      .filter(Boolean)
      .sort(compareDate)
      .at(-1);
    const panel = document.createElement("section");
    panel.className = `knowledge-map-cluster cluster-${group.tone}`;
    panel.dataset.cluster = group.id;
    panel.innerHTML = `<header><strong>${group.title}</strong><span>${groupNotes} 篇笔记 · 最近更新 ${escapeHtml(formatDate(groupLatest || latest) || "暂无更新")}</span></header>`;
    const list = document.createElement("div");
    list.className = "knowledge-map-topic-list";
    for (const category of groupCategories) {
      const kind = kindFor(category);
      const topic = document.createElement("button");
      topic.type = "button";
      topic.className = `knowledge-map-topic topic-${toneFor(kind)}${kind === "project" || kind === "general" ? " is-primary" : ""}`;
      topic.dataset.mapKind = kind;
      topic.dataset.mapCategory = category;
      topic.innerHTML = `<i aria-hidden="true"></i><span>${escapeHtml(category)}</span><b>${categoryCounts[category] || 0}</b><small>篇笔记</small>`;
      topic.addEventListener("click", () => handleKnowledgeGraphClick({ data: { kind: "category", value: category } }));
      list.append(topic);
    }
    panel.append(list);
    map.append(panel);
  }

  elements.knowledgeGraph.replaceChildren(map);
  elements.knowledgeGraph.classList.add("has-fixed-knowledge-map");
  if (elements.graphHint) elements.graphHint.textContent = "按知识群落浏览内容，点击主题可查看全部笔记。";
  requestAnimationFrame(drawKnowledgeMapConnections);
}

function drawKnowledgeMapConnections() {
  const root = elements.knowledgeGraph;
  const map = root?.querySelector(".knowledge-map-fixed");
  const svg = map?.querySelector(".knowledge-map-relations");
  if (!map || !svg) return;
  const box = map.getBoundingClientRect();
  if (!box.width || !box.height) return;
  svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  svg.setAttribute("width", String(box.width));
  svg.setAttribute("height", String(box.height));
  svg.replaceChildren();
  const nodeFor = (kind) => map.querySelector(`[data-map-kind="${kind}"]`);
  const connect = (fromKind, toKind) => {
    const from = nodeFor(fromKind)?.getBoundingClientRect();
    const to = nodeFor(toKind)?.getBoundingClientRect();
    if (!from || !to) return;
    const x1 = from.left - box.left + from.width / 2;
    const y1 = from.top - box.top + from.height / 2;
    const x2 = to.left - box.left + to.width / 2;
    const y2 = to.top - box.top + to.height / 2;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${x1} ${y1} C ${x1 + (x2 - x1) * .38} ${y1 - 24}, ${x1 + (x2 - x1) * .70} ${y2 + 24}, ${x2} ${y2}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "rgba(100,116,139,.22)");
    path.setAttribute("stroke-width", "1.2");
    svg.append(path);
  };
  connect("learning", "codex");
  connect("project", "infrastructure");
  connect("general", "practice");
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
    else drawKnowledgeMapConnections();
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
  if (!knowledgeChart) {
    requestAnimationFrame(drawKnowledgeMapConnections);
    return;
  }
  requestAnimationFrame(() => knowledgeChart?.resize());
  setTimeout(() => knowledgeChart?.resize(), 80);
  setTimeout(() => knowledgeChart?.resize(), 220);
  setTimeout(() => knowledgeChart?.resize(), 420);
}

function buildKnowledgeGraph(notes, width = 720, height = 460) {
  const graphics = [];
  const categoryCounts = countValues(notes.map((note) => note.category || "未分类"));
  const categories = unique(notes.map((note) => note.category || "未分类"))
    .sort((left, right) => (categoryCounts[right] || 0) - (categoryCounts[left] || 0) || left.localeCompare(right, "zh-Hans-CN"))
    .slice(0, 6);
  const latest = notes.map((note) => note.updated || note.created).filter(Boolean).sort(compareDate).at(-1);
  const categoryKind = (category) => {
    const name = String(category).toLowerCase();
    if (/项目|产品|网站/.test(name)) return "project";
    if (/codex/.test(name)) return "codex";
    if (/工具|服务器|技术|计算机/.test(name)) return "infrastructure";
    if (/学习|读书/.test(name)) return "learning";
    if (/常识|知识/.test(name)) return "general";
    return "practice";
  };
  const categoryTheme = (category, index) => {
    const kind = categoryKind(category);
    const themes = {
      general: ["#5B7CFA", "#3F5ECC"],
      learning: ["#8B7CFF", "#6555CC"],
      project: ["#22C3A6", "#118A78"],
      codex: ["#D2A20A", "#A87908"],
      infrastructure: ["#F4A640", "#C87925"],
      practice: ["#EC6BAA", "#C74782"]
    };
    return themes[kind] || [["#78A7D9", "#426B9F"], ["#8F86E8", "#5C4BB8"], ["#52BFAF", "#187C77"]][index % 3];
  };
  const clusterFor = (kind) => kind === "general" || kind === "learning" ? "learning" : kind === "practice" ? "practice" : "technology";
  const clusterNotes = (clusterId) => categories.reduce((total, category) => total + (clusterFor(categoryKind(category)) === clusterId ? categoryCounts[category] || 0 : 0), 0);
  const clusterLatest = (clusterId) => notes
    .filter((note) => clusterFor(categoryKind(note.category || "未分类")) === clusterId)
    .map((note) => note.updated || note.created)
    .filter(Boolean)
    .sort(compareDate)
    .at(-1);
  const coreWidth = Math.min(286, Math.max(242, width * .32));
  const boxes = {
    learning: { x: Math.round(width * .06), y: Math.round(height * .28), width: Math.round(width * .38), height: Math.round(height * .43), title: "学习与认知", tone: "rgba(99, 102, 241, .06)", stroke: "rgba(99, 102, 241, .18)", text: "#4F46B5" },
    technology: { x: Math.round(width * .53), y: Math.round(height * .25), width: Math.round(width * .41), height: Math.round(height * .49), title: "项目与技术", tone: "rgba(20, 184, 166, .06)", stroke: "rgba(20, 184, 166, .18)", text: "#0F766E" },
    practice: { x: Math.round(width * .31), y: Math.round(height * .78), width: Math.round(width * .39), height: Math.round(height * .15), title: "工作与实践", tone: "rgba(236, 72, 153, .05)", stroke: "rgba(236, 72, 153, .17)", text: "#A83D72" }
  };
  const cardPositions = {
    general: (box) => [box.x + 24, box.y + 86],
    learning: (box) => [box.x + Math.max(60, box.width - 182), box.y + Math.min(168, box.height - 66)],
    project: (box) => [box.x + 28, box.y + 88],
    codex: (box) => [box.x + Math.max(132, box.width - 160), box.y + Math.min(166, box.height - 62)],
    infrastructure: (box) => [box.x + 46, box.y + Math.min(244, box.height - 70)],
    practice: (box) => [box.x + Math.max(56, (box.width - 148) / 2), box.y + Math.min(66, box.height - 56)]
  };
  const cardCenters = new Map();
  const addText = (x, y, text, fill, font) => ({ type: "text", style: { x, y, text, fill, font } });
  const addCluster = (id) => {
    const box = boxes[id];
    const count = clusterNotes(id);
    const update = formatDate(clusterLatest(id) || latest) || "暂无更新";
    graphics.push({
      id: `cluster-${id}`,
      type: "group",
      left: box.x,
      top: box.y,
      z: 0,
      silent: true,
      children: [
        { type: "rect", shape: { x: 0, y: 0, width: box.width, height: box.height, r: 26 }, style: { fill: box.tone, stroke: box.stroke, lineWidth: 1 } },
        addText(20, 18, box.title, box.text, "700 14px sans-serif"),
        addText(20, 40, `${count} 篇笔记 · 最近更新 ${update}`, "#7C8AA0", "11px sans-serif")
      ]
    });
  };

  ["learning", "technology", "practice"].forEach(addCluster);
  graphics.push({
    id: "knowledge-core-card",
    type: "group",
    left: Math.round(width * .06),
    top: 24,
    z: 4,
    silent: true,
    children: [
      { type: "rect", shape: { x: 0, y: 0, width: coreWidth, height: 108, r: 20 }, style: { fill: "rgba(255,255,255,.96)", stroke: "rgba(91,124,250,.28)", lineWidth: 1, shadowBlur: 20, shadowColor: "rgba(89,109,165,.12)", shadowOffsetY: 8 } },
      { type: "image", style: { image: "assets/morning-dusk-logo-v2.png", x: 18, y: 25, width: 54, height: 54 } },
      addText(88, 25, "朝夕拾光", "#172033", "700 19px sans-serif"),
      addText(88, 51, "个人知识系统", "#64748B", "12px sans-serif"),
      addText(88, 76, `${notes.length} 篇笔记  ·  ${categories.length} 个主题  ·  更新于 ${formatDate(latest) || "今日"}`, "#64748B", "11px sans-serif")
    ]
  });

  categories.forEach((category, index) => {
    const kind = categoryKind(category);
    const clusterId = clusterFor(kind);
    const box = boxes[clusterId];
    const [x, y] = (cardPositions[kind] || cardPositions.practice)(box);
    const [startColor, endColor] = categoryTheme(category, index);
    const count = categoryCounts[category] || 1;
    const primary = kind === "general" || kind === "project";
    const cardWidth = primary ? 156 : 140;
    const cardHeight = primary ? 54 : 46;
    cardCenters.set(kind, [x + cardWidth / 2, y + cardHeight / 2]);
    graphics.push({
      id: `topic-${category}`,
      type: "group",
      left: x,
      top: y,
      z: 3,
      cursor: "pointer",
      onclick: () => handleKnowledgeGraphClick({ data: { kind: "category", value: category } }),
      children: [
        { type: "rect", shape: { x: 0, y: 0, width: cardWidth, height: cardHeight, r: 14 }, style: { fill: "rgba(255,255,255,.94)", stroke: `${startColor}70`, lineWidth: 1, shadowBlur: 12, shadowColor: `${endColor}26`, shadowOffsetY: 5 } },
        { type: "circle", shape: { cx: 19, cy: 17, r: 4.5 }, style: { fill: startColor } },
        addText(31, 10, compactLabel(category), "#26354A", "700 14px sans-serif"),
        addText(31, 29, `${count} 篇笔记`, "#8290A5", "11px sans-serif")
      ]
    });
  });

  const addCurve = (fromKind, toKind) => {
    const from = cardCenters.get(fromKind);
    const to = cardCenters.get(toKind);
    if (!from || !to) return;
    graphics.push({
      type: "bezierCurve",
      z: 1,
      silent: true,
      shape: { x1: from[0], y1: from[1], x2: to[0], y2: to[1], cpx1: from[0] + (to[0] - from[0]) * .35, cpy1: from[1] - 20, cpx2: from[0] + (to[0] - from[0]) * .7, cpy2: to[1] + 20 },
      style: { stroke: "rgba(100,116,139,.22)", lineWidth: 1.2, fill: null }
    });
  };
  addCurve("learning", "codex");
  addCurve("general", "practice");

  return { graphics };
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
    .filter((note) => state.folder === "all" || isFolderBranch(note.folder, state.folder))
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

function promptNewFolder() {
  const value = window.prompt(folderBrowserPath ? `在“${folderLabel(folderBrowserPath)}”中新建子文件夹` : "新建文件夹", "");
  if (value === null) return;
  createCustomFolder(value, folderBrowserPath);
}

function normalizeFolderSegment(value) {
  return String(value || "")
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

function parentFolderOf(folder) {
  const position = String(folder || "").lastIndexOf(folderPathSeparator);
  return position > -1 ? folder.slice(0, position) : "";
}

function folderLabel(folder) {
  const parent = parentFolderOf(folder);
  return parent ? folder.slice(parent.length + folderPathSeparator.length) : folder;
}

function isFolderBranch(value, folder) {
  return value === folder || String(value || "").startsWith(`${folder}${folderPathSeparator}`);
}

function replaceFolderBranch(value, fromFolder, toFolder) {
  return isFolderBranch(value, fromFolder)
    ? `${toFolder}${String(value).slice(fromFolder.length)}`
    : value;
}

function promptNewSubfolder(parentFolder) {
  if (!parentFolder) return;
  const value = window.prompt(`在“${folderLabel(parentFolder)}”中新建子文件夹`, "");
  if (value === null) return;
  createCustomFolder(value, parentFolder);
}

function createCustomFolder(value, parentFolder = "") {
  const segment = normalizeFolderSegment(value);
  const folder = parentFolder ? `${parentFolder}${folderPathSeparator}${segment}` : segment;
  if (!segment || folder === "all") return;
  const folders = knownFolders();
  if (!folders.includes(folder)) saveFolderRegistry([...folders, folder]);
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
  if (elements.finderFavoriteCount) elements.finderFavoriteCount.textContent = String(favorites);
  if (elements.favoriteFilterButton) {
    elements.favoriteFilterButton.classList.toggle("is-active", state.favoritesOnly);
    elements.favoriteFilterButton.setAttribute("aria-pressed", String(state.favoritesOnly));
  }
  if (!elements.folderList) return;
  if (elements.folderPickerLabel) {
    elements.folderPickerLabel.textContent = state.folder === "all" ? "全部文件夹" : folderLabel(state.folder);
  }
  if (elements.folderLocationTitle) {
    elements.folderLocationTitle.textContent = folderBrowserPath ? folderLabel(folderBrowserPath) : "\u6211\u7684\u6587\u4ef6";
  }
  if (elements.folderBackButton) elements.folderBackButton.disabled = !folderBrowserPath;
  elements.folderList.innerHTML = "";
  elements.folderList.classList.add("folder-tree-list");
  elements.folderList.append(createFolderTreeRow("all", ownNotes.length, 0, false));
  renderFolderTreeRows("", 0, folders, ownNotes);
  renderFolderBreadcrumb();
  renderFinderFolderContent(folders, ownNotes);
}

function renderFolderTreeRows(parentFolder, depth, folders, ownNotes) {
  const children = folders.filter((folder) => parentFolderOf(folder) === parentFolder);
  for (const folder of children) {
    const hasChildren = folders.some((candidate) => parentFolderOf(candidate) === folder);
    const count = ownNotes.filter((note) => isFolderBranch(note.folder, folder)).length;
    elements.folderList.append(createFolderTreeRow(folder, count, depth, hasChildren));
    if (hasChildren && expandedFolderPaths.has(folder)) {
      renderFolderTreeRows(folder, depth + 1, folders, ownNotes);
    }
  }
}

function createFolderTreeRow(folder, count, depth, hasChildren) {
  const all = folder === "all";
  const row = document.createElement("div");
  const isCurrentLocation = all ? !folderBrowserPath : folderBrowserPath === folder;
  row.className = `folder-tree-row${all ? " is-all" : ""}${isCurrentLocation ? " is-active" : ""}`;
  row.style.setProperty("--folder-depth", String(depth));

  const disclosure = document.createElement("button");
  disclosure.type = "button";
  disclosure.className = "folder-tree-disclosure";
  disclosure.dataset.folderAction = "open-folder";
  disclosure.dataset.folder = folder;
  disclosure.disabled = !hasChildren;
  disclosure.classList.toggle("is-expanded", hasChildren && expandedFolderPaths.has(folder));
  disclosure.setAttribute("aria-label", hasChildren ? "展开或收起子文件夹" : "没有子文件夹");

  const select = document.createElement("button");
  select.type = "button";
  select.className = "folder-tree-select";
  select.dataset.folder = folder;
  select.innerHTML = `<span class="folder-tree-icon" aria-hidden="true"></span><strong>${all ? "全部文件夹" : escapeHtml(folderLabel(folder))}</strong><small>${count}</small>`;
  row.append(disclosure, select);

  if (!all) {
    const actions = document.createElement("span");
    actions.className = "folder-tree-actions";
    actions.innerHTML = `
      <button type="button" data-folder-action="add-child" data-folder="${escapeHtml(folder)}" title="新建子文件夹" aria-label="新建子文件夹"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg></button>
      <button type="button" data-folder-action="rename" data-folder="${escapeHtml(folder)}" title="重命名" aria-label="重命名"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 14.8.7-3.1L12.9 3.5a1.6 1.6 0 0 1 2.3 2.3l-8.2 8.2-3 .8Z"/><path d="m11.8 4.6 3.6 3.6"/></svg></button>
      <button type="button" data-folder-action="delete" data-folder="${escapeHtml(folder)}" title="删除" aria-label="删除"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2m-7 0 .7 10h8.6L15 6M8 9v4m4-4v4"/></svg></button>
    `;
    row.append(actions);
  }
  return row;
}

function renderFolderBreadcrumb() {
  if (!elements.folderBreadcrumb) return;
  const pieces = folderBrowserPath ? folderBrowserPath.split(folderPathSeparator).map(escapeHtml) : [];
  elements.folderBreadcrumb.innerHTML = pieces.length
    ? `<button type="button" data-folder-back aria-label="\u8fd4\u56de\u4e0a\u4e00\u7ea7">\u6211\u7684\u6587\u4ef6</button>${pieces.map((piece) => `<i>/</i><strong>${piece}</strong>`).join("")}`
    : `<span>\u6211\u7684\u6587\u4ef6</span><i>/</i><strong>\u6839\u76ee\u5f55</strong>`;
  return;
  if (!folderBrowserPath) {
    elements.folderBreadcrumb.textContent = "根目录 · 显示一级文件夹";
    return;
  }
  elements.folderBreadcrumb.innerHTML = `<button type="button" data-folder-back>‹ 返回上层</button><span>${escapeHtml(folderBrowserPath)}</span>`;
}

function openFolderBrowser(folder) {
  if (!folder) return;
  folderBrowserPath = folder;
  if (expandedFolderPaths.has(folder)) expandedFolderPaths.delete(folder);
  else expandedFolderPaths.add(folder);
  renderOrganization();
}

function openNotesForFolder(folder) {
  const nextFolder = folder || "all";
  folderBrowserPath = nextFolder === "all" ? "" : nextFolder;
  state.scope = currentUser?.id || currentUser?.username ? "mine" : "all";
  state.folder = nextFolder;
  state.favoritesOnly = false;
  if (elements.folderFilter) elements.folderFilter.value = nextFolder;
  resetNoteList();
  render();
  window.location.hash = "#notesLibrary";
}

function renderFinderFolderContent(folders, ownNotes) {
  if (!elements.folderContent) return;
  const currentFolder = folderBrowserPath;
  const children = folders.filter((folder) => parentFolderOf(folder) === currentFolder);
  const directNotes = ownNotes.filter((note) => currentFolder ? note.folder === currentFolder : !note.folder);

  if (elements.folderContentMeta) {
    const location = currentFolder ? folderLabel(currentFolder) : "\u6211\u7684\u6587\u4ef6";
    elements.folderContentMeta.textContent = `${location} · ${children.length} \u4e2a\u6587\u4ef6\u5939 · ${directNotes.length} \u7bc7\u7b14\u8bb0`;
  }
  if (elements.folderOpenNotesButton) {
    elements.folderOpenNotesButton.textContent = currentFolder ? "\u67e5\u770b\u6b64\u6587\u4ef6\u5939\u7b14\u8bb0" : "\u67e5\u770b\u5168\u90e8\u7b14\u8bb0";
  }

  elements.folderContent.innerHTML = "";
  if (!children.length) {
    const empty = document.createElement("div");
    empty.className = "finder-empty-folder";
    empty.innerHTML = `<span class="finder-empty-folder-icon" aria-hidden="true"></span><strong>${currentFolder ? "\u8fd9\u4e2a\u6587\u4ef6\u5939\u8fd8\u6ca1\u6709\u5b50\u76ee\u5f55" : "\u8fd8\u6ca1\u6709\u6587\u4ef6\u5939"}</strong><p>${currentFolder ? "\u53ef\u5728\u53f3\u4e0a\u89d2\u65b0\u5efa\u5b50\u6587\u4ef6\u5939\uff0c\u6216\u76f4\u63a5\u628a\u7b14\u8bb0\u653e\u5728\u8fd9\u91cc\u3002" : "\u4ece\u53f3\u4e0a\u89d2\u65b0\u5efa\u7b2c\u4e00\u4e2a\u6587\u4ef6\u5939\uff0c\u5f00\u59cb\u6574\u7406\u4f60\u7684\u7b14\u8bb0\u3002"}</p>`;
    elements.folderContent.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  children.forEach((folder) => {
    const noteCount = ownNotes.filter((note) => isFolderBranch(note.folder, folder)).length;
    const childCount = folders.filter((candidate) => parentFolderOf(candidate) === folder).length;
    const tile = document.createElement("article");
    tile.className = `finder-folder-tile${state.folder === folder ? " is-selected" : ""}`;
    tile.title = `${folderLabel(folder)} \uff08\u70b9\u51fb\u67e5\u770b\u7b14\u8bb0\uff09`;
    tile.innerHTML = `
      <button class="finder-folder-open" type="button" data-folder-tile="${escapeHtml(folder)}">
        <span class="finder-folder-large" aria-hidden="true"></span>
        <strong>${escapeHtml(folderLabel(folder))}</strong>
        <small>${noteCount} \u7bc7\u7b14\u8bb0${childCount ? ` · ${childCount} \u4e2a\u5b50\u6587\u4ef6\u5939` : ""}</small>
      </button>
      <span class="finder-tile-actions">
        <button type="button" data-folder-action="add-child" data-folder="${escapeHtml(folder)}" aria-label="\u65b0\u5efa\u5b50\u6587\u4ef6\u5939" title="\u65b0\u5efa\u5b50\u6587\u4ef6\u5939">+</button>
        <button type="button" data-folder-action="rename" data-folder="${escapeHtml(folder)}" aria-label="\u91cd\u547d\u540d" title="\u91cd\u547d\u540d">✎</button>
        <button type="button" data-folder-action="delete" data-folder="${escapeHtml(folder)}" aria-label="\u5220\u9664" title="\u5220\u9664">×</button>
      </span>`;
    fragment.append(tile);
  });
  elements.folderContent.append(fragment);
}

function createFolderCard(folder, count, options = {}) {
  const all = Boolean(options.all);
  const card = document.createElement("div");
  card.className = `folder-chip${all ? " is-all" : ""}${state.folder === folder ? " is-active" : ""}`;

  const select = document.createElement("button");
  select.type = "button";
  select.className = "folder-chip-select";
  select.dataset.folder = folder;
  select.innerHTML = `<span class="folder-chip-icon" aria-hidden="true"></span><span class="folder-chip-name">${all ? "全部文件夹" : escapeHtml(folderLabel(folder))}</span><span class="folder-chip-count">${count} 篇笔记</span>`;
  card.append(select);

  if (!all) {
    const actions = document.createElement("span");
    actions.className = "folder-card-actions";
    actions.innerHTML = `
      <button type="button" class="folder-chip-menu" data-folder-action="add-child" data-folder="${escapeHtml(folder)}" aria-label="新建子文件夹" title="新建子文件夹">+</button>
      <button type="button" class="folder-chip-menu" data-folder-action="rename" data-folder="${escapeHtml(folder)}" aria-label="重命名文件夹" title="重命名">✎</button>
      <button type="button" class="folder-chip-menu danger" data-folder-action="delete" data-folder="${escapeHtml(folder)}" aria-label="删除文件夹" title="删除">×</button>
    `;
    card.append(actions);
  }
  if (options.hasChildren) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "folder-tree-toggle";
    toggle.dataset.folderAction = "open-folder";
    toggle.dataset.folder = folder;
    toggle.setAttribute("aria-label", "进入子文件夹");
    toggle.title = "进入子文件夹";
    toggle.textContent = "›";
    card.append(toggle);
  }
  return card;
}

async function renameCustomFolder(folder) {
  if (!folder) return;
  const segment = normalizeFolderSegment(window.prompt(`重命名“${folderLabel(folder)}”`, folderLabel(folder)));
  const parent = parentFolderOf(folder);
  const next = parent ? `${parent}${folderPathSeparator}${segment}` : segment;
  if (!segment || next === folder || next === "all") return;
  if (knownFolders().some((name) => name === next && name !== folder)) {
    setStatus("已经有同名文件夹，请换一个名称。", true);
    return;
  }

  const affectedNotes = state.notes.filter((note) => isMyNote(note) && isFolderBranch(note.folder, folder));
  if (affectedNotes.length && !window.confirm(`将同步更新 ${affectedNotes.length} 篇笔记及子文件夹，是否继续？`)) return;

  try {
    for (let index = 0; index < affectedNotes.length; index += 1) {
      const note = affectedNotes[index];
      setStatus(`正在重命名文件夹… ${index + 1}/${affectedNotes.length}`);
      const nextFolder = replaceFolderBranch(note.folder, folder, next);
      await saveNoteOrganization(note, { folder: nextFolder });
      note.folder = nextFolder;
    }
    saveFolderRegistry(knownFolders().map((name) => replaceFolderBranch(name, folder, next)));
    folderBrowserPath = replaceFolderBranch(folderBrowserPath, folder, next);
    state.folder = replaceFolderBranch(state.folder, folder, next);
    if (state.currentDetailNote?.folder) {
      state.currentDetailNote.folder = replaceFolderBranch(state.currentDetailNote.folder, folder, next);
    }
    state.detailCache.clear();
    hydrateFilters();
    render();
    if (state.currentDetailNote) renderDetail(state.currentDetailNote);
    setStatus(`文件夹已重命名为“${next}”。`);
  } catch (error) {
    hydrateFilters();
    render();
    setStatus(error instanceof Error ? error.message : "文件夹重命名失败。", true);
  }
}

async function deleteCustomFolder(folder) {
  if (!folder) return;
  const affectedNotes = state.notes.filter((note) => isMyNote(note) && isFolderBranch(note.folder, folder));
  const message = affectedNotes.length
    ? `删除“${folderLabel(folder)}”及其子文件夹后，其中 ${affectedNotes.length} 篇笔记会移至未归档；笔记内容不会删除。确定继续吗？`
    : `确定删除空文件夹“${folderLabel(folder)}”吗？`;
  if (!window.confirm(message)) return;

  try {
    for (let index = 0; index < affectedNotes.length; index += 1) {
      const note = affectedNotes[index];
      setStatus(`正在移出笔记… ${index + 1}/${affectedNotes.length}`);
      await saveNoteOrganization(note, { folder: "" });
      note.folder = "";
    }
    saveFolderRegistry(knownFolders().filter((name) => !isFolderBranch(name, folder)));
    if (isFolderBranch(folderBrowserPath, folder)) folderBrowserPath = parentFolderOf(folder);
    if (isFolderBranch(state.folder, folder)) state.folder = "all";
    if (state.currentDetailNote?.folder && isFolderBranch(state.currentDetailNote.folder, folder)) {
      state.currentDetailNote.folder = "";
    }
    state.detailCache.clear();
    hydrateFilters();
    render();
    if (state.currentDetailNote) renderDetail(state.currentDetailNote);
    setStatus(`已删除文件夹“${folder}”，笔记已保留。`);
  } catch (error) {
    hydrateFilters();
    render();
    setStatus(error instanceof Error ? error.message : "删除文件夹失败。", true);
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

async function deleteCurrentDetailNote() {
  const note = state.currentDetailNote;
  if (!note || !isMyNote(note)) return;

  const approved = window.confirm(`确定删除“${note.title}”？\n\n笔记会移至 Notion 回收站，可在 Notion 中恢复。`);
  if (!approved) return;

  const button = elements.detailDeleteButton;
  if (button) {
    button.disabled = true;
    button.textContent = "删除中…";
  }

  try {
    const response = await fetch(`${apiBase}/api/admin/notes/${encodeURIComponent(detailNoteKey(note))}`, {
      method: "DELETE",
      headers: siteHeaders()
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.error || "删除笔记失败。");

    state.notes = state.notes.filter((item) => detailNoteKey(item) !== detailNoteKey(note));
    state.detailCache.delete(detailNoteKey(note));
    closeDetail();
    hydrateFilters();
    resetNoteList();
    render();
    setStatus(`已删除“${note.title}”，可在 Notion 回收站恢复。`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除笔记失败。";
    setStatus(message, true);
    if (button) {
      button.disabled = false;
      button.textContent = "删除失败，重试";
    }
  }
}

async function moveCurrentDetailToFolder() {
  const note = state.currentDetailNote;
  if (!note || !isMyNote(note)) return;
  const folder = elements.detailFolderInput?.value.trim().slice(0, 40) || "";
  const button = elements.detailFolderSaveButton;
  if (button) {
    button.disabled = true;
    button.textContent = "\u79fb\u52a8\u4e2d…";
    button.classList.remove("is-success", "is-error");
  }
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
    const message = folder ? `\u5df2\u79fb\u52a8\u5230\uff1a${folder}` : "\u5df2\u79fb\u51fa\u6587\u4ef6\u5939";
    setStatus(message);
    showDetailFolderFeedback(message, "success");
    if (button) {
      button.textContent = "\u5df2\u79fb\u52a8 ✓";
      button.classList.add("is-success");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "\u79fb\u52a8\u7b14\u8bb0\u5931\u8d25\u3002";
    setStatus(message, true);
    showDetailFolderFeedback(message, "error");
    if (button) {
      button.textContent = "\u79fb\u52a8\u5931\u8d25";
      button.classList.add("is-error");
    }
  } finally {
    if (button) {
      button.disabled = false;
      window.setTimeout(() => {
        button.textContent = "\u79fb\u52a8";
        button.classList.remove("is-success", "is-error");
      }, 2600);
    }
  }
}

function showDetailFolderFeedback(message, tone = "success") {
  const feedback = elements.detailFolderFeedback;
  if (!feedback) return;
  window.clearTimeout(detailFolderFeedbackTimer);
  feedback.textContent = tone === "success" ? `✓ ${message}` : message;
  feedback.hidden = false;
  feedback.className = `detail-folder-feedback is-${tone}`;
  detailFolderFeedbackTimer = window.setTimeout(() => {
    feedback.hidden = true;
  }, 4200);
}

function clearDetailFolderFeedback() {
  const feedback = elements.detailFolderFeedback;
  if (!feedback) return;
  window.clearTimeout(detailFolderFeedbackTimer);
  feedback.hidden = true;
  feedback.textContent = "";
  feedback.className = "detail-folder-feedback";
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
  // Show the signed-in user's notes by default; guests keep the full list.
  state.scope = !isVisitorMode && (currentUser?.id || currentUser?.username) ? "mine" : "all";
  if (isVisitorMode) state.visibility = "public";
  resetNoteList();
  render();
  document.body.dataset.appView = "notes";
  document.body.classList.add("notes-library-mode");
}

function mountFolderHub() {
  if (!elements.folderHub || !elements.folderPageMount) return;
  if (elements.folderHub.parentElement !== elements.folderPageMount) {
    elements.folderPageMount.append(elements.folderHub);
  }
  elements.folderHub.classList.add("is-page-mode");
}

function closeNotesLibrary() {
  window.location.hash = "#knowledgeGraph";
}

function syncPageViewFromHash() {
  const hash = isVisitorMode ? "#notesLibrary" : window.location.hash;
  const view = hash === "#today"
    ? "today"
    : hash === "#notesLibrary" || hash === "#notes"
      ? "notes"
    : hash === "#diaries"
      ? "diaries"
    : hash === "#calendar"
      ? "calendar"
      : hash === "#folders"
        ? "folders"
      : hash === "#growthMap"
          ? "growth"
          : "graph";

  document.body.dataset.appView = view;
  renderTopbar(view);
  document.body.classList.toggle("notes-library-mode", view === "notes");
  elements.folderHub?.classList.toggle("is-page-mode", view === "folders");

  const activeHash = view === "notes"
    ? "#notesLibrary"
    : view === "growth"
      ? "#growthMap"
      : view === "graph"
        ? "#knowledgeGraph"
        : `#${view}`;
  document.querySelectorAll(".mac-nav a").forEach((link) => {
    const active = link.getAttribute("href") === activeHash;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  if (view === "graph") {
    requestAnimationFrame(() => {
      renderKnowledgeGraph(state.notes, 0, true);
      scheduleKnowledgeGraphResize();
    });
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderTopbar(view) {
  const labels = {
    today: ["\u4eca\u65e5", "\u4ece\u4e00\u4e2a\u5ff5\u5934\u5f00\u59cb"],
    notes: ["\u6211\u7684\u7b14\u8bb0", "\u9605\u8bfb\u3001\u641c\u7d22\u4e0e\u6574\u7406\u4f60\u7684\u5185\u5bb9"],
    folders: ["\u6587\u4ef6\u7a7a\u95f4", "\u4f60\u7684\u77e5\u8bc6\u7ed3\u6784"],
    diaries: ["\u62fe\u5149\u65e5\u8bb0", "\u53ea\u6536\u85cf\u613f\u610f\u516c\u5f00\u7684\u65f6\u5149"],
    calendar: ["\u8bb0\u5f55\u65e5\u5386", "\u56de\u770b\u6bcf\u4e00\u5929\u7684\u6c89\u6dc0"],
    growth: ["\u6210\u957f\u8f68\u8ff9", "\u8fd9\u4e00\u5e74\u7684\u5b66\u4e60\u8db3\u8ff9"],
    graph: ["\u77e5\u8bc6\u5730\u56fe", "\u63a2\u7d22\u4f60\u7684\u77e5\u8bc6\u8fde\u63a5"]
  };
  const [title, subtitle] = isVisitorMode && view === "notes"
    ? ["公开笔记", "访客可直接阅读我选定公开的内容"]
    : (labels[view] || labels.graph);
  if (elements.pageTitle) elements.pageTitle.textContent = title;
  if (elements.pageSubtitle) elements.pageSubtitle.textContent = subtitle;
}

function renderStats(notes) {
  const categories = unique(notes.map((note) => note.category).filter(Boolean));
  const tags = unique(notes.flatMap((note) => note.tags));
  const latest = notes.map((note) => note.updated).filter(Boolean).sort(compareDate).at(-1);

  elements.totalNotes.textContent = String(notes.length);
  elements.totalCategories.textContent = String(categories.length);
  elements.totalTags.textContent = String(tags.length);
  elements.lastUpdated.textContent = formatDate(latest) || "-";
  if (elements.todayMetricNotes) elements.todayMetricNotes.textContent = String(notes.length);
  if (elements.todayMetricCategories) elements.todayMetricCategories.textContent = String(categories.length);
  if (elements.todayMetricTags) elements.todayMetricTags.textContent = String(tags.length);
  if (elements.todayMetricUpdated) elements.todayMetricUpdated.textContent = formatDate(latest) || "-";
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

  const isDiary = String(note.type || "").includes("日记") || String(note.category || "").includes("日记");
  if (note.cover) {
    cover.src = note.cover;
    cover.alt = `${note.title} 封面`;
    cover.hidden = false;
  } else if (isDiary) {
    cover.src = "assets/diary-cover.svg";
    cover.alt = "朝夕日记默认封面";
    cover.hidden = false;
    node.classList.add("is-diary-card");
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
  const key = detailNoteKey(note);
  openPanel();
  renderDetail({ ...note, content: note.content?.length ? note.content : loadingBlocks() });

  let settled = false;
  const fallbackTimer = window.setTimeout(() => {
    if (settled) return;
    openPanel();
    renderDetail({
      ...note,
      content: detailUnavailableBlocks(new Error("详情服务响应超时，请稍后重试。"))
    });
  }, 9000);

  try {
    const detail = await fetchDetail(key);
    if (!detail?.note) throw new Error("详情服务未返回笔记内容。");
    const loadedNote = {
      ...note,
      ...detail.note,
      content: Array.isArray(detail.note.content) ? detail.note.content : [],
      tags: Array.isArray(detail.note.tags) ? detail.note.tags : (note.tags || [])
    };
    state.detailCache.set(key, detail);
    openPanel();
    renderDetailContent(loadedNote.content);
    renderDetail(loadedNote);
  } catch (error) {
    openPanel();
    const content = note.content?.length ? note.content : detailUnavailableBlocks(error);
    renderDetail({ ...note, content });
  } finally {
    settled = true;
    window.clearTimeout(fallbackTimer);
  }
}

function detailNoteKey(note) {
  return String(note?.slug || note?.id || "").trim();
}

function isShowingDetail(note) {
  return elements.detailPanel?.getAttribute("aria-hidden") === "false"
    && detailNoteKey(state.currentDetailNote) === detailNoteKey(note);
}

async function fetchDetail(key) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), detailRequestTimeoutMs);
  try {
    const notesPath = isVisitorMode ? "/api/public/notes" : "/api/notes";
    const requestUrl = `${apiBase}${notesPath}/${encodeURIComponent(key)}?v=${Date.now()}`;
    const response = await fetch(requestUrl, {
      headers: isVisitorMode ? {} : siteHeaders(),
      signal: controller.signal,
      cache: "no-store"
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.error || "读取详情失败");
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("正文读取超时，请关闭后重试。");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function exportCurrentNoteMarkdown() {
  const note = state.currentDetailNote;
  if (!note || !isMyNote(note)) return;
  downloadTextFile(`${safeDownloadName(note.title)}.md`, noteToMarkdown(note), "text/markdown;charset=utf-8");
}

function exportCurrentNotePdf() {
  const note = state.currentDetailNote;
  if (!note || !isMyNote(note)) return;
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    setDetailShareStatus("浏览器拦截了打印窗口，请允许弹窗后重试。", "error");
    return;
  }

  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(buildPrintableNoteHtml(note));
  printWindow.document.close();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 350);
}

function noteToMarkdown(note) {
  const metadata = [
    note.type && `- 类型：${note.type}`,
    note.category && `- 分类：${note.category}`,
    note.updated && `- 更新：${formatDate(note.updated)}`,
    note.tags?.length && `- 标签：${note.tags.map((tag) => `#${tag}`).join(" ")}`
  ].filter(Boolean);
  const blocks = (note.content || []).map((block) => markdownForBlock(block)).filter(Boolean);
  return [
    `# ${note.title || "未命名笔记"}`,
    note.summary ? `\n> ${note.summary}` : "",
    metadata.length ? `\n${metadata.join("\n")}` : "",
    blocks.length ? `\n---\n\n${blocks.join("\n\n")}` : ""
  ].filter(Boolean).join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

function markdownForBlock(block) {
  const text = String(block?.text || "").trim();
  if (block?.type === "image") return block.url ? `![${normalizeImageCaption(block.caption)}](${block.url})` : "";
  if (block?.type === "divider") return "---";
  if (!text) return "";
  const headingLevel = headingLevelForType(block.type);
  if (headingLevel) return `${"#".repeat(headingLevel)} ${text}`;
  if (block.type === "quote" || block.type === "callout") return `> ${text}`;
  if (block.type === "bulleted_list_item") return `- ${text}`;
  if (block.type === "numbered_list_item") return `1. ${text}`;
  if (block.type === "to_do") return `- [${block.checked ? "x" : " "}] ${text}`;
  if (block.type === "code") return `\`\`\`\n${text}\n\`\`\``;
  return text;
}

function safeDownloadName(value) {
  return String(value || "笔记")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim()
    .slice(0, 80) || "笔记";
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildPrintableNoteHtml(note) {
  const metadata = [note.type, note.category, note.updated && formatDate(note.updated)].filter(Boolean).map(escapeHtml).join(" · ");
  const tags = (note.tags || []).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("");
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>${escapeHtml(note.title || "笔记")}</title>
<style>
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #1d1d1f; font: 11pt/1.8 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; }
article { max-width: 760px; margin: 0 auto; }
h1 { margin: 0 0 8px; font-size: 25pt; line-height: 1.25; } h2 { margin: 28px 0 10px; font-size: 17pt; } h3 { margin: 20px 0 8px; font-size: 13pt; }
.meta, .tags { color: #6e6e73; font-size: 9.5pt; } .tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 24px; } .tags span { padding: 2px 7px; border: 1px solid #d9d9de; border-radius: 999px; }
.summary { margin: 0 0 18px; color: #505057; font-size: 12pt; } p, li { margin: 0 0 10px; } blockquote { margin: 16px 0; padding: 8px 16px; border-left: 3px solid #0a84ff; color: #505057; background: #f7f9fc; } pre { overflow-wrap: anywhere; padding: 12px; border-radius: 8px; background: #f4f4f5; white-space: pre-wrap; } img { display: block; max-width: 100%; max-height: 210mm; margin: 16px auto; border-radius: 8px; } hr { margin: 24px 0; border: 0; border-top: 1px solid #dedee3; }
</style></head><body><article>
<h1>${escapeHtml(note.title || "未命名笔记")}</h1><div class="meta">${metadata}</div>${note.summary ? `<p class="summary">${escapeHtml(note.summary)}</p>` : ""}<div class="tags">${tags}</div>
${printableBlocksHtml(note.content || [])}</article></body></html>`;
}

function printableBlocksHtml(blocks) {
  return blocks.map((block) => {
    const text = escapeHtml(block?.text || "");
    if (block?.type === "image") return block.url ? `<img src="${escapeHtml(block.url)}" alt="${escapeHtml(block.caption || "笔记图片")}" referrerpolicy="no-referrer">` : "";
    if (block?.type === "divider") return "<hr>";
    if (!text) return "";
    const headingLevel = headingLevelForType(block.type);
    if (headingLevel) return `<h${headingLevel}>${text}</h${headingLevel}>`;
    if (block.type === "quote" || block.type === "callout") return `<blockquote>${text}</blockquote>`;
    if (block.type === "bulleted_list_item") return `<ul><li>${text}</li></ul>`;
    if (block.type === "numbered_list_item") return `<ol><li>${text}</li></ol>`;
    if (block.type === "to_do") return `<p>${block.checked ? "☑" : "☐"} ${text}</p>`;
    if (block.type === "code") return `<pre><code>${text}</code></pre>`;
    return `<p>${text.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");
}

async function createCurrentNoteShare() {
  const note = state.currentDetailNote;
  if (!note || !isMyNote(note)) return;
  const button = elements.detailShareButton;
  if (button) button.disabled = true;
  try {
    const response = await fetch(`${apiBase}/api/admin/notes/${encodeURIComponent(detailNoteKey(note))}/share`, {
      method: "POST",
      headers: siteHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresInDays: 30 })
    });
    const data = await readJsonResponse(response);
    if (!response.ok || !data.shareId || !data.secret) throw new Error(data.error || "创建分享链接失败。");
    const link = buildShareUrl(data.shareId, data.secret);
    updateCurrentShareState({ enabled: true, expiresAt: data.expiresAt });
    if (elements.detailShareLink) elements.detailShareLink.value = link;
    if (elements.detailShareLinkWrap) elements.detailShareLinkWrap.hidden = false;
    if (elements.detailDisableShareButton) elements.detailDisableShareButton.hidden = false;
    if (elements.detailShareButton) elements.detailShareButton.textContent = "重新生成并复制链接";
    const copied = await copyText(link);
    setDetailShareStatus(copied ? `分享链接已复制，有效至 ${formatDate(data.expiresAt)}。` : `链接已生成，有效至 ${formatDate(data.expiresAt)}，请手动复制。`);
  } catch (error) {
    setDetailShareStatus(error instanceof Error ? error.message : "创建分享链接失败。", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function disableCurrentNoteShare() {
  const note = state.currentDetailNote;
  if (!note || !isMyNote(note) || !window.confirm("关闭分享后，现有链接将立即失效。是否继续？")) return;
  const button = elements.detailDisableShareButton;
  if (button) button.disabled = true;
  try {
    const response = await fetch(`${apiBase}/api/admin/notes/${encodeURIComponent(detailNoteKey(note))}/share`, {
      method: "DELETE",
      headers: siteHeaders()
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.error || "关闭分享失败。");
    updateCurrentShareState({ enabled: false, expiresAt: "" });
    if (elements.detailShareLink) elements.detailShareLink.value = "";
    if (elements.detailShareLinkWrap) elements.detailShareLinkWrap.hidden = true;
    if (elements.detailDisableShareButton) elements.detailDisableShareButton.hidden = true;
    if (elements.detailShareButton) elements.detailShareButton.textContent = "创建并复制链接";
    setDetailShareStatus("分享已关闭，旧链接已失效。");
  } catch (error) {
    setDetailShareStatus(error instanceof Error ? error.message : "关闭分享失败。", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

function updateCurrentShareState({ enabled, expiresAt }) {
  const note = state.currentDetailNote;
  if (!note) return;
  note.shareEnabled = Boolean(enabled);
  note.shareExpiresAt = expiresAt || "";
  state.notes.forEach((item) => {
    if (detailNoteKey(item) === detailNoteKey(note)) {
      item.shareEnabled = note.shareEnabled;
      item.shareExpiresAt = note.shareExpiresAt;
    }
  });
}

function buildShareUrl(shareId, secret) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("share", `${shareId}.${secret}`);
  return url.toString();
}

async function copyCurrentShareLink() {
  const value = elements.detailShareLink?.value || "";
  if (!value) return;
  const copied = await copyText(value);
  setDetailShareStatus(copied ? "分享链接已复制。" : "复制失败，请手动复制链接。", copied ? "success" : "error");
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function setDetailShareStatus(message, tone = "success") {
  if (!elements.detailShareStatus) return;
  elements.detailShareStatus.hidden = false;
  elements.detailShareStatus.dataset.tone = tone;
  elements.detailShareStatus.textContent = message;
}

function openSharedNoteFromLocation() {
  const value = new URLSearchParams(window.location.search).get("share") || "";
  const [shareId, secret, extra] = value.split(".");
  if (!shareId || !secret || extra) return false;
  document.body.classList.add("is-shared-note");
  document.querySelector(".page-shell")?.setAttribute("hidden", "");
  elements.sharedNoteView?.removeAttribute("hidden");
  hideSiteLock();
  loadSharedNote(shareId, secret);
  return true;
}

async function loadSharedNote(shareId, secret) {
  try {
    const response = await fetch(`${apiBase}/api/shared/${encodeURIComponent(shareId)}/${encodeURIComponent(secret)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.note) throw new Error(data.error || "分享链接无效或已过期。" );
    const note = data.note;
    document.title = `${note.title || "分享笔记"} · 朝夕拾光`;
    if (elements.sharedNoteCover) {
      if (note.cover) {
        elements.sharedNoteCover.src = note.cover;
        elements.sharedNoteCover.alt = `${note.title || "分享笔记"} 封面`;
        elements.sharedNoteCover.hidden = false;
      } else {
        elements.sharedNoteCover.removeAttribute("src");
        elements.sharedNoteCover.alt = "";
        elements.sharedNoteCover.hidden = true;
      }
    }
    if (elements.sharedNoteTitle) elements.sharedNoteTitle.textContent = note.title || "未命名笔记";
    if (elements.sharedNoteSummary) elements.sharedNoteSummary.textContent = note.summary || "";
    if (elements.sharedNoteMeta) elements.sharedNoteMeta.textContent = [note.type, note.category, note.updated && formatDate(note.updated), note.author && `作者 · ${note.author}`].filter(Boolean).join(" · ");
    renderTags(elements.sharedNoteTags, note.tags || []);
    renderBlocks(elements.sharedNoteContent, note.content || []);
  } catch (error) {
    if (elements.sharedNoteMeta) elements.sharedNoteMeta.textContent = "无法打开分享笔记";
    if (elements.sharedNoteError) {
      elements.sharedNoteError.hidden = false;
      elements.sharedNoteError.textContent = error instanceof Error ? error.message : "分享链接无效或已过期。";
    }
  }
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
  const headings = renderDetailContent(note.content);
  renderToc(headings);
  observeDetailHeadings();
  renderRelatedNotes(note);
  renderDetailNavigation(note);
  const isOwner = isMyNote(note);
  if (elements.detailEditButton) elements.detailEditButton.hidden = !isOwner;
  if (elements.detailDeleteWidget) elements.detailDeleteWidget.hidden = !isOwner;
  if (elements.detailExportWidget) elements.detailExportWidget.hidden = !isOwner;
  if (elements.detailShareWidget) elements.detailShareWidget.hidden = !isOwner;
  if (elements.detailShareButton) elements.detailShareButton.textContent = note.shareEnabled ? "重新生成并复制链接" : "创建并复制链接";
  if (elements.detailDisableShareButton) elements.detailDisableShareButton.hidden = !note.shareEnabled;
  if (elements.detailShareLinkWrap) elements.detailShareLinkWrap.hidden = true;
  if (elements.detailShareStatus) {
    elements.detailShareStatus.hidden = !note.shareEnabled;
    elements.detailShareStatus.textContent = note.shareEnabled
      ? `分享已启用${note.shareExpiresAt ? `，有效至 ${formatDate(note.shareExpiresAt)}` : ""}。重新生成会让旧链接失效。`
      : "";
  }
  if (elements.detailFavoriteButton) {
    elements.detailFavoriteButton.hidden = !isOwner;
    elements.detailFavoriteButton.classList.toggle("is-active", Boolean(note.favorite));
    elements.detailFavoriteButton.textContent = note.favorite ? "★ 已收藏" : "☆ 收藏笔记";
  }
  if (elements.detailFolderWidget) elements.detailFolderWidget.hidden = !isOwner;
  if (elements.detailFolderInput) elements.detailFolderInput.value = note.folder || "";
  clearDetailFolderFeedback();
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

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
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

    const spreadsheet = parseSpreadsheetMarker(trimmed);
    if (spreadsheet) {
      flushParagraph();
      blocks.push(spreadsheet);
      continue;
    }

    if (isMarkdownTableLine(trimmed) && isMarkdownTableDivider(lines[lineIndex + 1])) {
      flushParagraph();
      const rows = [parseMarkdownTableLine(trimmed)];
      lineIndex += 2;
      while (lineIndex < lines.length && isMarkdownTableLine(lines[lineIndex].trim())) {
        rows.push(parseMarkdownTableLine(lines[lineIndex].trim()));
        lineIndex += 1;
      }
      lineIndex -= 1;
      if (rows.length >= 2 && rows[0].length >= 2) blocks.push({ type: "table", rows: normalizeTableRows(rows), hasColumnHeader: true });
      else paragraph.push(line);
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
      blocks.push({ type: "image", url: image[2], caption: image[1] });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
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

function isMarkdownTableLine(value) {
  const line = String(value || "").trim();
  return /^\|?.+\|.+\|?$/.test(line);
}

function isMarkdownTableDivider(value) {
  const cells = parseMarkdownTableLine(value);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function parseMarkdownTableLine(value) {
  return String(value || "").trim().replace(/^\|/, "").replace(/\|$/, "")
    .split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, "|").trim());
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

  for (const [index, sourceBlock] of blocks.entries()) {
    const block = normalizeMarkdownHeadingBlock(sourceBlock);
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

function renderDetailContent(blocks) {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  try {
    return renderBlocks(elements.detailContent, safeBlocks);
  } catch (error) {
    console.error("[detail] render failed", error);
    if (!elements.detailContent) return [];
    elements.detailContent.replaceChildren();
    const fallback = document.createElement("p");
    fallback.textContent = safeBlocks.map((block) => block?.text || block?.caption || "").filter(Boolean).join("\n") || "正文已读取，但暂时无法排版。";
    elements.detailContent.append(fallback);
    return [];
  }
}

function renderBlock(block, headings = [], index = 0) {
  const type = block.type || "paragraph";
  if (type === "divider") return document.createElement("hr");
  if (type === "table") {
    const wrapper = document.createElement("div");
    wrapper.className = "article-table-wrap";
    const table = document.createElement("table");
    table.className = "article-table";
    const rows = Array.isArray(block.rows) ? block.rows : [];
    rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      row.forEach((cell) => {
        const cellElement = document.createElement(rowIndex === 0 && block.hasColumnHeader !== false ? "th" : "td");
        cellElement.textContent = String(cell || "");
        tr.append(cellElement);
      });
      table.append(tr);
    });
    wrapper.append(table);
    return wrapper;
  }
  if (type === "spreadsheet") {
    const figure = document.createElement("figure");
    figure.className = "spreadsheet-preview";
    const head = document.createElement("figcaption");
    const title = document.createElement("strong");
    title.textContent = `▦ ${block.filename || "Excel 表格"}`;
    const hint = document.createElement("span");
    hint.textContent = "正在载入原始表格…";
    head.append(title, hint);
    const viewport = document.createElement("div");
    viewport.className = "spreadsheet-viewport";
    figure.append(head, viewport);
    void renderSpreadsheetPreview(viewport, hint, block);
    return figure;
  }
  if (type === "image") {
    const figure = document.createElement("figure");
    figure.className = "article-image";
    const image = document.createElement("img");
    const source = String(block.url || "");
    const previewUrl = getWriterPendingImagePreview(source);
    image.src = previewUrl || source;
    const captionText = normalizeImageCaption(block.caption);
    image.alt = captionText || "笔记图片";
    image.loading = "lazy";
    figure.append(image);
    if (captionText) {
      const caption = document.createElement("figcaption");
      caption.textContent = captionText;
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
  const headingLevel = headingLevelForType(type);
  if (headingLevel) {
    const heading = document.createElement(`h${headingLevel}`);
    appendRichText(heading, block);
    heading.id = headingId(block.text, index);
    headings.push({ id: heading.id, text: block.text || "", level: headingLevel });
    return heading;
  }
  const paragraph = document.createElement("p");
  appendRichText(paragraph, block);
  return paragraph;
}

async function renderSpreadsheetPreview(viewport, hint, block) {
  try {
    const response = await fetch(block.url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`文件读取失败（${response.status}）`);
    const xlsx = await loadSpreadsheetLibrary();
    const workbook = xlsx.read(await response.arrayBuffer(), { type: "array", cellStyles: true, cellText: true });
    if (!workbook.SheetNames?.length) throw new Error("工作簿没有可显示的工作表。");

    const tabs = document.createElement("div");
    tabs.className = "spreadsheet-tabs";
    const canvas = document.createElement("div");
    canvas.className = "spreadsheet-canvas";
    viewport.replaceChildren(tabs, canvas);
    const renderSheet = (sheetName) => {
      tabs.querySelectorAll("button").forEach((button) => button.classList.toggle("is-active", button.dataset.sheet === sheetName));
      renderSpreadsheetSheet(canvas, workbook.Sheets[sheetName], xlsx);
    };
    workbook.SheetNames.forEach((sheetName, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.sheet = sheetName;
      button.textContent = sheetName;
      button.addEventListener("click", () => renderSheet(sheetName));
      tabs.append(button);
      if (index === 0) renderSheet(sheetName);
    });
    hint.textContent = workbook.SheetNames.length > 1 ? `共 ${workbook.SheetNames.length} 个工作表` : "Excel 原始布局预览";
  } catch (error) {
    viewport.textContent = "表格预览暂时无法加载。";
    hint.textContent = error instanceof Error ? error.message : "加载失败";
  }
}

function renderSpreadsheetSheet(container, sheet, xlsx) {
  container.replaceChildren();
  const reference = sheet?.["!ref"] || "A1";
  const range = xlsx.utils.decode_range(reference);
  const rowCount = Math.min(range.e.r - range.s.r + 1, 1000);
  const columnCount = Math.min(range.e.c - range.s.c + 1, 80);
  const merges = new Map();
  const covered = new Set();
  for (const merge of sheet?.["!merges"] || []) {
    if (merge.s.r > range.e.r || merge.s.c > range.e.c) continue;
    const key = `${merge.s.r}:${merge.s.c}`;
    merges.set(key, { rowspan: Math.min(merge.e.r, range.s.r + rowCount - 1) - merge.s.r + 1, colspan: Math.min(merge.e.c, range.s.c + columnCount - 1) - merge.s.c + 1 });
    for (let row = merge.s.r; row <= Math.min(merge.e.r, range.s.r + rowCount - 1); row += 1) {
      for (let column = merge.s.c; column <= Math.min(merge.e.c, range.s.c + columnCount - 1); column += 1) {
        if (row !== merge.s.r || column !== merge.s.c) covered.add(`${row}:${column}`);
      }
    }
  }

  const table = document.createElement("table");
  table.className = "spreadsheet-table";
  const colgroup = document.createElement("colgroup");
  for (let column = range.s.c; column < range.s.c + columnCount; column += 1) {
    const col = document.createElement("col");
    const declaredWidth = sheet?.["!cols"]?.[column]?.wpx || (sheet?.["!cols"]?.[column]?.wch || 12) * 7.4 + 18;
    col.style.width = `${Math.max(56, Math.min(560, declaredWidth))}px`;
    colgroup.append(col);
  }
  table.append(colgroup);
  const body = document.createElement("tbody");
  for (let row = range.s.r; row < range.s.r + rowCount; row += 1) {
    const tr = document.createElement("tr");
    const rowHeight = sheet?.["!rows"]?.[row]?.hpx || (sheet?.["!rows"]?.[row]?.hpt ? sheet["!rows"][row].hpt * 1.333 : 0);
    if (rowHeight) tr.style.height = `${Math.max(20, Math.min(400, rowHeight))}px`;
    for (let column = range.s.c; column < range.s.c + columnCount; column += 1) {
      const key = `${row}:${column}`;
      if (covered.has(key)) continue;
      const cell = sheet?.[xlsx.utils.encode_cell({ r: row, c: column })];
      const td = document.createElement("td");
      const merge = merges.get(key);
      if (merge) { td.rowSpan = merge.rowspan; td.colSpan = merge.colspan; }
      td.textContent = cell?.w ?? String(cell?.v ?? "");
      applySpreadsheetCellStyle(td, cell?.s);
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(body);
  container.append(table);
  if (range.e.r - range.s.r + 1 > rowCount || range.e.c - range.s.c + 1 > columnCount) {
    const notice = document.createElement("p");
    notice.className = "spreadsheet-limit-note";
    notice.textContent = "为保证页面流畅，当前预览显示前 1000 行、80 列。";
    container.append(notice);
  }
}

function applySpreadsheetCellStyle(cell, style) {
  if (!style || typeof style !== "object") return;
  const fill = spreadsheetColor(style.fill?.fgColor || style.fill?.bgColor);
  const color = spreadsheetColor(style.font?.color);
  if (fill) cell.style.backgroundColor = fill;
  if (color) cell.style.color = color;
  if (style.font?.bold || style.font?.b) cell.style.fontWeight = "700";
  if (style.font?.italic || style.font?.i) cell.style.fontStyle = "italic";
  if (style.font?.sz) cell.style.fontSize = `${Math.max(9, Math.min(28, Number(style.font.sz)))}pt`;
  const horizontal = style.alignment?.horizontal;
  if (["left", "center", "right"].includes(horizontal)) cell.style.textAlign = horizontal;
  const vertical = style.alignment?.vertical;
  if (["top", "center", "bottom"].includes(vertical)) cell.style.verticalAlign = vertical === "center" ? "middle" : vertical;
  if (style.alignment?.wrapText) cell.style.whiteSpace = "pre-wrap";
}

function spreadsheetColor(color) {
  const value = String(color?.rgb || color?.argb || "").replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(value) ? `#${value}` : /^[0-9a-f]{8}$/i.test(value) ? `#${value.slice(-6)}` : "";
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

function headingLevelForType(type) {
  const match = String(type || "").match(/^heading_([1-6])$/);
  return match ? Number(match[1]) : 0;
}

function normalizeMarkdownHeadingBlock(block) {
  if (block?.type !== "paragraph") return block;
  const match = String(block.text || "").trim().match(/^(#{1,6})\s+(.+)$/);
  return match ? { ...block, type: `heading_${match[1].length}`, text: match[2] } : block;
}

function blocksToMarkdown(blocks) {
  return (blocks || []).map((block, index) => {
    const text = richBlockToMarkdown(block);
    const headingLevel = headingLevelForType(block.type);
    if (headingLevel) return `${"#".repeat(headingLevel)} ${text}`;
    if (block.type === "quote" || block.type === "callout") return `> ${text}`;
    if (block.type === "to_do") return `- [${block.checked ? "x" : " "}] ${text}`;
    if (block.type === "bulleted_list_item") return `- ${text}`;
    if (block.type === "numbered_list_item") return `${index + 1}. ${text}`;
    if (block.type === "divider") return "---";
    if (block.type === "code") return `\`\`\`${block.language || ""}\n${text}\n\`\`\``;
    if (block.type === "table") return tableRowsToMarkdown(block.rows || []);
    if (block.type === "spreadsheet") return spreadsheetMarker(block.filename, block.url);
    if (block.type === "image") {
      const caption = normalizeImageCaption(block.caption);
      // Saved blocks have a signed Notion URL. Prefer it over a temporary
      // upload ID, which expires and must never be reused for later edits.
      if (block.url) return `![${caption}](${block.url})`;
      if (block.fileUploadId) return `![${caption}](notion-upload:${block.fileUploadId})`;
      return "";
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
    button.className = `toc-level-${heading.level}${heading.level > 1 ? " toc-child" : ""}`;
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
  const headings = elements.detailContent?.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]") || [];
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
  const wasClosed = elements.detailPanel.getAttribute("aria-hidden") !== "false";
  elements.detailPanel.setAttribute("aria-hidden", "false");
  if (wasClosed) setDetailToolsOpen(false);
  document.body.style.overflow = "hidden";
}

function closeDetail() {
  state.detailRequestId += 1;
  elements.detailPanel.setAttribute("aria-hidden", "true");
  setDetailToolsOpen(false);
  document.body.style.overflow = "";
  detailHeadingObserver?.disconnect();
}

function setDetailToolsOpen(open) {
  elements.detailCard?.classList.toggle("is-tools-open", open);
  if (elements.detailToolsToggle) {
    elements.detailToolsToggle.setAttribute("aria-expanded", String(open));
    elements.detailToolsToggle.textContent = open ? "收起工具" : "阅读工具";
  }
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

function detailUnavailableBlocks(error) {
  const message = error instanceof Error ? error.message : "详情服务暂时不可用。";
  return [
    { type: "heading_2", text: "正文暂时无法读取" },
    { type: "paragraph", text: "笔记的标题、摘要和归档信息仍然可用。请关闭详情后重试；若持续出现此提示，说明 Notion 详情代理需要重启或检查。" },
    { type: "quote", text: `读取结果：${message}` }
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
  if (window.location.hash !== "#notesLibrary") {
    window.location.hash = "#notesLibrary";
    return;
  }
  document.querySelector("#notesLibrary")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToKnowledgeMap() {
  if (window.location.hash !== "#knowledgeGraph") {
    window.location.hash = "#knowledgeGraph";
    return;
  }
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
