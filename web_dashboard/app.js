const formatMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const formatNumber = new Intl.NumberFormat("en-US");
const formatPercent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

const accentBySegment = {
  All: "#2d9cdb",
  Consumer: "#4dabf7",
  Corporate: "#36c275",
  "Home Office": "#f4d35e",
  "Small Business": "#f05d5e",
};

const segmentLabels = {
  All: "كل العملاء",
  Consumer: "الأفراد",
  Corporate: "الشركات",
  "Home Office": "المكاتب المنزلية",
  "Small Business": "الأعمال الصغيرة",
};

const regionLabels = {
  Ontario: "أونتاريو",
  Prarie: "البراري",
  West: "الغرب",
  Atlantic: "الأطلسي",
  Quebec: "كيبيك",
  "Northwest Territories": "الأقاليم الشمالية الغربية",
  Yukon: "يوكون",
  Nunavut: "نونافوت",
  Unspecified: "غير محدد",
};

const categoryLabels = {
  Technology: "التقنية",
  Furniture: "الأثاث",
  "Office Supplies": "مستلزمات مكتبية",
  Unspecified: "غير محدد",
};

const subcategoryLabels = {
  "Office Machines": "أجهزة مكتبية",
  Tables: "طاولات",
  "Telephones and Communication": "هواتف واتصالات",
  "Chairs & Chairmats": "كراسي ومساند",
  "Copiers and Fax": "ناسخات وفاكس",
  "Binders and Binder Accessories": "ملفات وإكسسوارات",
  "Storage & Organization": "تخزين وتنظيم",
  Appliances: "أجهزة",
  Paper: "ورق",
  "Computer Peripherals": "ملحقات حاسب",
  Bookcases: "خزائن كتب",
  "Office Furnishings": "تجهيزات مكتبية",
  "Pens & Art Supplies": "أقلام وأدوات",
  Envelopes: "مظاريف",
  Labels: "ملصقات",
  "Scissors, Rulers and Trimmers": "مقصات ومساطر",
  "Rubber Bands": "أربطة مطاطية",
};

function labelValue(value, dictionary = {}) {
  return dictionary[value] || value || "غير محدد";
}

let rawRows = [];
let activeSegment = "All";
let activeReport = "monthly";
let dateFilters = { year: "All", month: "All", week: "All" };

const byId = (id) => document.getElementById(id);
const unique = (rows, key) => [...new Set(rows.map((row) => row[key]).filter((value) => value !== "" && value != null))].sort((a, b) => a - b);

if (Array.isArray(window.SALES_TRANSACTIONS)) {
  bootDashboard(window.SALES_TRANSACTIONS);
} else {
  fetch("data/sales_transactions.json")
    .then((response) => response.json())
    .then(bootDashboard)
    .catch(() => {
      document.body.classList.add("data-error");
    });
}

function bootDashboard(rows) {
  rawRows = rows.map(normalizeRow).filter(Boolean);
  initNavigation();
  initControls();
  tickClock();
  setInterval(tickClock, 30000);
  updateDashboard();
  if (location.hash) {
    const page = location.hash.replace("#", "");
    if (document.querySelector(`[data-page-panel="${page}"]`)) {
      showPage(page);
      renderCurrentPage(currentRows());
    }
  }
}

function normalizeRow(row) {
  const date = row.date ? new Date(row.date) : parseDate(row["Order Date"]);
  if (!date || Number.isNaN(date.getTime())) return null;
  const year = Number(row.year ?? row["Order Year"] ?? date.getFullYear());
  const month = Number(row.month ?? row["Order Month"] ?? date.getMonth() + 1);
  return {
    date: date.toISOString().slice(0, 10),
    orderId: String(row.orderId ?? row["Order ID"] ?? `${date.toISOString()}-${Math.random()}`),
    year,
    month,
    week: Number(row.week ?? getIsoWeek(date)),
    segment: String(row.segment ?? row["Customer Segment"] ?? "Unspecified"),
    region: String(row.region ?? row.Region ?? "Unspecified"),
    category: String(row.category ?? row["Product Category"] ?? "Unspecified"),
    subcategory: String(row.subcategory ?? row["Product Sub-Category"] ?? "Unspecified"),
    sales: Number(row.sales ?? row.Sales ?? 0) || 0,
    profit: Number(row.profit ?? row.Profit ?? 0) || 0,
    discount: Number(row.discount ?? row.Discount ?? 0) || 0,
    quantity: Number(row.quantity ?? row["Order Quantity"] ?? 0) || 0,
  };
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const parts = String(value).split(/[/-]/).map(Number);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    return c > 1900 ? new Date(c, a - 1, b) : new Date(a, b - 1, c);
  }
  return null;
}

function getIsoWeek(date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  copy.setUTCDate(copy.getUTCDate() + 4 - (copy.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return Math.ceil(((copy - yearStart) / 86400000 + 1) / 7);
}

function initNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      const page = button.dataset.page;
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item === button));
      document.querySelectorAll(".page").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.pagePanel === page));
      history.replaceState(null, "", `#${page}`);
      renderCurrentPage(currentRows());
    });
  });
}

function initControls() {
  renderSegmentFilters();
  renderTimeFilters();
  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      activeSegment = button.dataset.segment;
      updateDashboard();
    });
  });
  ["yearFilter", "monthFilter", "weekFilter"].forEach((id) => {
    byId(id).addEventListener("change", () => {
      dateFilters = {
        year: byId("yearFilter").value,
        month: byId("monthFilter").value,
        week: byId("weekFilter").value,
      };
      updateDashboard();
    });
  });
  byId("clearFiltersBtn").addEventListener("click", () => {
    dateFilters = { year: "All", month: "All", week: "All" };
    activeSegment = "All";
    updateDashboard();
  });
  byId("exportPdfBtn").addEventListener("click", () => window.print());
  byId("reportPdfBtn").addEventListener("click", () => window.print());
  byId("reportCsvBtn").addEventListener("click", exportReportCsv);
  byId("reportJsonBtn").addEventListener("click", exportReportJson);
  document.querySelectorAll(".link-action").forEach((button) => {
    button.addEventListener("click", () => {
      activeReport = button.dataset.report;
      showPage("reports");
      renderReport(currentRows());
    });
  });
}

function renderSegmentFilters() {
  const segments = [...new Set(rawRows.map((row) => row.segment))].sort();
  byId("segmentFilters").innerHTML = segments
    .map((segment) => `<button class="filter-btn" data-segment="${segment}" type="button">${labelValue(segment, segmentLabels)}</button>`)
    .join("");
}

function renderTimeFilters() {
  const years = unique(rawRows, "year");
  const months = Array.from({ length: 12 }, (_, index) => index + 1);
  const weeks = Array.from({ length: 53 }, (_, index) => index + 1);
  byId("yearFilter").innerHTML = optionList("كل السنوات", years, "سنة");
  byId("monthFilter").innerHTML = optionList("كل الشهور", months, "شهر");
  byId("weekFilter").innerHTML = optionList("كل الأسابيع", weeks, "أسبوع");
}

function optionList(allLabel, values, label) {
  return `<option value="All">${allLabel}</option>${values.map((value) => `<option value="${value}">${label} ${value}</option>`).join("")}`;
}

function syncControls() {
  byId("yearFilter").value = dateFilters.year;
  byId("monthFilter").value = dateFilters.month;
  byId("weekFilter").value = dateFilters.week;
  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.segment === activeSegment);
  });
  byId("periodLabel").textContent = describePeriod();
}

function describePeriod() {
  const parts = [];
  if (dateFilters.year !== "All") parts.push(`سنة ${dateFilters.year}`);
  if (dateFilters.month !== "All") parts.push(`شهر ${dateFilters.month}`);
  if (dateFilters.week !== "All") parts.push(`أسبوع ${dateFilters.week}`);
  return parts.length ? parts.join(" / ") : `${Math.min(...unique(rawRows, "year"))} - ${Math.max(...unique(rawRows, "year"))}`;
}

function currentRows() {
  return rawRows.filter((row) => {
    if (activeSegment !== "All" && row.segment !== activeSegment) return false;
    if (dateFilters.year !== "All" && row.year !== Number(dateFilters.year)) return false;
    if (dateFilters.month !== "All" && row.month !== Number(dateFilters.month)) return false;
    if (dateFilters.week !== "All" && row.week !== Number(dateFilters.week)) return false;
    return true;
  });
}

function updateDashboard() {
  syncControls();
  const rows = currentRows();
  const data = aggregate(rows);
  const accent = accentBySegment[activeSegment] || accentBySegment.All;
  document.documentElement.style.setProperty("--accent", accent);
  byId("activeSegmentLabel").textContent = labelValue(activeSegment, segmentLabels);
  byId("salesSub").textContent = labelValue(activeSegment, segmentLabels);
  byId("profitSub").textContent = data.metrics.profit >= 0 ? "ربح إيجابي" : "تنبيه خسارة";
  byId("marginSub").textContent = data.metrics.margin >= 0.1 ? "هامش قوي" : "يحتاج متابعة";
  renderKpis(data.metrics);
  drawTrend("trendChart", data.monthly);
  renderRegionBars(data.region);
  renderCategoryCards(data.category);
  drawDiscount("discountChart", data.discount);
  renderRanks(data.topSubcategories);
  renderCurrentPage(rows);
  triggerReaction();
}

function aggregate(rows) {
  const metrics = {
    sales: sum(rows, "sales"),
    profit: sum(rows, "profit"),
    orders: new Set(rows.map((row) => row.orderId)).size,
    margin: 0,
    avgDiscount: rows.length ? sum(rows, "discount") / rows.length : 0,
    quantity: sum(rows, "quantity"),
  };
  metrics.margin = metrics.sales ? metrics.profit / metrics.sales : 0;
  return {
    metrics,
    monthly: groupTime(rows, "month"),
    weekly: groupTime(rows, "week"),
    region: groupDimension(rows, "region", "profit"),
    category: groupDimension(rows, "category", "sales"),
    segment: groupDimension(rows, "segment", "sales"),
    discount: groupDiscount(rows),
    topSubcategories: groupDimension(rows, "subcategory", "sales").slice(0, 5),
  };
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function groupTime(rows, mode) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = mode === "week" ? `${row.year}-W${String(row.week).padStart(2, "0")}` : `${row.year}-${String(row.month).padStart(2, "0")}`;
    if (!grouped.has(key)) grouped.set(key, { month: key, sales: 0, profit: 0 });
    const item = grouped.get(key);
    item.sales += row.sales;
    item.profit += row.profit;
  });
  return [...grouped.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function groupDimension(rows, key, sortKey) {
  const grouped = new Map();
  rows.forEach((row) => {
    const name = row[key] || "Unspecified";
    if (!grouped.has(name)) grouped.set(name, { name, sales: 0, profit: 0, quantity: 0, orders: new Set() });
    const item = grouped.get(name);
    item.sales += row.sales;
    item.profit += row.profit;
    item.quantity += row.quantity;
    item.orders.add(row.orderId);
  });
  return [...grouped.values()]
    .map((item) => ({ ...item, orders: item.orders.size }))
    .sort((a, b) => Math.abs(b[sortKey]) - Math.abs(a[sortKey]));
}

function groupDiscount(rows) {
  const buckets = [
    { bucket: "0-3%", min: 0, max: 0.03, sales: 0, profit: 0 },
    { bucket: "4-7%", min: 0.031, max: 0.07, sales: 0, profit: 0 },
    { bucket: "8-12%", min: 0.071, max: 0.12, sales: 0, profit: 0 },
    { bucket: "13%+", min: 0.121, max: Infinity, sales: 0, profit: 0 },
  ];
  rows.forEach((row) => {
    const bucket = buckets.find((item) => row.discount >= item.min && row.discount <= item.max) || buckets[0];
    bucket.sales += row.sales;
    bucket.profit += row.profit;
  });
  return buckets.map(({ bucket, sales, profit }) => ({ bucket, sales, profit }));
}

function renderKpis(metrics) {
  byId("salesKpi").textContent = formatMoney.format(metrics.sales);
  byId("profitKpi").textContent = formatMoney.format(metrics.profit);
  byId("ordersKpi").textContent = formatNumber.format(metrics.orders);
  byId("marginKpi").textContent = formatPercent.format(metrics.margin);
  byId("discountKpi").textContent = formatPercent.format(metrics.avgDiscount);
  byId("quantityKpi").textContent = formatNumber.format(metrics.quantity);
}

function renderCurrentPage(rows) {
  const activePage = document.querySelector(".page.is-active")?.dataset.pagePanel;
  const data = aggregate(rows);
  if (activePage === "sales") drawTrend("salesPageChart", dateFilters.week === "All" ? data.monthly : data.weekly, { large: true });
  if (activePage === "regions") renderTable("regionTable", data.region, "المنطقة", regionLabels);
  if (activePage === "categories") renderTable("categoryTable", data.category, "الفئة", categoryLabels);
  if (activePage === "segments") renderSegmentCards(data.segment);
  if (activePage === "reports") renderReport(rows);
}

function showPage(page) {
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.page === page));
  document.querySelectorAll(".page").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.pagePanel === page));
}

function drawTrend(elementId, rows, options = {}) {
  const svg = byId(elementId);
  if (!svg) return;
  const width = svg.clientWidth || 860;
  const height = svg.clientHeight || (options.large ? 500 : 310);
  const pad = { top: 22, right: 18, bottom: 42, left: 64 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  if (!rows.length) {
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = `<text class="chart-label" x="${width / 2}" y="${height / 2}" text-anchor="middle">لا توجد بيانات للفترة المحددة</text>`;
    return;
  }
  const max = Math.max(...rows.map((row) => row.sales), 1) * 1.1;
  const x = (i) => pad.left + (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
  const y = (value) => pad.top + innerH - (Math.max(0, value) / max) * innerH;
  const salesLine = rows.map((row, i) => `${i ? "L" : "M"}${x(i)},${y(row.sales)}`).join(" ");
  const profitLine = rows.map((row, i) => `${i ? "L" : "M"}${x(i)},${y(Math.max(0, row.profit * 5))}`).join(" ");
  const area = `${salesLine} L${x(rows.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((step) => {
      const gy = pad.top + innerH - step * innerH;
      return `<line class="grid-line" x1="${pad.left}" x2="${pad.left + innerW}" y1="${gy}" y2="${gy}"></line>
      <text class="chart-label" x="${pad.left - 9}" y="${gy + 4}" text-anchor="end">${formatMoney.format(max * step)}</text>`;
    })
    .join("");
  const step = rows.length > 36 ? 6 : rows.length > 18 ? 3 : 1;
  const labels = rows
    .filter((_, i) => i % step === 0 || i === rows.length - 1)
    .map((row) => {
      const i = rows.findIndex((item) => item.month === row.month);
      return `<text class="chart-label" x="${x(i)}" y="${height - 14}" text-anchor="middle">${row.month}</text>`;
    })
    .join("");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    ${grid}
    <path class="area-sales" d="${area}"></path>
    <path class="line-sales" d="${salesLine}"></path>
    <path class="line-profit" d="${profitLine}"></path>
    <line class="axis" x1="${pad.left}" x2="${pad.left}" y1="${pad.top}" y2="${pad.top + innerH}"></line>
    <line class="axis" x1="${pad.left}" x2="${pad.left + innerW}" y1="${pad.top + innerH}" y2="${pad.top + innerH}"></line>
    ${labels}
    <text class="chart-label" x="${pad.left + 8}" y="${pad.top + 14}">المبيعات</text>
    <text class="chart-label" x="${pad.left + 88}" y="${pad.top + 14}" fill="#f29d38">الربح ×5</text>`;
}

function renderRegionBars(rows) {
  const max = Math.max(...rows.map((row) => Math.abs(row.profit)), 1);
  byId("regionBars").innerHTML = rows
    .slice(0, 8)
    .map((row) => {
      const width = Math.max(4, (Math.abs(row.profit) / max) * 100);
      const color = row.profit < 0 ? "var(--red)" : "var(--green)";
      const name = labelValue(row.name, regionLabels);
      return `<div class="bar-row"><label title="${name}">${name}</label><span class="bar-track"><span class="bar-fill" style="width:${width}%;--bar-color:${color}"></span></span><strong>${formatMoney.format(row.profit)}</strong></div>`;
    })
    .join("");
}

function renderCategoryCards(rows) {
  byId("categoryCards").innerHTML = rows
    .slice(0, 4)
    .map((row) => {
      const margin = row.sales ? row.profit / row.sales : 0;
      return `<article class="category-card"><header><h3>${labelValue(row.name, categoryLabels)}</h3><b>${formatPercent.format(margin)}</b></header><span>المبيعات: ${formatMoney.format(row.sales)}</span><br><span>الربح: ${formatMoney.format(row.profit)}</span></article>`;
    })
    .join("");
}

function drawDiscount(elementId, rows) {
  const svg = byId(elementId);
  if (!svg) return;
  const width = svg.clientWidth || 420;
  const height = svg.clientHeight || 210;
  const pad = { top: 18, right: 18, bottom: 38, left: 58 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...rows.map((row) => Math.abs(row.profit)), 1) * 1.12;
  const zeroY = pad.top + innerH / 2;
  const group = innerW / rows.length;
  const barW = Math.max(28, group * 0.48);
  const bars = rows
    .map((row, i) => {
      const x = pad.left + i * group + group / 2 - barW / 2;
      const h = (Math.abs(row.profit) / max) * (innerH / 2);
      const y = row.profit >= 0 ? zeroY - h : zeroY;
      const fill = row.profit >= 0 ? "var(--green)" : "var(--red)";
      return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="5" fill="${fill}"></rect><text class="chart-label" x="${x + barW / 2}" y="${height - 14}" text-anchor="middle">${row.bucket}</text>`;
    })
    .join("");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `<line class="grid-line" x1="${pad.left}" x2="${pad.left + innerW}" y1="${pad.top}" y2="${pad.top}"></line><line class="axis" x1="${pad.left}" x2="${pad.left + innerW}" y1="${zeroY}" y2="${zeroY}"></line>${bars}`;
}

function renderRanks(rows) {
  byId("topSubcategories").innerHTML = rows
    .map((row, index) => {
      const name = labelValue(row.name, subcategoryLabels);
      return `<li><b>${index + 1}</b><span title="${name}">${name}</span><strong>${formatMoney.format(row.sales)}</strong></li>`;
    })
    .join("");
}

function renderTable(elementId, rows, label, dictionary = {}) {
  byId(elementId).innerHTML = `<table class="data-table"><thead><tr><th>${label}</th><th>المبيعات</th><th>الربح</th><th>الهامش</th><th>الطلبات</th><th>الحالة</th></tr></thead><tbody>${rows
    .map((row) => {
      const margin = row.sales ? row.profit / row.sales : 0;
      const signal = margin >= 0.1 ? "قوي" : margin >= 0 ? "متابعة" : "خطر";
      const signalClass = signal === "قوي" ? "" : signal === "متابعة" ? "warning" : "risk";
      return `<tr><td>${labelValue(row.name, dictionary)}</td><td>${formatMoney.format(row.sales)}</td><td>${formatMoney.format(row.profit)}</td><td>${formatPercent.format(margin)}</td><td>${formatNumber.format(row.orders)}</td><td><span class="signal ${signalClass}">${signal}</span></td></tr>`;
    })
    .join("")}</tbody></table>`;
}

function renderSegmentCards(rows) {
  byId("segmentCards").innerHTML = rows
    .map((row) => {
      const margin = row.sales ? row.profit / row.sales : 0;
      return `<article class="segment-card"><header><h3>${labelValue(row.name, segmentLabels)}</h3><b>${formatPercent.format(margin)}</b></header><span>المبيعات: ${formatMoney.format(row.sales)}</span><br><span>الربح: ${formatMoney.format(row.profit)}</span><br><span>الطلبات: ${formatNumber.format(row.orders)}</span></article>`;
    })
    .join("");
}

function renderReport(rows) {
  const data = aggregate(rows);
  const title = activeReport === "weekly" ? "تقرير أسبوعي" : activeReport === "regions" ? "مقارنة المناطق" : "تقرير شهري شامل";
  const rowsForTable = activeReport === "regions" ? data.region : activeReport === "weekly" ? data.weekly : data.monthly;
  const tableRows = rowsForTable
    .slice(0, activeReport === "regions" ? 12 : 18)
    .map((row) => {
      const name = activeReport === "regions" ? labelValue(row.name, regionLabels) : row.month;
      const margin = row.sales ? row.profit / row.sales : 0;
      return `<tr><td>${name}</td><td>${formatMoney.format(row.sales)}</td><td>${formatMoney.format(row.profit)}</td><td>${formatPercent.format(margin)}</td></tr>`;
    })
    .join("");
  byId("reportPreview").innerHTML = `
    <h2>${title}</h2>
    <p>الفترة: ${describePeriod()} | الشريحة: ${labelValue(activeSegment, segmentLabels)}</p>
    <div class="summary-band">
      <div><span>المبيعات</span><b>${formatMoney.format(data.metrics.sales)}</b></div>
      <div><span>الربح</span><b>${formatMoney.format(data.metrics.profit)}</b></div>
      <div><span>الطلبات</span><b>${formatNumber.format(data.metrics.orders)}</b></div>
      <div><span>الهامش</span><b>${formatPercent.format(data.metrics.margin)}</b></div>
    </div>
    <h3>${activeReport === "regions" ? "جدول المناطق" : "جدول الفترة"}</h3>
    <table><thead><tr><th>البند</th><th>المبيعات</th><th>الربح</th><th>الهامش</th></tr></thead><tbody>${tableRows}</tbody></table>`;
}

function exportReportCsv() {
  const data = aggregate(currentRows());
  const rows = [["المؤشر", "القيمة"], ["المبيعات", data.metrics.sales], ["الربح", data.metrics.profit], ["الطلبات", data.metrics.orders], ["الهامش", data.metrics.margin]];
  downloadText("تقرير_داشبورد_المبيعات.csv", rows.map((row) => row.join(",")).join("\n"), "text/csv");
}

function exportReportJson() {
  downloadText("تقرير_داشبورد_المبيعات.json", JSON.stringify({ filters: { activeSegment: labelValue(activeSegment, segmentLabels), ...dateFilters }, report: aggregate(currentRows()) }, null, 2), "application/json");
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function tickClock() {
  const now = new Date();
  byId("todayLabel").textContent = now.toLocaleDateString("ar", { weekday: "long", year: "numeric", month: "short", day: "numeric" });
  byId("clockLabel").textContent = now.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

function triggerReaction() {
  document.querySelectorAll(".kpi-card, .panel").forEach((target) => {
    target.classList.remove("is-reacting");
    window.requestAnimationFrame(() => target.classList.add("is-reacting"));
  });
}
