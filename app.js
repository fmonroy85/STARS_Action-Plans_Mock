const markdownPath = "FMonroy_Action_Plan_2023/FMonroy_Action_Plan_2023.md";
const root = document.getElementById("content-root");
const tocList = document.getElementById("toc-list");

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function resolveUrl(url, base) {
  if (!url) return "";
  if (/^(https?:)?\/\//i.test(url) || url.startsWith("mailto:") || url.startsWith("#")) {
    return url;
  }
  try {
    return new URL(url, base).toString();
  } catch (error) {
    return url;
  }
}

function renderInline(text, base) {
  let html = text;

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
    const resolved = resolveUrl(src, base);
    return `<img src="${resolved}" alt="${alt.trim() || "Figure illustration"}" loading="lazy" />`;
  });

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const resolved = resolveUrl(href, base);
    return `<a href="${resolved}">${label}</a>`;
  });

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return html;
}

function parseMarkdown(markdown, base) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks = [];
  const headings = [];
  let paragraphLines = [];
  let listItems = [];
  let listType = "ul";
  let blockquoteLines = [];
  let tableRows = [];

  const flushParagraph = () => {
    if (paragraphLines.length) {
      const text = paragraphLines.join(" ").trim();
      if (text) {
        blocks.push({ type: "paragraph", content: renderInline(text, base) });
      }
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (listItems.length) {
      const tag = listType === "ol" ? "ol" : "ul";
      blocks.push({ type: "list", tag, items: listItems });
      listItems = [];
    }
  };

  const flushBlockquote = () => {
    if (blockquoteLines.length) {
      blocks.push({ type: "blockquote", content: renderInline(blockquoteLines.join(" "), base) });
      blockquoteLines = [];
    }
  };

  const flushTable = () => {
    if (tableRows.length) {
      blocks.push({ type: "table", rows: tableRows });
      tableRows = [];
    }
  };

  const pushHeading = (level, text) => {
    const title = renderInline(text, base);
    const id = slugify(text);
    headings.push({ level, id, title });
    blocks.push({ type: "heading", level, id, title });
  };

  const isTableRow = (line) => line.includes("|") && !line.trim().startsWith("<") && !line.trim().startsWith("[");

  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i].trimEnd();
    const raw = line.trim();

    if (!raw) {
      flushParagraph();
      flushList();
      flushBlockquote();
      flushTable();
      continue;
    }

    if (/^#{1,6}\s+/.test(raw)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      flushTable();
      const level = raw.match(/^#+/)[0].length;
      const text = raw.replace(/^#{1,6}\s+/, "");
      pushHeading(level, text);
      continue;
    }

    if (raw.startsWith(">")) {
      flushParagraph();
      flushList();
      flushTable();
      blockquoteLines.push(raw.replace(/^>\s?/, ""));
      continue;
    }

    if (/^([-*+]\s)/.test(raw)) {
      flushParagraph();
      flushBlockquote();
      flushTable();
      listType = "ul";
      listItems.push(raw.replace(/^[-*+]\s/, ""));
      continue;
    }

    if (/^\d+\.\s/.test(raw)) {
      flushParagraph();
      flushBlockquote();
      flushTable();
      listType = "ol";
      listItems.push(raw.replace(/^\d+\.\s/, ""));
      continue;
    }

    if (isTableRow(raw) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1].trim())) {
      flushParagraph();
      flushList();
      flushBlockquote();
      tableRows.push(raw.split("|").slice(1, -1).map((cell) => cell.trim()));
      continue;
    }

    if (tableRows.length && isTableRow(raw)) {
      tableRows.push(raw.split("|").slice(1, -1).map((cell) => cell.trim()));
      continue;
    }

    if (tableRows.length) {
      flushTable();
    }

    paragraphLines.push(raw);
  }

  flushParagraph();
  flushList();
  flushBlockquote();
  flushTable();

  return { blocks, headings };
}

function renderBlocks(parsed, base) {
  const frag = document.createDocumentFragment();

  parsed.blocks.forEach((block) => {
    if (block.type === "heading") {
      const tag = `h${Math.min(block.level, 6)}`;
      const el = document.createElement(tag);
      el.id = block.id;
      el.innerHTML = block.title;
      frag.appendChild(el);
      return;
    }

    if (block.type === "paragraph") {
      const el = document.createElement("p");
      el.innerHTML = block.content;
      frag.appendChild(el);
      return;
    }

    if (block.type === "list") {
      const el = document.createElement(block.tag);
      block.items.forEach((item) => {
        const li = document.createElement("li");
        li.innerHTML = renderInline(item, base);
        el.appendChild(li);
      });
      frag.appendChild(el);
      return;
    }

    if (block.type === "blockquote") {
      const el = document.createElement("blockquote");
      el.innerHTML = block.content;
      frag.appendChild(el);
      return;
    }

    if (block.type === "table") {
      const table = document.createElement("table");
      const tbody = document.createElement("tbody");
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      block.rows[0].forEach((cell) => {
        const th = document.createElement("th");
        th.innerHTML = renderInline(cell, base);
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      block.rows.slice(1).forEach((row) => {
        const tr = document.createElement("tr");
        row.forEach((cell) => {
          const td = document.createElement("td");
          td.innerHTML = renderInline(cell, base);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      frag.appendChild(table);
    }
  });

  return frag;
}

function renderToc(headings) {
  tocList.innerHTML = "";
  headings.forEach((heading) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.title.replace(/<[^>]*>/g, "");
    li.appendChild(link);
    tocList.appendChild(li);
  });
}

async function loadContent() {
  try {
    const response = await fetch(markdownPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load markdown (${response.status})`);
    const markdown = await response.text();
    const parsed = parseMarkdown(markdown, new URL(markdownPath, window.location.href));
    root.appendChild(renderBlocks(parsed, new URL(markdownPath, window.location.href)));
    renderToc(parsed.headings.filter((heading) => heading.level <= 3));
  } catch (error) {
    root.innerHTML = `<p>Unable to load the markdown content. ${error.message}</p>`;
  }
}

loadContent();
