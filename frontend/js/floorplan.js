// ==========================================================================
// Plik: js/floorplan.js — Generator rzutów architektonicznych sali,
// krzeseł wokół blatów oraz pasków zajętości LIVE
// ==========================================================================

function buildChairsHTML(seatsCount, position) {
  const half = Math.ceil(seatsCount / 2);
  let chairs = "";
  for (let i = 0; i < half; i++) {
    chairs += `<span class="chair" aria-hidden="true"></span>`;
  }
  return `<div class="chairs-row ${position}">${chairs}</div>`;
}

function buildTableNodesHTML(tables, mode) {
  const filterTimeEl = document.getElementById("booking-time");
  const filterGuestsEl = document.getElementById("booking-guests");
  const selectedTime = filterTimeEl ? filterTimeEl.value : "18:00";
  const requiredSeats = filterGuestsEl ? parseInt(filterGuestsEl.value, 10) || 2 : 2;

  return tables
    .filter((t) => t.is_active !== false)
    .map((t) => {
      let statusClass = "";
      let badgeText = "";
      let interactionClass = "clickable";
      let onClickAttr = "";

      if (mode === "live") {
        statusClass = `status-${t.liveStatus}`;
        const isInspected = inspectedLiveTable && inspectedLiveTable.id === t.id;
        if (isInspected) {
          statusClass += " selected-table";
        }

        if (t.liveStatus === "free") {
          badgeText = isInspected ? "✓ W INSPEKTORZE" : "Wolny (do 1h)";
        } else if (t.liveStatus === "occupied") {
          badgeText = `YOLO: ${t.seats_detected || t.seats}/${t.seats} os.`;
        } else if (t.liveStatus === "reserved") {
          badgeText = "Rezerwacja";
        } else {
          badgeText = "Do sprzątania";
        }
        onClickAttr = `onclick="chooseTableForLiveBooking(${t.id})"`;
      } else if (mode === "staff") {
        statusClass = `status-${t.liveStatus}`;
        badgeText = `${statusLabel(t.liveStatus).toUpperCase()} (${t.seats_detected || 0}/${t.seats} os.)`;
        onClickAttr = `onclick="cycleStaffTableStatus(${t.id})" title="Kliknij, aby przełączyć status stolika"`;
      } else {
        const isBookedOnSlot = t.bookedSlots && t.bookedSlots.includes(selectedTime);
        const isTooSmall = t.seats < requiredSeats;

        if (isBookedOnSlot) {
          statusClass = "status-reserved";
          badgeText = `Zajęty (${selectedTime})`;
          interactionClass = "not-allowed";
        } else if (isTooSmall) {
          statusClass = "status-disabled";
          badgeText = `Za mały (${t.seats} os.)`;
          interactionClass = "not-allowed";
        } else {
          statusClass = "status-free";
          const isSelected = selectedTableForBooking && selectedTableForBooking.id === t.id;
          if (isSelected) {
            statusClass += " selected-table";
            badgeText = "✓ WYBRANY STOLIK";
          } else {
            badgeText = "Wolny — Wybierz";
          }
          onClickAttr = `onclick="chooseTableForBooking(${t.id})"`;
        }
      }

      const sizeBucket = [2, 4, 6, 8].includes(Number(t.seats)) ? Number(t.seats) : 4;

      return `
        <div class="table-fixture seats-${sizeBucket} ${statusClass} ${interactionClass}" ${onClickAttr} id="${mode}-table-${t.id}">
          ${buildChairsHTML(sizeBucket, "top")}
          <div class="table-top">
            <div class="table-top-title">${t.name}</div>
            <div class="table-top-meta">${t.seats} os. • ${t.zone || "Sala"}</div>
            <span class="table-top-badge">${badgeText}</span>
          </div>
          ${buildChairsHTML(sizeBucket, "bottom")}
        </div>
      `;
    })
    .join("");
}

function generateArchitecturalPlanHTML(tables, mode, overrideRestId = null) {
  const restId = overrideRestId || currentRestaurantId || staffRestaurantId || "bistro-agh";
  const rest = RESTAURANTS_DATA[restId];
  const tablesHTML = buildTableNodesHTML(tables, mode);

  let modePillHTML = "";
  if (mode === "live") {
    modePillHTML = `<span class="arch-camera-pill"><span class="cam-pulse"></span> YOLO VISION STREAM • KLIKNIJ STOLIK</span>`;
  } else if (mode === "staff") {
    modePillHTML = `<span class="arch-camera-pill"><span class="cam-pulse"></span> TRYB PRACOWNIKA • KLIKNIJ STOLIK, ABY ZMIENIĆ STATUS</span>`;
  } else {
    modePillHTML = `<span class="arch-camera-pill" style="background:var(--primary);">KALENDARZ REZERWACJI • WSKAŻ ZIELONY STOLIK</span>`;
  }

  if (rest.layoutType === "bistro") {
    return `
      <div class="arch-blueprint floor-bistro">
        <div class="arch-top-bar">
          <span class="arch-door-pill">🚪 WEJŚCIE OD UL. REYMONTA</span>
          <span class="arch-window-pill">🪟 PANORAMICZNA WITRYNA &amp; KOPUŁA</span>
          ${modePillHTML}
        </div>

        <div class="arch-tables-grid grid-bistro">
          ${tablesHTML}
        </div>

        <div class="arch-bottom-zones">
          <div class="arch-zone-bar">
            <span>🍷 KONTUAR BISTRO, WINIARNIA SOMMELIERA &amp; WYDAWKA</span>
            <span class="zone-tag">BAR &amp; KUCHNIA</span>
          </div>
          <div class="arch-zone-wc">
            <span>🚻 TOALETY GOŚCI</span>
            <span class="zone-tag">WC</span>
          </div>
        </div>
      </div>
    `;
  }

  if (rest.layoutType === "trattoria") {
    return `
      <div class="arch-blueprint floor-trattoria">
        <div class="arch-top-bar">
          <span class="arch-door-pill">🚪 WEJŚCIE Z WŁOSKIEGO PATIO</span>
          ${modePillHTML}
          <span class="arch-window-pill">🪟 RZYMSKIE ARKADY OKIENNE</span>
        </div>

        <div class="arch-middle-trattoria">
          <aside class="trattoria-side-oven">
            <div>🔥 PIEC CHLEBOWY (FORNO A LEGNA)</div>
            <div style="font-size:2rem; margin: 10px 0;">🍕</div>
            <div>WYDAWKA MAKARONÓW</div>
            <div class="zone-tag" style="background:#450a0a;">KUCHNIA</div>
          </aside>

          <div class="arch-tables-grid grid-trattoria">
            ${tablesHTML}
          </div>
        </div>

        <div class="arch-bottom-zones">
          <div class="arch-zone-wc">
            <span>🚻 TOALETY PRZY OGRODZIE ZIMOWYM</span>
            <span class="zone-tag">WC</span>
          </div>
          <div class="arch-zone-bar" style="background:#fef3c7;">
            <span>🌿 TARAS WŁOSKI &amp; MAGAZYN WIN CHIANTI</span>
            <span class="zone-tag">WINNICA</span>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="arch-blueprint floor-sushi">
      <div class="arch-top-bar">
        <span class="arch-window-pill" style="background:#0f172a; color:#38bdf8; border-color:#0284c7;">🎋 WITRYNA BAMBUSOWA &amp; LAMPIONY</span>
        ${modePillHTML}
        <span class="arch-door-pill">🚪 WEJŚCIE PRZEZ ZASŁONĘ NOREN</span>
      </div>

      <div class="sushi-top-counter">
        <span>🍣 OTWARTY KONTUAR SUSHI MASTER &amp; KOTŁY RAMEN</span>
        <span class="zone-tag" style="background:#e11d48;">LIVE COOKING</span>
      </div>

      <div class="arch-tables-grid grid-sushi">
        ${tablesHTML}
      </div>

      <div class="arch-bottom-zones">
        <div class="arch-zone-bar" style="background:#1e293b; color:#f8fafc; border-color:#475569;">
          <span>🍵 KĄCIK HERBATY MATCHA &amp; OGRÓD KAMIENNY ZEN</span>
          <span class="zone-tag" style="background:#10b981;">STREFA ZEN</span>
        </div>
        <div class="arch-zone-wc" style="background:#1e293b; color:#f8fafc; border-color:#475569;">
          <span>🚻 TOALETY GOŚCI</span>
          <span class="zone-tag">WC</span>
        </div>
      </div>
    </div>
  `;
}

function renderAllFloorPlans() {
  const restId = currentRestaurantId || staffRestaurantId;
  const rest = RESTAURANTS_DATA[restId];
  if (!rest) return;

  const activeTables = rest.tables.filter((t) => t.is_active !== false);
  const freeCount = activeTables.filter((t) => t.liveStatus === "free").length;
  const occCount = activeTables.filter((t) => t.liveStatus === "occupied").length;
  const resCount = activeTables.filter((t) => t.liveStatus === "reserved").length;

  const occStrip = document.getElementById("live-occupancy-pills");
  if (occStrip) {
    occStrip.innerHTML = `
      <span class="occ-chip free">● ${freeCount} wolnych</span>
      <span class="occ-chip occupied">● ${occCount} zajętych (YOLO)</span>
      <span class="occ-chip reserved">● ${resCount} zarezerwowanych</span>
    `;
  }

  const homeFreeSummary = document.getElementById("home-restaurant-free-summary");
  if (homeFreeSummary) {
    homeFreeSummary.textContent = `🟢 Wolne stoliki LIVE: ${freeCount} z ${activeTables.length}`;
  }

  const liveContainer = document.getElementById("live-floor-map-container");
  if (liveContainer) {
    liveContainer.innerHTML = generateArchitecturalPlanHTML(rest.tables, "live", restId);
  }

  const bookingMapContainer = document.getElementById("booking-floor-map-container");
  if (bookingMapContainer) {
    bookingMapContainer.innerHTML = generateArchitecturalPlanHTML(rest.tables, "booking", restId);
  }
}
