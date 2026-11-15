// ==========================================================================
// Plik: js/staff.js — Logika Panelu Pracownika (StolikAI — wszystkie 6 zakładek)
// oraz inicjalizacja zdarzeń DOMContentLoaded
// ==========================================================================

function openStaffLogin() {
  const loginSelect = document.getElementById("staff-login-restaurant");
  if (loginSelect && currentRestaurantId) {
    loginSelect.value = currentRestaurantId;
  }
  navigateTo("view-staff-login");
}

function handleStaffLoginSubmit(event) {
  event.preventDefault();
  const loginSelect = document.getElementById("staff-login-restaurant");
  staffRestaurantId = loginSelect ? loginSelect.value : "bistro-agh";

  const activeSelect = document.getElementById("staff-active-restaurant");
  if (activeSelect) activeSelect.value = staffRestaurantId;

  resetStaffReservationDates();
  renderStaffPanel();
  navigateTo("view-staff-panel");
}

function changeStaffRestaurant(newRestId) {
  if (!RESTAURANTS_DATA[newRestId]) return;
  staffRestaurantId = newRestId;
  document.body.setAttribute("data-theme", staffRestaurantId);
  const brandTitleEl = document.getElementById("header-restaurant-name");
  if (brandTitleEl) brandTitleEl.textContent = `Panel Pracownika — ${RESTAURANTS_DATA[staffRestaurantId].name}`;
  renderStaffPanel();
}

function switchStaffTab(tabName) {
  const subviews = document.querySelectorAll(".staff-subview");
  subviews.forEach((el) => el.classList.remove("active-subview"));

  const target = document.getElementById(`staff-tab-${tabName}`);
  if (target) target.classList.add("active-subview");

  const btns = document.querySelectorAll(".staff-nav-btn[data-staff-tab]");
  btns.forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-staff-tab") === tabName);
  });

  renderStaffPanel();
}

function resetStaffReservationDates() {
  const startInput = document.getElementById("st-res-start");
  const endInput = document.getElementById("st-res-end");
  if (startInput) startInput.value = toLocalInput(Date.now() + 60 * 60 * 1000);
  if (endInput) endInput.value = toLocalInput(Date.now() + 3 * 60 * 60 * 1000);
}

function cycleStaffTableStatus(tableId) {
  const rest = RESTAURANTS_DATA[staffRestaurantId];
  const table = rest.tables.find((t) => t.id === tableId);
  if (!table) return;

  const order = ["free", "occupied", "reserved", "dirty"];
  const nextIdx = (order.indexOf(table.liveStatus) + 1) % order.length;
  setStaffTableStatus(tableId, order[nextIdx]);
}

function renderStaffPanel() {
  const rest = RESTAURANTS_DATA[staffRestaurantId];
  if (!rest) return;

  const activeTables = rest.tables.filter((t) => t.is_active !== false);
  const counts = { free: 0, occupied: 0, reserved: 0, dirty: 0 };
  activeTables.forEach((t) => {
    counts[t.liveStatus] = (counts[t.liveStatus] || 0) + 1;
  });

  const occupancyRate = activeTables.length
    ? Math.round(((counts.occupied || 0) / activeTables.length) * 1000) / 10
    : 0;
  const camerasOnline = rest.cameras.filter((c) => c.status === "online").length;
  const activeReservationsCount = rest.reservations.filter((r) =>
    ["confirmed", "seated"].includes(r.status)
  ).length;

  const statsEl = document.getElementById("staff-dashboard-stats");
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="staff-stat-card">
        <div class="label">Zajętość stolików</div>
        <div class="value">${occupancyRate}%</div>
      </div>
      <div class="staff-stat-card">
        <div class="label">Wolne / zajęte (brudne: ${counts.dirty})</div>
        <div class="value">${counts.free}/${counts.occupied}</div>
      </div>
      <div class="staff-stat-card">
        <div class="label">Kamery włączone</div>
        <div class="value">${camerasOnline}/${rest.cameras.length}</div>
      </div>
      <div class="staff-stat-card">
        <div class="label">Aktywne rezerwacje</div>
        <div class="value">${activeReservationsCount}</div>
      </div>
    `;
  }

  const dashMapEl = document.getElementById("staff-dashboard-map");
  if (dashMapEl) {
    dashMapEl.innerHTML = generateArchitecturalPlanHTML(activeTables, "staff", staffRestaurantId);
  }

  const tableListHTML = activeTables
    .map(
      (t) => `
      <div class="staff-list-item">
        <div>
          <strong>${t.name} (${t.seats} os.)</strong>
          <small>${t.zone || "Bez strefy"} · wykryto: ${t.seats_detected || 0}/${t.seats} os. · pewność AI: ${Math.round((t.confidence || 0.9) * 100)}%</small>
        </div>
        ${statusBadgeHTML(t.liveStatus)}
      </div>
    `
    )
    .join("");

  const dashTableListEl = document.getElementById("staff-dashboard-table-list");
  if (dashTableListEl) dashTableListEl.innerHTML = tableListHTML;

  const upcomingEl = document.getElementById("staff-dashboard-upcoming");
  if (upcomingEl) {
    const upcoming = rest.reservations.filter((r) => ["confirmed", "seated"].includes(r.status)).slice(0, 8);
    if (upcoming.length === 0) {
      upcomingEl.innerHTML = `<div style="padding:12px; color:var(--text-muted);">Brak nadchodzących rezerwacji.</div>`;
    } else {
      upcomingEl.innerHTML = upcoming
        .map(
          (r) => `
          <div class="staff-list-item">
            <div>
              <strong>${r.guest_name}</strong>
              <small>${formatWhen(r.starts_at)} · ${r.table_number || "—"} · ${r.party_size} os.</small>
            </div>
            ${statusBadgeHTML(r.status)}
          </div>
        `
        )
        .join("");
    }
  }

  const dashDetectionsEl = document.getElementById("staff-dashboard-detections");
  if (dashDetectionsEl) {
    dashDetectionsEl.innerHTML = rest.detections
      .slice(0, 8)
      .map(
        (d) => `
        <div class="staff-list-item">
          <div>
            <strong>${d.table_number}</strong>
            <small>${d.seats_detected} osób · pewność ${Math.round(d.confidence * 100)}% · ${formatWhen(d.detected_at)}</small>
          </div>
          ${statusBadgeHTML(d.occupied ? "occupied" : "free")}
        </div>
      `
      )
      .join("");
  }

  const occMapEl = document.getElementById("staff-occupancy-map");
  if (occMapEl) {
    occMapEl.innerHTML = generateArchitecturalPlanHTML(activeTables, "staff", staffRestaurantId);
  }
  const occListEl = document.getElementById("staff-occupancy-list");
  if (occListEl) occListEl.innerHTML = tableListHTML;

  const tablesTbody = document.getElementById("staff-tables-tbody");
  if (tablesTbody) {
    tablesTbody.innerHTML = rest.tables
      .map(
        (t) => `
        <tr>
          <td><strong>${t.name}</strong></td>
          <td>${t.zone || "—"}</td>
          <td>${t.seats} os.</td>
          <td>${t.seats_detected || 0}</td>
          <td>${Math.round((t.confidence || 0.9) * 100)}%</td>
          <td>${statusBadgeHTML(t.liveStatus)}</td>
          <td>
            <div class="staff-row-actions">
              <button type="button" class="btn-sm" onclick="setStaffTableStatus(${t.id}, 'free')">Wolny</button>
              <button type="button" class="btn-sm" onclick="setStaffTableStatus(${t.id}, 'occupied')">Zajęty</button>
              <button type="button" class="btn-sm" onclick="setStaffTableStatus(${t.id}, 'dirty')">Do sprzątania</button>
              <button type="button" class="btn-sm danger" onclick="removeStaffTable(${t.id})">Usuń</button>
            </div>
          </td>
        </tr>
      `
      )
      .join("");
  }

  const resTableSelect = document.getElementById("st-res-table");
  if (resTableSelect) {
    resTableSelect.innerHTML =
      `<option value="">Automatycznie / później</option>` +
      rest.tables
        .map(
          (t) =>
            `<option value="${t.id}">${t.name} (${t.seats} os.) — ${statusLabel(t.liveStatus)}</option>`
        )
        .join("");
  }

  const resTbody = document.getElementById("staff-reservations-tbody");
  if (resTbody) {
    resTbody.innerHTML = rest.reservations
      .map(
        (r) => `
        <tr>
          <td>
            <strong>${r.guest_name}</strong>
            <div style="color:var(--text-muted); font-size:0.8rem;">
              ${r.guest_phone || r.guest_email || "—"} ${r.cancel_code ? `· Kod: <code>#${r.cancel_code}</code>` : ""}
            </div>
            ${r.notes ? `<div style="font-size:0.78rem; opacity:0.85;">Uwagi: ${r.notes}</div>` : ""}
          </td>
          <td>${r.table_number || "—"}</td>
          <td>${r.party_size} os.</td>
          <td>
            ${formatWhen(r.starts_at)}
            <div style="color:var(--text-muted); font-size:0.78rem;">do ${formatWhen(r.ends_at)}</div>
          </td>
          <td>${statusBadgeHTML(r.status)}</td>
          <td>
            <div class="staff-row-actions">
              <button type="button" class="btn-sm" onclick="setStaffReservationStatus(${r.id}, 'seated')">Posadź</button>
              <button type="button" class="btn-sm" onclick="setStaffReservationStatus(${r.id}, 'completed')">Zakończ</button>
              <button type="button" class="btn-sm" onclick="setStaffReservationStatus(${r.id}, 'cancelled')">Anuluj</button>
              <button type="button" class="btn-sm danger" onclick="removeStaffReservation(${r.id})">Usuń</button>
            </div>
          </td>
        </tr>
      `
      )
      .join("");
  }

  const camTbody = document.getElementById("staff-cameras-tbody");
  if (camTbody) {
    camTbody.innerHTML = rest.cameras
      .map(
        (c) => `
        <tr>
          <td><strong>${c.name}</strong></td>
          <td>${c.zone_name || "—"}</td>
          <td style="font-family:var(--font-mono); font-size:0.8rem;">${c.stream_url || "—"}</td>
          <td>${c.model_enabled ? "włączony" : "wyłączony"}</td>
          <td>${statusBadgeHTML(c.status)}</td>
          <td>${formatWhen(c.last_heartbeat)}</td>
          <td>
            <div class="staff-row-actions">
              <button type="button" class="btn-sm" onclick="toggleStaffCameraModel(${c.id})">
                ${c.model_enabled ? "Wyłącz model" : "Włącz model"}
              </button>
              <button type="button" class="btn-sm" onclick="setStaffCameraStatus(${c.id}, 'online')">Włącz</button>
              <button type="button" class="btn-sm" onclick="setStaffCameraStatus(${c.id}, 'offline')">Wyłącz</button>
              <button type="button" class="btn-sm danger" onclick="removeStaffCamera(${c.id})">Usuń</button>
            </div>
          </td>
        </tr>
      `
      )
      .join("");
  }

  const detTbody = document.getElementById("staff-detections-tbody");
  if (detTbody) {
    detTbody.innerHTML = rest.detections
      .map(
        (d) => `
        <tr>
          <td>${formatWhen(d.detected_at)}</td>
          <td><strong>${d.table_number}</strong></td>
          <td>${d.seats_detected} os.</td>
          <td>${Math.round(d.confidence * 100)}%</td>
          <td>${statusBadgeHTML(d.occupied ? "occupied" : "free")}</td>
          <td>Kamera #${d.camera_id || 1}</td>
        </tr>
      `
      )
      .join("");
  }

  renderAllFloorPlans();
  renderRestaurantsList();
}

function handleStaffCreateTable(event) {
  event.preventDefault();
  const rest = RESTAURANTS_DATA[staffRestaurantId];
  const nameVal = document.getElementById("st-table-number").value.trim();
  const capVal = parseInt(document.getElementById("st-table-capacity").value, 10) || 4;
  const zoneVal = document.getElementById("st-table-zone").value.trim() || "Sala główna";
  const statusVal = document.getElementById("st-table-status").value;
  const posX = parseInt(document.getElementById("st-table-posx").value, 10) || 50;
  const posY = parseInt(document.getElementById("st-table-posy").value, 10) || 50;

  const nextId = rest.tables.reduce((max, t) => Math.max(max, t.id), 0) + 1;
  rest.tables.push({
    id: nextId,
    name: nameVal,
    seats: capVal,
    zone: zoneVal,
    liveStatus: statusVal,
    liveLabel: statusLabel(statusVal),
    bookedSlots: [],
    seats_detected: statusVal === "occupied" ? capVal : 0,
    confidence: 0.92,
    pos_x: posX,
    pos_y: posY,
    is_active: true
  });

  document.getElementById("st-table-number").value = "";
  renderStaffPanel();
}

function setStaffTableStatus(tableId, newStatus) {
  const rest = RESTAURANTS_DATA[staffRestaurantId];
  const table = rest.tables.find((t) => t.id === tableId);
  if (!table) return;

  table.liveStatus = newStatus;
  if (newStatus === "free") {
    table.liveLabel = "Wolny — Kliknij";
    table.seats_detected = 0;
  } else if (newStatus === "occupied") {
    table.liveLabel = `Zajęty (YOLO: ${table.seats} os.)`;
    table.seats_detected = table.seats;
  } else if (newStatus === "reserved") {
    table.liveLabel = "Rezerwacja w systemie";
    table.seats_detected = 0;
  } else if (newStatus === "dirty") {
    table.liveLabel = "Do sprzątania";
    table.seats_detected = 0;
  }

  renderStaffPanel();
}

function removeStaffTable(tableId) {
  if (!confirm("Usunąć stolik?")) return;
  const rest = RESTAURANTS_DATA[staffRestaurantId];
  rest.tables = rest.tables.filter((t) => t.id !== tableId);
  renderStaffPanel();
}

function handleStaffCreateReservation(event) {
  event.preventDefault();
  const rest = RESTAURANTS_DATA[staffRestaurantId];
  const guestName = document.getElementById("st-res-guest").value.trim();
  const guestPhone = document.getElementById("st-res-phone").value.trim();
  const guestEmail = document.getElementById("st-res-email").value.trim();
  const partySize = parseInt(document.getElementById("st-res-party").value, 10) || 2;
  const tableIdVal = document.getElementById("st-res-table").value;
  const startsAt = document.getElementById("st-res-start").value;
  const endsAt = document.getElementById("st-res-end").value;
  const notes = document.getElementById("st-res-notes").value.trim();

  const tableObj = tableIdVal ? rest.tables.find((t) => t.id === Number(tableIdVal)) : null;

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const cancelCode = `TK-${suffix}`;

  rest.reservations.unshift({
    id: Date.now(),
    guest_name: guestName,
    guest_phone: guestPhone,
    guest_email: guestEmail,
    party_size: partySize,
    table_id: tableObj ? tableObj.id : null,
    table_number: tableObj ? tableObj.name : "—",
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    status: "confirmed",
    notes: notes,
    cancel_code: cancelCode
  });

  if (tableObj && tableObj.liveStatus === "free") {
    tableObj.liveStatus = "reserved";
    tableObj.liveLabel = "Rezerwacja w systemie";
  }

  document.getElementById("st-res-guest").value = "";
  document.getElementById("st-res-phone").value = "";
  document.getElementById("st-res-email").value = "";
  document.getElementById("st-res-notes").value = "";
  resetStaffReservationDates();
  renderStaffPanel();
}

function setStaffReservationStatus(resId, newStatus) {
  const rest = RESTAURANTS_DATA[staffRestaurantId];
  const res = rest.reservations.find((r) => r.id === resId);
  if (!res) return;

  res.status = newStatus;
  if (res.table_id) {
    const table = rest.tables.find((t) => t.id === res.table_id);
    if (table) {
      if (newStatus === "seated") {
        table.liveStatus = "occupied";
        table.liveLabel = "Zajęty (Gość posadzony)";
        table.seats_detected = res.party_size;
      } else if (["completed", "cancelled", "no_show"].includes(newStatus)) {
        table.liveStatus = "free";
        table.liveLabel = "Wolny — Kliknij";
        table.seats_detected = 0;
      }
    }
  }

  renderStaffPanel();
}

function removeStaffReservation(resId) {
  if (!confirm("Usunąć rezerwację?")) return;
  const rest = RESTAURANTS_DATA[staffRestaurantId];
  rest.reservations = rest.reservations.filter((r) => r.id !== resId);
  renderStaffPanel();
}

function handleStaffCreateCamera(event) {
  event.preventDefault();
  const rest = RESTAURANTS_DATA[staffRestaurantId];
  const nameVal = document.getElementById("st-cam-name").value.trim();
  const urlVal = document.getElementById("st-cam-url").value.trim();
  const zoneVal = document.getElementById("st-cam-zone").value.trim();
  const statusVal = document.getElementById("st-cam-status").value;
  const modelEnabled = document.getElementById("st-cam-model").checked;

  const nextId = rest.cameras.reduce((max, c) => Math.max(max, c.id), 0) + 1;
  rest.cameras.push({
    id: nextId,
    name: nameVal,
    stream_url: urlVal,
    zone_name: zoneVal,
    status: statusVal,
    model_enabled: modelEnabled,
    last_heartbeat: new Date().toISOString()
  });

  document.getElementById("st-cam-name").value = "";
  document.getElementById("st-cam-url").value = "";
  renderStaffPanel();
}

function toggleStaffCameraModel(camId) {
  const rest = RESTAURANTS_DATA[staffRestaurantId];
  const cam = rest.cameras.find((c) => c.id === camId);
  if (!cam) return;
  cam.model_enabled = !cam.model_enabled;
  renderStaffPanel();
}

function setStaffCameraStatus(camId, newStatus) {
  const rest = RESTAURANTS_DATA[staffRestaurantId];
  const cam = rest.cameras.find((c) => c.id === camId);
  if (!cam) return;
  cam.status = newStatus;
  cam.last_heartbeat = new Date().toISOString();
  renderStaffPanel();
}

function removeStaffCamera(camId) {
  if (!confirm("Usunąć kamerę?")) return;
  const rest = RESTAURANTS_DATA[staffRestaurantId];
  rest.cameras = rest.cameras.filter((c) => c.id !== camId);
  renderStaffPanel();
}

function simulateNewDetection() {
  const rest = RESTAURANTS_DATA[staffRestaurantId];
  if (!rest.tables.length) return;
  const randomTable = rest.tables[Math.floor(Math.random() * rest.tables.length)];
  const isNowOccupied = randomTable.liveStatus !== "occupied";
  const detectedSeats = isNowOccupied ? Math.max(1, Math.floor(Math.random() * randomTable.seats) + 1) : 0;
  const conf = Number((0.86 + Math.random() * 0.12).toFixed(2));

  randomTable.liveStatus = isNowOccupied ? "occupied" : "free";
  randomTable.liveLabel = isNowOccupied ? `Zajęty (YOLO: ${detectedSeats} os.)` : "Wolny — Kliknij";
  randomTable.seats_detected = detectedSeats;
  randomTable.confidence = conf;

  rest.detections.unshift({
    id: Date.now(),
    table_id: randomTable.id,
    table_number: randomTable.name,
    camera_id: rest.cameras[0] ? rest.cameras[0].id : 1,
    seats_detected: detectedSeats,
    occupied: isNowOccupied,
    confidence: conf,
    detected_at: new Date().toISOString()
  });

  renderStaffPanel();
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.setAttribute("data-theme", "hub");
  renderRestaurantsList();
  resetStaffReservationDates();

  const liveForm = document.getElementById("live-reservation-form");
  if (liveForm) {
    liveForm.addEventListener("submit", handleLiveBookingSubmit);
  }

  const bookingForm = document.getElementById("reservation-form");
  if (bookingForm) {
    bookingForm.addEventListener("submit", handleBookingSubmit);
  }
});
