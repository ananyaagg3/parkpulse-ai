const state = {
  data: null,
  selected: null,
  points: [],
  mode: "historical",
  liveTimer: null,
  liveStep: 0,
};

const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const tooltip = document.getElementById("tooltip");
const stationFilter = document.getElementById("stationFilter");
const impactFilter = document.getElementById("impactFilter");
const impactValue = document.getElementById("impactValue");
const visibleHotspotCount = document.getElementById("visibleHotspotCount");
const modeFilter = document.getElementById("modeFilter");
const DATA_VERSION = "20260623";

const bounds = {
  minLat: 12.82,
  maxLat: 13.22,
  minLon: 77.45,
  maxLon: 77.75,
};

const formatNumber = new Intl.NumberFormat("en-IN");

function project(lat, lon) {
  const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * canvas.width;
  const y = canvas.height - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * canvas.height;
  return { x, y };
}

function colorForImpact(impact) {
  if (impact >= 85) return "#d64545";
  if (impact >= 70) return "#f2a900";
  if (impact >= 55) return "#0957d0";
  return "#008c89";
}

function drawBaseMap() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#f5fbff");
  gradient.addColorStop(1, "#dfeaf2");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#c8d7e3";
  ctx.lineWidth = 1;
  for (let x = 80; x < canvas.width; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 40, canvas.height);
    ctx.stroke();
  }
  for (let y = 80; y < canvas.height; y += 92) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y + 22);
    ctx.stroke();
  }

  drawRoad([[12.92, 77.48], [12.96, 77.55], [12.98, 77.61], [13.03, 77.70]], "#9db3c5", 8);
  drawRoad([[13.16, 77.55], [13.05, 77.58], [12.97, 77.58], [12.88, 77.61]], "#9db3c5", 8);
  drawRoad([[12.90, 77.70], [12.94, 77.66], [12.99, 77.62], [13.07, 77.59]], "#b0c0cf", 6);
  drawRoad([[12.87, 77.54], [12.93, 77.58], [12.98, 77.61], [13.02, 77.64]], "#b0c0cf", 6);

  ctx.fillStyle = "#526b80";
  ctx.font = "700 15px Inter, sans-serif";
  label("KR Market", 12.964, 77.577);
  label("Safina Plaza", 12.981, 77.61);
  label("HAL Old Airport", 12.934, 77.691);
  label("Hebbal", 13.071, 77.588);
  label("Upparpet", 12.977, 77.576);
}

function drawRoad(points, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach(([lat, lon], index) => {
    const point = project(lat, lon);
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
}

function label(text, lat, lon) {
  const point = project(lat, lon);
  ctx.fillText(text, point.x + 8, point.y - 8);
}

function filteredHotspots() {
  const minImpact = Number(impactFilter.value);
  const station = stationFilter.value;
  return state.data.parking.topHotspots.filter((row) => {
    const stationMatch = station === "all" || row.station === station;
    return stationMatch && row.impact >= minImpact;
  });
}

function renderFilterSummary(rows = filteredHotspots()) {
  const count = rows.length;
  const total = state.data.parking.topHotspots.length;
  visibleHotspotCount.textContent = `${formatNumber.format(count)} of ${formatNumber.format(total)} shown`;
}

function applyFilters() {
  const rows = filteredHotspots();
  renderFilterSummary(rows);
  if (!rows.length) {
    state.selected = null;
    drawMap();
    renderTable();
    renderDeploymentPlan();
    document.getElementById("selectedTitle").textContent = "No hotspots match";
    document.getElementById("selectedMetrics").innerHTML = "";
    document.getElementById("recommendation").textContent = "Lower the minimum impact filter to show more enforcement zones.";
    document.getElementById("hourBars").innerHTML = "";
    document.getElementById("breakdown").innerHTML = "";
    return;
  }
  if (!rows.includes(state.selected)) {
    selectHotspot(rows[0]);
    return;
  }
  drawMap();
  renderTable();
  renderDeploymentPlan();
}

function effectiveImpact(row) {
  if (!row.impact) return Math.min(100, 35 + row.count * 2);
  const liveBoost = state.mode === "live" && row.rank && row.rank <= 8 ? (9 - row.rank) * 1.2 + (state.liveStep % 4) : 0;
  return Math.min(100, Math.round(row.impact + liveBoost));
}

function drawMap() {
  document.getElementById("mapTitle").textContent = "Parking Impact Map";
  drawBaseMap();
  const rows = filteredHotspots();
  state.points = rows.map((row) => {
    const point = project(row.lat, row.lon);
    const impact = effectiveImpact(row);
    const radius = 5 + Math.sqrt(row.count) * 0.5;
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.min(radius, 34), 0, Math.PI * 2);
    ctx.fillStyle = colorForImpact(impact);
    ctx.globalAlpha = state.selected === row ? 0.95 : 0.68;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = state.selected === row ? 3 : 1.5;
    ctx.stroke();
    if (state.mode === "live" && row.rank && row.rank <= 5) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.min(radius + 8 + (state.liveStep % 5), 44), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(214, 69, 69, 0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    return { ...point, radius: Math.min(radius, 34), row };
  });
}

function renderKpis() {
  const parking = state.data.parking;
  document.getElementById("totalViolations").textContent = formatNumber.format(parking.totalViolations);
  document.getElementById("hotspotCount").textContent = formatNumber.format(parking.hotspotCount);
  document.getElementById("riskReduction").textContent = `${parking.simulation.top10RiskReductionPct}%`;
  document.getElementById("unitCount").textContent = "3";
}

function renderFilters() {
  const stations = state.data.parking.stationCounts.map((row) => row.name);
  stationFilter.innerHTML = `<option value="all">All stations</option>${stations
    .map((station) => `<option value="${station}">${station}</option>`)
    .join("")}`;
}

function deploymentAction(row, index) {
  const hour = typeof row.topHour === "number" ? `${String(row.topHour).padStart(2, "0")}:00` : "peak window";
  const unit = index + 1;
  const zone = row.junction === "No Junction" ? row.station : row.junction.replace(/^BTP\d+\s-\s/, "");
  const action = row.dominantViolation?.includes("NO PARKING")
    ? "Tow and clear curbside obstruction"
    : row.dominantViolation?.includes("MAIN ROAD")
      ? "Clear carriageway and hold tow truck nearby"
      : "Station officers upstream and run mobile sweeps";
  return { unit, zone, hour, action, station: row.station };
}

function renderDeploymentPlan() {
  const rows = filteredHotspots().slice(0, 3);
  const plan = rows.map(deploymentAction);
  document.getElementById("deploymentPlan").innerHTML = plan
    .map(
      (item) => `<article class="deployment-card">
        <strong>Unit ${item.unit}: ${item.zone}</strong>
        <span>${item.station} | ${item.hour} IST patrol window</span>
        <span class="deployment-action">${item.action}</span>
      </article>`,
    )
    .join("");
  const badge = document.getElementById("liveBadge");
  badge.textContent = state.mode === "live" ? "Live Simulation" : "Historical";
  badge.classList.toggle("live", state.mode === "live");
}

function renderSimulation() {
  const reduction = state.data.parking.simulation.top10RiskReductionPct;
  const currentRisk = state.mode === "live" ? 106 : 100;
  const afterRisk = Math.max(0, currentRisk - reduction);
  document.getElementById("currentRisk").textContent = currentRisk.toFixed(0);
  document.getElementById("afterRisk").textContent = afterRisk.toFixed(1);
  document.getElementById("riskFill").style.width = `${afterRisk}%`;
  document.getElementById("simulationCopy").textContent =
    `Clearing the top 10 priority zones addresses ${reduction}% of weighted top-250 hotspot risk. In live mode, new records temporarily raise priority for the highest-risk patrol windows.`;
}

function selectHotspot(row) {
  state.selected = row;
  renderFilterSummary();
  const displayName = row.junction
    ? row.junction === "No Junction"
      ? row.station
      : row.junction
    : `${row.cause} cluster`;
  document.getElementById("selectedTitle").textContent = displayName;
  const metrics = [
    ["Impact score", effectiveImpact(row)],
    ["Violations", formatNumber.format(row.count)],
    ["Dominant issue", row.dominantViolation || row.cause],
    ["Peak hour", typeof row.topHour === "number" ? `${row.topHour}:00 IST` : "Peak window"],
    ["Police station", row.station],
    ["Top vehicle", row.topVehicle || "Mixed"],
  ];
  document.getElementById("selectedMetrics").innerHTML = metrics
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join("");
  document.getElementById("recommendation").textContent =
    row.recommendation || "Deploy mobile patrols during the recurring peak window.";
  renderHourBars(row.hours || []);
  renderBreakdown(row);
  drawMap();
  renderTable();
  renderDeploymentPlan();
  renderSimulation();
}

function renderHourBars(hours) {
  const max = Math.max(...hours, 1);
  document.getElementById("hourBars").innerHTML = Array.from({ length: 24 }, (_, hour) => {
    const height = Math.max(3, (hours[hour] / max) * 100);
    return `<div class="bar" title="${hour}:00 - ${hours[hour] || 0}" style="height:${height}%"></div>`;
  }).join("");
}

function renderTable() {
  const rows = filteredHotspots().slice(0, 40);
  document.getElementById("hotspotTable").innerHTML = rows
    .map((row) => {
      const name = row.junction === "No Junction" ? row.station : row.junction;
      const active = state.selected === row ? "active" : "";
      return `<tr class="${active}" data-rank="${row.rank}">
        <td>${row.rank}</td>
        <td><strong>${name}</strong><br><span>${row.station}</span></td>
        <td>${formatNumber.format(row.count)}<br><span>${row.dominantViolation}</span></td>
        <td><span class="score" style="background:${colorForImpact(effectiveImpact(row))}">${effectiveImpact(row)}</span></td>
        <td>${row.recommendation}</td>
      </tr>`;
    })
    .join("");
}

function renderBreakdown(row) {
  const items = [
    ["Violation density", Math.min(100, Math.round((row.count / 4405) * 100))],
    ["Road obstruction severity", Math.round((row.avgSeverity || 3) * 20)],
    ["Peak-window recurrence", Math.round((row.peakShare || 0.35) * 100)],
    ["Evidence confidence", Math.round((row.validationConfidence || 0.7) * 100)],
  ];
  document.getElementById("breakdown").innerHTML = items
    .map(
      ([label, value]) => `<div class="breakdown-item">
        <div class="breakdown-top"><span>${label}</span><strong>${value}</strong></div>
        <div class="track"><div class="fill" style="width:${value}%"></div></div>
      </div>`,
    )
    .join("");
}

function pointAt(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  return state.points.find((point) => Math.hypot(point.x - x, point.y - y) <= point.radius + 5);
}

function bindEvents() {
  impactFilter.addEventListener("input", () => {
    impactValue.textContent = impactFilter.value;
    applyFilters();
  });
  stationFilter.addEventListener("change", () => {
    applyFilters();
  });
  modeFilter.addEventListener("change", () => {
    state.mode = modeFilter.value;
    document.querySelector(".status-panel span:last-child").textContent =
      state.mode === "live" ? "Live simulation running" : "Historical scenario mode";
    document.querySelector(".pulse").classList.toggle("live-ping", state.mode === "live");
    if (state.mode === "live") startLiveSimulation();
    else stopLiveSimulation();
    selectHotspot(state.selected || state.data.parking.topHotspots[0]);
  });
  document.getElementById("resetButton").addEventListener("click", () => {
    stationFilter.value = "all";
    impactFilter.value = 55;
    impactValue.textContent = "55";
    state.mode = "historical";
    modeFilter.value = "historical";
    document.querySelector(".status-panel span:last-child").textContent = "Historical scenario mode";
    document.querySelector(".pulse").classList.remove("live-ping");
    stopLiveSimulation();
    selectHotspot(state.data.parking.topHotspots[0]);
  });
  document.getElementById("hotspotTable").addEventListener("click", (event) => {
    const row = event.target.closest("tr");
    if (!row) return;
    const rank = Number(row.dataset.rank);
    const hotspot = state.data.parking.topHotspots.find((item) => item.rank === rank);
    if (hotspot) selectHotspot(hotspot);
  });
  canvas.addEventListener("mousemove", (event) => {
    const point = pointAt(event);
    if (!point) {
      tooltip.hidden = true;
      return;
    }
    const row = point.row;
    tooltip.hidden = false;
    tooltip.style.left = `${event.offsetX}px`;
    tooltip.style.top = `${event.offsetY}px`;
    const title = row.junction === "No Junction" ? row.station : row.junction;
    tooltip.innerHTML = `<strong>${title}</strong><br>
      ${formatNumber.format(row.count)} records<br>
      Impact ${effectiveImpact(row)}`;
  });
  canvas.addEventListener("click", (event) => {
    const point = pointAt(event);
    if (point) selectHotspot(point.row);
  });
}

function startLiveSimulation() {
  stopLiveSimulation();
  state.liveTimer = window.setInterval(() => {
    state.liveStep += 1;
    drawMap();
    renderTable();
    renderSimulation();
    if (state.selected) renderBreakdown(state.selected);
  }, 1400);
}

function stopLiveSimulation() {
  if (state.liveTimer) window.clearInterval(state.liveTimer);
  state.liveTimer = null;
  state.liveStep = 0;
}

async function init() {
  const response = await fetch(`data/parkpulse_data.json?v=${DATA_VERSION}`);
  state.data = await response.json();
  const params = new URLSearchParams(window.location.search);
  state.mode = params.get("mode") === "live" ? "live" : "historical";
  renderKpis();
  renderFilters();
  bindEvents();
  modeFilter.value = state.mode;
  document.querySelector(".status-panel span:last-child").textContent =
    state.mode === "live" ? "Live simulation running" : "Historical scenario mode";
  document.querySelector(".pulse").classList.toggle("live-ping", state.mode === "live");
  if (state.mode === "live") startLiveSimulation();
  renderFilterSummary();
  selectHotspot(state.data.parking.topHotspots[0]);
}

init().catch((error) => {
  document.body.innerHTML = `<main class="panel"><h1>ParkPulse AI</h1><p>Unable to load prototype data: ${error.message}</p></main>`;
});
