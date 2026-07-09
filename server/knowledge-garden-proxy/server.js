import http from "node:http";

const PORT = Number(process.env.PORT || 3000);
const SERVICE_NAME = process.env.SERVICE_NAME || "knowledge-garden-proxy";
const NOTION_VERSION = process.env.NOTION_VERSION || "2022-06-28";
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 10 * 60 * 1000);
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || "https://ningyan1228.github.io,https://notes.101921.xyz,http://127.0.0.1:4173,http://localhost:4173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const SITE_PASSWORD = String(process.env.SITE_PASSWORD || "").trim();

const FIELDS = {
  title: ["Title", "\u6807\u9898", "Name", "\u540d\u79f0"],
  summary: ["Summary", "\u6458\u8981", "Description", "\u7b80\u4ecb"],
  category: ["Category", "\u5206\u7c7b", "Folder", "\u680f\u76ee"],
  tags: ["Tags", "\u6807\u7b7e", "Keywords", "\u5173\u952e\u8bcd"],
  type: ["Type", "\u7c7b\u578b", "Kind", "\u5185\u5bb9\u7c7b\u578b"],
  cover: ["Cover", "\u5c01\u9762", "Banner", "\u6a2a\u5e45\u56fe"],
  status: ["Status", "\u72b6\u6001"],
  published: ["Published", "\u662f\u5426\u516c\u5f00", "\u516c\u5f00"],
  pinned: ["Pinned", "\u7f6e\u9876"],
  slug: ["Slug", "slug", "\u77ed\u94fe\u63a5", "\u8def\u5f84"],
  created: ["Created", "\u521b\u5efa\u65f6\u95f4"],
  updated: ["Updated", "\u66f4\u65b0\u65f6\u95f4"],
  studyMinutes: ["Study Minutes", "Reading Minutes", "\u5b66\u4e60\u65f6\u957f", "\u9605\u8bfb\u65f6\u95f4", "\u5b66\u4e60\u5206\u949f", "\u65f6\u957f"]
};

let cachedAt = 0;
let cachedPages = null;
let cachedDatabaseProperties = null;

const server = http.createServer(async (req, res) => {
  try {
    setCors(req, res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      sendJson(res, 200, {
        ok: true,
        service: SERVICE_NAME,
        time: new Date().toISOString()
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/uploads") {
      if (!isAdminRequest(req)) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }

      const input = await readJsonBody(req, 8 * 1024 * 1024);
      const upload = await uploadImageToNotion(input);
      sendJson(res, 201, upload);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/notes") {
      if (!isAdminRequest(req)) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }

      const input = await readJsonBody(req);
      const page = await createNotionNoteV2(input);
      cachedPages = null;
      cachedAt = 0;

      sendJson(res, 201, {
        note: normalizeNote(page)
      });
      return;
    }

    const adminDetailMatch = url.pathname.match(/^\/api\/admin\/notes\/([^/]+)$/);
    if ((req.method === "PUT" || req.method === "PATCH") && adminDetailMatch) {
      if (!isAdminRequest(req)) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }

      const key = decodeURIComponent(adminDetailMatch[1]);
      const input = await readJsonBody(req);
      const page = await updateNotionNote(key, input);
      cachedPages = null;
      cachedAt = 0;

      const blocks = await listBlocks(page.id);
      sendJson(res, 200, {
        note: {
          ...normalizeNote(page),
          content: blocks.map(normalizeBlock).filter(Boolean)
        }
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/notes") {
      if (!isSiteAccessRequest(req)) {
        sendJson(res, 401, { error: "访问密码不正确", requiresAccess: true });
        return;
      }

      const force = url.searchParams.get("refresh") === "1";
      const pages = await getPublishedPages(force);
      const notes = pages.map(normalizeNote).filter((note) => note.title);

      sendJson(res, 200, {
        notes,
        cached: !force && cachedPages !== null && Date.now() - cachedAt < CACHE_TTL_MS,
        updatedAt: new Date(cachedAt || Date.now()).toISOString()
      });
      return;
    }

    const detailMatch = url.pathname.match(/^\/api\/notes\/([^/]+)$/);
    if (req.method === "GET" && detailMatch) {
      if (!isSiteAccessRequest(req)) {
        sendJson(res, 401, { error: "访问密码不正确", requiresAccess: true });
        return;
      }

      const key = decodeURIComponent(detailMatch[1]);
      const page = await findPublishedPage(key);
      if (!page) {
        sendJson(res, 404, { error: "Note not found" });
        return;
      }

      const blocks = await listBlocks(page.id);
      sendJson(res, 200, {
        note: {
          ...normalizeNote(page),
          content: blocks.map(normalizeBlock).filter(Boolean)
        }
      });
      return;
    }

    sendJson(res, 404, { error: "Not Found" });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
  }
});

server.listen(PORT, () => {
  console.log(`${SERVICE_NAME} listening on ${PORT}`);
});

async function getPublishedPages(force = false) {
  const now = Date.now();
  if (!force && cachedPages && now - cachedAt < CACHE_TTL_MS) {
    return cachedPages;
  }

  const pages = await queryAllPages();
  cachedPages = pages.filter(isPublished);
  cachedAt = now;
  return cachedPages;
}

async function findPublishedPage(key) {
  if (isNotionId(key)) {
    const page = await notionRequest(`pages/${extractNotionId(key)}`, "GET");
    return isPublished(page) ? page : null;
  }

  const pages = await getPublishedPages(false);
  return pages.find((page) => {
    const note = normalizeNote(page);
    return note.slug === key || note.id === key;
  }) || null;
}

async function queryAllPages() {
  const pages = [];
  let startCursor;

  do {
    const body = {
      page_size: 100,
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }]
    };
    if (startCursor) body.start_cursor = startCursor;

    const data = await notionRequest(queryPath(), "POST", body);
    pages.push(...(data.results || []));
    startCursor = data.has_more ? data.next_cursor : undefined;
  } while (startCursor);

  return pages;
}

async function listBlocks(blockId) {
  const blocks = [];
  let startCursor;

  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (startCursor) query.set("start_cursor", startCursor);

    const data = await notionRequest(`blocks/${blockId}/children?${query.toString()}`, "GET");
    blocks.push(...(data.results || []));
    startCursor = data.has_more ? data.next_cursor : undefined;
  } while (startCursor);

  return blocks;
}

async function uploadImageToNotion(input) {
  const dataUrl = cleanText(input?.dataUrl);
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|gif|webp));base64,([a-z0-9+/=]+)$/i);
  if (!match) throw new Error("Only pasted image data URLs are supported");

  const mimeType = match[1].toLowerCase();
  const extension = imageExtension(mimeType);
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 7 * 1024 * 1024) {
    throw new Error("Image must be smaller than 7MB");
  }

  const filename = safeFilename(input?.filename, extension);
  const upload = await notionRequest("file_uploads", "POST", {
    mode: "single_part",
    filename,
    content_type: mimeType
  });
  await sendNotionFileUpload(upload.id, buffer, filename, mimeType);

  return {
    fileUploadId: upload.id,
    markdown: `![${cleanText(input?.alt) || "粘贴图片"}](notion-upload:${upload.id})`,
    filename,
    mimeType,
    size: buffer.length
  };
}

async function sendNotionFileUpload(fileUploadId, buffer, filename, mimeType) {
  const token = requiredEnv("NOTION_TOKEN");
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), filename);

  const response = await fetch(`https://api.notion.com/v1/file_uploads/${fileUploadId}/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION
    },
    body: form
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.message || `Notion file upload failed: ${response.status}`);
  }
  return data;
}

function imageExtension(mimeType) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "jpg";
}

function safeFilename(value, extension) {
  const base = cleanText(value)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "pasted-image"}-${Date.now()}.${extension}`;
}

async function findPageForAdmin(key) {
  if (isNotionId(key)) return notionRequest(`pages/${extractNotionId(key)}`, "GET");

  const pages = await queryAllPages();
  return pages.find((page) => {
    const note = normalizeNote(page);
    return note.slug === key || note.id === key;
  }) || null;
}

async function updateNotionNote(key, input) {
  const page = await findPageForAdmin(key);
  if (!page) throw new Error("Note not found");

  const properties = await buildNoteProperties(input, { includeCreated: false });
  const updated = await notionRequest(`pages/${page.id}`, "PATCH", { properties });

  if (Object.prototype.hasOwnProperty.call(input || {}, "content")) {
    await replacePageBlocks(page.id, markdownToBlocks(input?.content || input?.summary || input?.title || ""));
  }

  return updated;
}

async function replacePageBlocks(pageId, blocks) {
  const existingBlocks = await listBlocks(pageId);
  for (const block of existingBlocks) {
    await notionRequest(`blocks/${block.id}`, "PATCH", { archived: true });
  }

  if (!blocks.length) return;
  for (let index = 0; index < blocks.length; index += 90) {
    await notionRequest(`blocks/${pageId}/children`, "PATCH", {
      children: blocks.slice(index, index + 90)
    });
  }
}

async function buildNoteProperties(input, options = {}) {
  const title = cleanText(input?.title);
  if (!title) throw new Error("Missing title");

  const today = new Date().toISOString().slice(0, 10);
  const summary = cleanText(input?.summary);
  const noteType = cleanText(input?.type) || "笔记";
  const category = cleanText(input?.category);
  const tags = normalizeTags(input?.tags);
  const slug = cleanText(input?.slug) || slugify(title);
  const cover = cleanText(input?.cover);
  const published = Boolean(input?.published);
  const pinned = Boolean(input?.pinned);
  const status = cleanText(input?.status) || (published ? "完成" : "进行中");
  const studyMinutes = Number(input?.studyMinutes || 0);

  const properties = {
    "标题": { title: richTextChunks(title) },
    "摘要": { rich_text: richTextChunks(summary) },
    "是否公开": { checkbox: published },
    "置顶": { checkbox: pinned },
    "状态": { status: { name: status } },
    "更新时间": { date: { start: today } }
  };

  if (options.includeCreated) properties["创建时间"] = { date: { start: today } };

  const slugProperty = await optionalDatabaseProperty(FIELDS.slug, "rich_text");
  if (slugProperty) properties[slugProperty] = { rich_text: richTextChunks(slug) };
  const typeProperty = await optionalDatabaseProperty(FIELDS.type, "select");
  if (typeProperty) properties[typeProperty] = { select: { name: noteType } };
  if (category) properties["分类"] = { select: { name: category } };
  if (tags.length) properties["标签"] = { multi_select: tags.map((name) => ({ name })) };
  const studyMinutesProperty = studyMinutes > 0 ? await optionalDatabaseProperty(FIELDS.studyMinutes, "number") : "";
  if (studyMinutesProperty) properties[studyMinutesProperty] = { number: studyMinutes };
  const uploadedCover = cover.match(/^notion-upload:([a-f0-9-]+)$/i);
  if (uploadedCover) {
    properties["封面"] = {
      files: [{ name: "cover", type: "file_upload", file_upload: { id: uploadedCover[1] } }]
    };
  } else if (cover && /^https?:\/\//i.test(cover)) {
    properties["封面"] = {
      files: [{ name: "cover", type: "external", external: { url: cover } }]
    };
  }

  return properties;
}

async function createNotionNoteV2(input) {
  const title = cleanText(input?.title);
  if (!title) throw new Error("Missing title");

  const summary = cleanText(input?.summary);
  const content = cleanText(input?.content);
  const properties = await buildNoteProperties(input, { includeCreated: true });

  return notionRequest("pages", "POST", {
    parent: { database_id: extractNotionId(requiredEnv("NOTION_DATABASE_ID")) },
    properties,
    children: markdownToBlocks(content || summary || title)
  });
}

async function createNotionNote(input) {
  const title = cleanText(input?.title);
  if (!title) throw new Error("Missing title");

  const today = new Date().toISOString().slice(0, 10);
  const summary = cleanText(input?.summary);
  const noteType = cleanText(input?.type) || "笔记";
  const category = cleanText(input?.category);
  const tags = normalizeTags(input?.tags);
  const slug = cleanText(input?.slug) || slugify(title);
  const cover = cleanText(input?.cover);
  const published = Boolean(input?.published);
  const pinned = Boolean(input?.pinned);
  const status = cleanText(input?.status) || (published ? "完成" : "进行中");
  const content = cleanText(input?.content);
  const studyMinutes = Number(input?.studyMinutes || 0);

  const properties = {
    "标题": { title: richTextChunks(title) },
    "摘要": { rich_text: richTextChunks(summary) },
    "是否公开": { checkbox: published },
    "置顶": { checkbox: pinned },
    "状态": { status: { name: status } },
    "创建时间": { date: { start: today } },
    "更新时间": { date: { start: today } }
  };

  const slugProperty = await optionalDatabaseProperty(FIELDS.slug, "rich_text");
  if (slugProperty) properties[slugProperty] = { rich_text: richTextChunks(slug) };
  const typeProperty = await optionalDatabaseProperty(FIELDS.type, "select");
  if (typeProperty) properties[typeProperty] = { select: { name: noteType } };
  if (category) properties["分类"] = { select: { name: category } };
  if (tags.length) properties["标签"] = { multi_select: tags.map((name) => ({ name })) };
  const studyMinutesProperty = studyMinutes > 0 ? await optionalDatabaseProperty(FIELDS.studyMinutes, "number") : "";
  if (studyMinutesProperty) properties[studyMinutesProperty] = { number: studyMinutes };
  if (cover && /^https?:\/\//i.test(cover)) {
    properties["封面"] = {
      files: [{ name: "cover", type: "external", external: { url: cover } }]
    };
  }

  return notionRequest("pages", "POST", {
    parent: { database_id: extractNotionId(requiredEnv("NOTION_DATABASE_ID")) },
    properties,
    children: markdownToBlocks(content || summary || title)
  });
}

function markdownToBlocks(markdown) {
  const blocks = [];
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  let paragraph = [];
  let inCode = false;
  let codeLines = [];

  const flushParagraph = () => {
    const text = paragraph.join("\n").trim();
    paragraph = [];
    if (text) {
      for (const part of splitText(text)) {
        blocks.push(paragraphBlock(part));
      }
    }
  };

  const flushCode = () => {
    const text = codeLines.join("\n");
    codeLines = [];
    blocks.push({
      object: "block",
      type: "code",
      code: {
        rich_text: richTextChunks(text),
        language: "plain text"
      }
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith("```")) {
      if (inCode) flushCode();
      else flushParagraph();
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
      blocks.push({ object: "block", type: "divider", divider: {} });
      continue;
    }

    const uploadImage = trimmed.match(/^!\[([^\]]*)\]\(notion-upload:([a-f0-9-]+)\)$/i);
    if (uploadImage) {
      flushParagraph();
      blocks.push({
        object: "block",
        type: "image",
        image: {
          type: "file_upload",
          file_upload: { id: uploadImage[2] },
          caption: uploadImage[1] ? richTextChunks(uploadImage[1]) : []
        }
      });
      continue;
    }

    const image = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)$/i);
    if (image) {
      flushParagraph();
      blocks.push({
        object: "block",
        type: "image",
        image: {
          type: "external",
          external: { url: image[2] },
          caption: image[1] ? richTextChunks(image[1]) : []
        }
      });
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const type = `heading_${heading[1].length}`;
      blocks.push({
        object: "block",
        type,
        [type]: { rich_text: richTextChunks(heading[2]) }
      });
      continue;
    }

    const quote = trimmed.match(/^>\s+(.+)$/);
    if (quote) {
      flushParagraph();
      blocks.push({
        object: "block",
        type: "quote",
        quote: { rich_text: richTextChunks(quote[1]) }
      });
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: richTextChunks(bullet[1]) }
      });
      continue;
    }

    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      blocks.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: { rich_text: richTextChunks(numbered[1]) }
      });
      continue;
    }

    paragraph.push(line);
  }

  if (inCode) flushCode();
  flushParagraph();

  return blocks.slice(0, 90);
}

function paragraphBlock(text) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: richTextChunks(text) }
  };
}

function richTextChunks(value) {
  const text = String(value || "");
  if (!text) return [];
  return splitText(text, 1900).map((content) => ({
    type: "text",
    text: { content }
  }));
}

function splitText(value, size = 1900) {
  const text = String(value || "");
  const chunks = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks.length ? chunks : [""];
}

async function notionRequest(path, method, body) {
  const token = requiredEnv("NOTION_TOKEN");
  const response = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.message || `Notion API failed: ${response.status}`);
  }
  return data;
}

function queryPath() {
  const dataSourceId = optionalEnv("NOTION_DATA_SOURCE_ID");
  if (dataSourceId) return `data_sources/${extractNotionId(dataSourceId)}/query`;
  return `databases/${extractNotionId(requiredEnv("NOTION_DATABASE_ID"))}/query`;
}

function normalizeNote(page) {
  const props = page.properties || {};
  const title = textProp(pick(props, FIELDS.title));
  const slug = textProp(pick(props, FIELDS.slug));

  return {
    id: page.id,
    title,
    slug: slug || slugify(title) || page.id,
    summary: textProp(pick(props, FIELDS.summary)),
    type: optionProp(pick(props, FIELDS.type)) || "笔记",
    category: optionProp(pick(props, FIELDS.category)) || "\u672a\u5206\u7c7b",
    tags: multiSelectProp(pick(props, FIELDS.tags)),
    cover: coverUrl(page, pick(props, FIELDS.cover)),
    status: optionProp(pick(props, FIELDS.status)),
    created: dateProp(pick(props, FIELDS.created)) || page.created_time || "",
    updated: dateProp(pick(props, FIELDS.updated)) || page.last_edited_time || "",
    studyMinutes: numberProp(pick(props, FIELDS.studyMinutes)),
    pinned: checkboxProp(pick(props, FIELDS.pinned)),
    notionUrl: page.url || ""
  };
}

function normalizeBlock(block) {
  const type = block.type || "";
  if (type === "divider") return { id: block.id, type };
  if (type === "image") {
    return {
      id: block.id,
      type,
      url: block.image?.external?.url || block.image?.file?.url || "",
      fileUploadId: block.image?.file_upload?.id || "",
      caption: richText(block.image?.caption)
    };
  }

  const text = blockText(block);
  if (!text) return null;

  if (
    [
      "paragraph",
      "heading_1",
      "heading_2",
      "heading_3",
      "quote",
      "callout",
      "bulleted_list_item",
      "numbered_list_item",
      "code"
    ].includes(type)
  ) {
    return {
      id: block.id,
      type,
      text,
      language: block.code?.language || "",
      icon: block.callout?.icon?.emoji || ""
    };
  }

  return { id: block.id, type: "paragraph", text };
}

function blockText(block) {
  const type = block.type || "";
  if (type === "paragraph") return richText(block.paragraph?.rich_text);
  if (type === "heading_1") return richText(block.heading_1?.rich_text);
  if (type === "heading_2") return richText(block.heading_2?.rich_text);
  if (type === "heading_3") return richText(block.heading_3?.rich_text);
  if (type === "quote") return richText(block.quote?.rich_text);
  if (type === "callout") return richText(block.callout?.rich_text);
  if (type === "bulleted_list_item") return richText(block.bulleted_list_item?.rich_text);
  if (type === "numbered_list_item") return richText(block.numbered_list_item?.rich_text);
  if (type === "code") return richText(block.code?.rich_text);
  return "";
}

function isAdminRequest(req) {
  const expected = requiredEnv("ADMIN_TOKEN");
  const authorization = String(req.headers.authorization || "");
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const headerToken = String(req.headers["x-admin-token"] || "").trim();
  return Boolean(expected && (bearer === expected || headerToken === expected));
}

function isSiteAccessRequest(req) {
  if (!SITE_PASSWORD) return true;
  const headerPassword = String(req.headers["x-site-password"] || "").trim();
  return headerPassword === SITE_PASSWORD;
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error("Request body too large");
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(text);
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).slice(0, 12);
  return String(value || "")
    .split(/[,，、\n]/)
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 12);
}

function isPublished(page) {
  return checkboxProp(pick(page.properties || {}, FIELDS.published));
}

function pick(props, names) {
  return names.map((name) => props[name]).find(Boolean);
}

function richText(value) {
  return (value || []).map((item) => item.plain_text || "").join("");
}

function textProp(prop) {
  return richText([...(prop?.title || []), ...(prop?.rich_text || [])]);
}

function optionProp(prop) {
  return prop?.select?.name || prop?.status?.name || "";
}

function multiSelectProp(prop) {
  return (prop?.multi_select || []).map((item) => item.name || "").filter(Boolean);
}

function checkboxProp(prop) {
  return Boolean(prop?.checkbox);
}

function numberProp(prop) {
  return Number(prop?.number || 0);
}

function dateProp(prop) {
  return prop?.date?.start || prop?.created_time || prop?.last_edited_time || "";
}

async function optionalDatabaseProperty(names, type) {
  try {
    const props = await getDatabaseProperties();
    const name = names.find((item) => props[item]);
    if (!name) return "";
    return !type || props[name]?.type === type ? name : "";
  } catch {
    return "";
  }
}

async function getDatabaseProperties() {
  if (cachedDatabaseProperties) return cachedDatabaseProperties;
  const database = await notionRequest(`databases/${extractNotionId(requiredEnv("NOTION_DATABASE_ID"))}`, "GET");
  cachedDatabaseProperties = database.properties || {};
  return cachedDatabaseProperties;
}

function coverUrl(page, prop) {
  const pageCover = page.cover?.external?.url || page.cover?.file?.url;
  if (pageCover) return pageCover;
  const file = prop?.files?.[0];
  return file?.external?.url || file?.file?.url || prop?.url || "";
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isNotionId(value) {
  return /^[a-f0-9-]{32,36}$/i.test(value);
}

function extractNotionId(value) {
  const match = String(value || "").match(/[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
  if (!match) throw new Error("Invalid Notion database or data source ID");
  return match[0].replace(/-/g, "");
}

function requiredEnv(name) {
  const value = optionalEnv(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function optionalEnv(name) {
  return String(process.env[name] || "").trim();
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.has("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Admin-Token,X-Site-Password");
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": status === 200 ? "public, max-age=60, s-maxage=600" : "no-store"
  });
  res.end(JSON.stringify(data));
}
