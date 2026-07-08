const apiBase = String(window.KG_CONFIG?.apiBase || "").replace(/\/$/, "");

const state = {
  notes: [],
  detailCache: new Map(),
  query: "",
  category: "all",
  tag: "all",
  sort: "updated"
};

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
    pinned: true
  },
  {
    id: "sample-2",
    title: "Notion 数据库字段设计",
    slug: "notion-database-fields",
    summary: "为公开笔记准备 Title、Summary、Category、Tags、Published、Slug 等字段。",
    category: "Notion",
    tags: ["数据库", "发布", "结构"],
    cover: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
    created: "2026-07-02",
    updated: "2026-07-07",
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
    pinned: false
  }
];

const elements = {
  totalNotes: document.querySelector("#totalNotes"),
  totalCategories: document.querySelector("#totalCategories"),
  totalTags: document.querySelector("#totalTags"),
  lastUpdated: document.querySelector("#lastUpdated"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  tagFilter: document.querySelector("#tagFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  refreshButton: document.querySelector("#refreshButton"),
  writerButton: document.querySelector("#writerButton"),
  writerPanel: document.querySelector("#writerPanel"),
  writerForm: document.querySelector("#writerForm"),
  writerToken: document.querySelector("#writerToken"),
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
  detailContent: document.querySelector("#detailContent")
};

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
});

elements.categoryFilter.addEventListener("change", (event) => {
  state.category = event.target.value;
  render();
});

elements.tagFilter.addEventListener("change", (event) => {
  state.tag = event.target.value;
  render();
});

elements.sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

elements.refreshButton.addEventListener("click", () => loadNotes({ refresh: true }));
elements.writerButton?.addEventListener("click", openWriter);
elements.writerForm?.addEventListener("submit", createNoteFromWriter);

document.querySelectorAll("[data-close-detail]").forEach((node) => {
  node.addEventListener("click", closeDetail);
});

document.querySelectorAll("[data-close-writer]").forEach((node) => {
  node.addEventListener("click", closeWriter);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDetail();
    closeWriter();
  }
});

loadNotes();

function openWriter() {
  elements.writerPanel?.setAttribute("aria-hidden", "false");
  if (elements.writerToken) {
    elements.writerToken.value = localStorage.getItem("kgAdminToken") || "";
  }
  if (elements.writerStatus) elements.writerStatus.textContent = "";
  document.body.style.overflow = "hidden";
}

function closeWriter() {
  elements.writerPanel?.setAttribute("aria-hidden", "true");
  if (elements.detailPanel?.getAttribute("aria-hidden") !== "false") {
    document.body.style.overflow = "";
  }
}

async function createNoteFromWriter(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const token = String(formData.get("token") || "").trim();
  const title = String(formData.get("title") || "").trim();

  if (!token || !title) {
    setWriterStatus("请先填写管理密码和标题。", true);
    return;
  }

  const payload = {
    title,
    slug: String(formData.get("slug") || "").trim(),
    summary: String(formData.get("summary") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    tags: splitTags(String(formData.get("tags") || "")),
    content: String(formData.get("content") || "").trim(),
    published: formData.get("published") === "on",
    pinned: formData.get("pinned") === "on"
  };

  submitButton.disabled = true;
  setWriterStatus("正在同步到 Notion...");

  try {
    const response = await fetch(`${apiBase}/api/admin/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "创建笔记失败");

    localStorage.setItem("kgAdminToken", token);
    form.reset();
    elements.writerToken.value = token;
    document.querySelector("#writerPublished").checked = true;
    setWriterStatus(`已同步：${data.note?.title || title}`);
    await loadNotes({ refresh: true });
  } catch (error) {
    setWriterStatus(error instanceof Error ? error.message : "创建笔记失败", true);
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
    category: String(note.category || "未分类"),
    tags: Array.isArray(note.tags) ? note.tags.map(String).filter(Boolean) : [],
    cover: String(note.cover || ""),
    created: String(note.created || ""),
    updated: String(note.updated || note.created || ""),
    pinned: Boolean(note.pinned),
    content: Array.isArray(note.content) ? note.content : []
  }));
}

function hydrateFilters() {
  const currentCategory = elements.categoryFilter.value;
  const currentTag = elements.tagFilter.value;
  const categories = unique(state.notes.map((note) => note.category).filter(Boolean));
  const tags = unique(state.notes.flatMap((note) => note.tags));

  fillSelect(elements.categoryFilter, "全部分类", categories);
  fillSelect(elements.tagFilter, "全部标签", tags);

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
  renderGrid(notes);
}

function filteredNotes() {
  const query = state.query;
  return [...state.notes]
    .filter((note) => state.category === "all" || note.category === state.category)
    .filter((note) => state.tag === "all" || note.tags.includes(state.tag))
    .filter((note) => {
      if (!query) return true;
      return [note.title, note.summary, note.category, ...note.tags].join(" ").toLowerCase().includes(query);
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
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const note of notes) fragment.append(createCard(note));
  elements.grid.append(fragment);
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
  category.textContent = note.category;
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
  if (note.cover) {
    elements.detailCover.src = note.cover;
    elements.detailCover.alt = `${note.title} 封面`;
    elements.detailCover.hidden = false;
  } else {
    elements.detailCover.hidden = true;
  }

  elements.detailCategory.textContent = note.category || "未分类";
  elements.detailUpdated.textContent = formatDate(note.updated);
  elements.detailTitle.textContent = note.title;
  elements.detailSummary.textContent = note.summary || "";
  renderTags(elements.detailTags, note.tags || []);
  renderBlocks(elements.detailContent, note.content || []);
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
  if (!blocks.length) {
    const empty = document.createElement("p");
    empty.textContent = "这篇笔记暂时没有可展示的正文。";
    container.append(empty);
    return;
  }

  for (const block of blocks) {
    container.append(renderBlock(block));
  }
}

function renderBlock(block) {
  const type = block.type || "paragraph";
  if (type === "divider") return document.createElement("hr");
  if (type === "bulleted_list_item" || type === "numbered_list_item") {
    const list = document.createElement(type === "numbered_list_item" ? "ol" : "ul");
    const item = document.createElement("li");
    item.textContent = block.text || "";
    list.append(item);
    return list;
  }
  if (type === "quote" || type === "callout") {
    const quote = document.createElement("blockquote");
    quote.textContent = block.text || "";
    return quote;
  }
  if (type === "code") {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = block.text || "";
    pre.append(code);
    return pre;
  }
  if (type === "heading_1" || type === "heading_2") {
    const heading = document.createElement("h2");
    heading.textContent = block.text || "";
    return heading;
  }
  if (type === "heading_3") {
    const heading = document.createElement("h3");
    heading.textContent = block.text || "";
    return heading;
  }
  const paragraph = document.createElement("p");
  paragraph.textContent = block.text || "";
  return paragraph;
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

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function setStatus(message) {
  elements.statusLine.textContent = message;
}
