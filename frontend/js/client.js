// ==========================================================================
// Plik: js/client.js — Nawigacja SPA, wybór restauracji, Inspektor Stolika
// LIVE, Karta Dań oraz obsługa rezerwacji klienta z zapisem do FastAPI
// ==========================================================================

let lastClientReservations = {
  live: null,
  calendar: null
};

function navigateTo(viewId) {
  // Zabezpieczenie panelu pracownika przed wejściem bez zalogowania (admin / admin)
  if (viewId === "view-staff-panel" && typeof isStaffAuthenticated === "function" && !isStaffAuthenticated()) {
    viewId = "view-staff-login";
  }

  const isStaffView = viewId === "view-staff-login" || viewId === "view-staff-panel";
  const wasInRestaurant = currentRestaurantId !== null;

  if (!isStaffView && viewId !== "view-restaurants" && !currentRestaurantId) {
    viewId = "view-restaurants";
  }

  const views = document.querySelectorAll(".spa-view");
  views.forEach((sec) => sec.classList.remove("active-view"));

  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add("active-view");
  }

  const staffBtn = document.getElementById("staff-portal-btn");
  if (isStaffView) {
    document.body.setAttribute("data-staff-mode", "true");
    if (staffBtn) {
      staffBtn.textContent = "← Wróć do Panelu Klienta";
      staffBtn.setAttribute("onclick", "navigateTo('view-restaurants')");
    }
  } else {
    document.body.removeAttribute("data-staff-mode");
    if (staffBtn) {
      staffBtn.textContent =
        typeof isStaffAuthenticated === "function" && isStaffAuthenticated()
          ? "📊 Panel Pracownika (Aktywny)"
          : "🔒 Panel Pracownika";
      staffBtn.setAttribute("onclick", "openStaffLogin()");
    }
  }

  if (viewId === "view-restaurants") {
    currentRestaurantId = null;
    document.body.setAttribute("data-theme", "hub");
    const brandTitleEl = document.getElementById("header-restaurant-name");
    if (brandTitleEl) brandTitleEl.textContent = "Trackujemy Stoły — Wybór Restauracji";
    renderRestaurantsList();
  } else if (viewId === "view-staff-login") {
    document.body.setAttribute("data-theme", "hub");
    const brandTitleEl = document.getElementById("header-restaurant-name");
    if (brandTitleEl) brandTitleEl.textContent = "StolikAI — Autoryzacja Pracownika";
  } else if (viewId === "view-staff-panel") {
    document.body.setAttribute("data-theme", staffRestaurantId);
    const rest = RESTAURANTS_DATA[staffRestaurantId];
    const brandTitleEl = document.getElementById("header-restaurant-name");
    if (brandTitleEl && rest) brandTitleEl.textContent = `Panel Pracownika — ${rest.name}`;
  } else {
    document.body.setAttribute("data-theme", currentRestaurantId);
    const rest = RESTAURANTS_DATA[currentRestaurantId];
    const brandTitleEl = document.getElementById("header-restaurant-name");
    if (brandTitleEl && rest) brandTitleEl.textContent = rest.name;
  }

  const navButtons = document.querySelectorAll(".main-nav .nav-btn[data-target]");
  navButtons.forEach((btn) => {
    const btnTarget = btn.getAttribute("data-target");
    const isHubActive = viewId === "view-reservation-hub" && btnTarget === "view-booking-form";
    btn.classList.toggle("active", btnTarget === viewId || isHubActive);
  });

  if (viewId === "view-restaurants" && wasInRestaurant) {
    const cardsListEl = document.getElementById("restaurants-aggregator-list");
    const headerEl = document.getElementById("main-header");
    if (cardsListEl) {
      const headerOffset = (headerEl ? headerEl.offsetHeight : 72) + 18;
      const targetTop = cardsListEl.getBoundingClientRect().top + window.pageYOffset - headerOffset;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      return;
    }
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function filterCuisine(cuisineType) {
  currentCuisineFilter = cuisineType;
  const pills = document.querySelectorAll(".cuisine-pill[data-cuisine]");
  pills.forEach((p) => {
    p.classList.toggle("active", p.getAttribute("data-cuisine") === cuisineType);
  });
  renderRestaurantsList();
}

async function selectRestaurant(restaurantId, targetView = "view-home") {
  if (!RESTAURANTS_DATA[restaurantId]) return;
  currentRestaurantId = restaurantId;
  staffRestaurantId = restaurantId;

  await syncPublicTablesFromApi(restaurantId);

  const rest = RESTAURANTS_DATA[restaurantId];
  const firstFree = rest.tables.find((t) => t.liveStatus === "free" && t.is_active !== false) || rest.tables[0];
  inspectedLiveTable = firstFree || null;
  selectedTableForLive = firstFree && firstFree.liveStatus === "free" ? firstFree : null;
  selectedTableForBooking = null;

  document.body.setAttribute("data-theme", currentRestaurantId);
  renderCurrentRestaurant();

  if (targetView === true) {
    navigateTo("view-home");
  } else if (typeof targetView === "string") {
    navigateTo(targetView);
  }
}

function chooseTableForLiveBooking(tableId) {
  const rest = RESTAURANTS_DATA[currentRestaurantId];
  if (!rest) return;
  const tableObj = rest.tables.find((t) => t.id === tableId);
  if (!tableObj) return;

  inspectedLiveTable = tableObj;
  selectedTableForLive = tableObj.liveStatus === "free" ? tableObj : null;

  const liveConfirmBox = document.getElementById("live-booking-confirmation");
  if (liveConfirmBox) liveConfirmBox.classList.remove("visible");

  renderAllFloorPlans();
  updateLiveConfirmationStepVisibility();
}

function updateLiveConfirmationStepVisibility() {
  const titleEl = document.getElementById("inspector-table-title");
  const badgeEl = document.getElementById("inspector-table-badge");
  const descEl = document.getElementById("inspector-table-desc");
  const confEl = document.getElementById("insp-confidence");
  const seatsEl = document.getElementById("insp-seats");
  const zoneEl = document.getElementById("insp-zone");
  const detectedEl = document.getElementById("insp-detected");

  const liveStepCard = document.getElementById("live-step-confirm");
  const unavailBox = document.getElementById("inspector-unavailable-box");
  const liveBannerInfo = document.getElementById("live-selected-table-summary");
  const offsetSelect = document.getElementById("live-arrival-offset");
  const offsetLabel = offsetSelect ? offsetSelect.options[offsetSelect.selectedIndex].text : "Za 15 minut";

  if (!inspectedLiveTable) {
    if (liveStepCard) liveStepCard.style.display = "none";
    if (unavailBox) unavailBox.style.display = "none";
    return;
  }

  const t = inspectedLiveTable;
  if (titleEl) titleEl.textContent = t.name;
  if (badgeEl) {
    badgeEl.className = `staff-badge ${t.liveStatus}`;
    badgeEl.textContent =
      t.liveStatus === "free"
        ? "DOSTĘPNY OD ZARAZ"
        : t.liveStatus === "occupied"
        ? "ZAJĘTY"
        : statusLabel(t.liveStatus).toUpperCase();
  }

  if (descEl) {
    descEl.textContent =
      t.liveStatus === "free"
        ? "Stolik jest wolny w pamięci backendu FastAPI. Możesz zablokować go ekspresowo na przyjście w ciągu 15–60 minut."
        : `Backend FastAPI zwraca status: ${statusLabel(t.liveStatus)}. Wybierz inny zielony stolik lub zarezerwuj ten stolik na późniejszy dzień.`;
  }

  if (confEl) {
    confEl.textContent =
      t.confidence != null ? `${Math.round(t.confidence * 100)}% pewności` : "Brak kamery (—)";
  }
  if (seatsEl) seatsEl.textContent = `${t.seats}-osobowy`;
  if (zoneEl) zoneEl.textContent = t.zone || "Sala główna";
  if (detectedEl) {
    detectedEl.textContent =
      t.seats_detected != null ? `${t.seats_detected} / ${t.seats} os.` : "Brak kamery (—)";
  }

  if (t.liveStatus === "free") {
    selectedTableForLive = t;
    if (liveStepCard) liveStepCard.style.display = "block";
    if (unavailBox) unavailBox.style.display = "none";
    if (liveBannerInfo) {
      liveBannerInfo.innerHTML = `
        Ekspresowa blokada: <strong>${t.name} (${t.seats} os., ${t.zone})</strong> • Przyjście: <strong>${offsetLabel}</strong>
      `;
    }
  } else {
    selectedTableForLive = null;
    if (liveStepCard) liveStepCard.style.display = "none";
    if (unavailBox) unavailBox.style.display = "block";
  }
}

function jumpFromInspectorToCalendarBooking() {
  if (inspectedLiveTable) {
    const guestsSelect = document.getElementById("booking-guests");
    if (guestsSelect) {
      const targetSeats = [2, 4, 6, 8].includes(inspectedLiveTable.seats)
        ? String(inspectedLiveTable.seats)
        : "2";
      guestsSelect.value = targetSeats;
    }
    selectedTableForBooking = inspectedLiveTable;
  }
  navigateTo("view-booking-form");
  updateBookingFloorFilter();
}

async function updateBookingFloorFilter() {
  const rest = RESTAURANTS_DATA[currentRestaurantId];
  if (!rest) return;

  if (BACKEND_ONLINE) {
    await syncPublicTablesFromApi(currentRestaurantId);
  }

  const filterTime = document.getElementById("booking-time").value;
  const requiredSeats = parseInt(document.getElementById("booking-guests").value, 10) || 2;

  if (selectedTableForBooking) {
    const tableObj = rest.tables.find((t) => t.id === selectedTableForBooking.id);
    if (!tableObj || tableObj.seats < requiredSeats || tableObj.bookedSlots.includes(filterTime)) {
      selectedTableForBooking = null;
    }
  }

  renderAllFloorPlans();
  updateConfirmationStepVisibility();
}

function chooseTableForBooking(tableId) {
  const rest = RESTAURANTS_DATA[currentRestaurantId];
  if (!rest) return;
  const tableObj = rest.tables.find((t) => t.id === tableId);
  if (!tableObj) return;

  selectedTableForBooking = tableObj;
  renderAllFloorPlans();
  updateConfirmationStepVisibility();

  const stepCard = document.getElementById("booking-step-confirm");
  if (stepCard) {
    stepCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function updateConfirmationStepVisibility() {
  const bannerInfo = document.getElementById("selected-table-summary-text");
  const dateVal = document.getElementById("booking-date") ? document.getElementById("booking-date").value : getTomorrowDateStr();
  const timeVal = document.getElementById("booking-time") ? document.getElementById("booking-time").value : "18:00";
  const guestsSelect = document.getElementById("booking-guests");
  const guestsLabel = guestsSelect ? guestsSelect.options[guestsSelect.selectedIndex].text : "2 osoby";

  if (!bannerInfo) return;

  if (!selectedTableForBooking) {
    bannerInfo.innerHTML = `Kliknij dowolny <strong>wolny (zielony) stolik</strong> na planie sali powyżej, aby przypisać go do rezerwacji na <strong>${dateVal}, godz. ${timeVal}</strong>.`;
  } else {
    bannerInfo.innerHTML = `
      ✓ Wybrany stolik: <strong>${selectedTableForBooking.name} (${selectedTableForBooking.seats}-osobowy, ${selectedTableForBooking.zone})</strong>
      &nbsp;|&nbsp; Termin: <strong>${dateVal}, godz. ${timeVal}</strong> (${guestsLabel})
    `;
  }
}

function renderCurrentRestaurant() {
  if (!currentRestaurantId || !RESTAURANTS_DATA[currentRestaurantId]) return;
  const rest = RESTAURANTS_DATA[currentRestaurantId];

  const heroCuisineBadge = document.getElementById("home-restaurant-cuisine");
  if (heroCuisineBadge) heroCuisineBadge.textContent = rest.cuisine;

  const heroTitleEl = document.getElementById("home-restaurant-title");
  if (heroTitleEl) heroTitleEl.textContent = rest.name;

  const heroTaglineEl = document.getElementById("home-restaurant-tagline");
  if (heroTaglineEl) heroTaglineEl.textContent = rest.tagline;

  const heroAddressEl = document.getElementById("home-restaurant-address");
  if (heroAddressEl) heroAddressEl.textContent = "📍 " + rest.address;

  const heroHoursEl = document.getElementById("home-restaurant-hours");
  if (heroHoursEl) heroHoursEl.textContent = "🕒 Godziny otwarcia: " + rest.hours;

  renderMenuSection("menu-starters", rest.menu.przystawki);
  renderMenuSection("menu-mains", rest.menu.glowne);
  renderMenuSection("menu-drinks", rest.menu.napoje);

  renderAllFloorPlans();
  updateLiveConfirmationStepVisibility();
  updateConfirmationStepVisibility();

  const confirmBox = document.getElementById("booking-confirmation");
  if (confirmBox) confirmBox.classList.remove("visible");

  const liveConfirmBox = document.getElementById("live-booking-confirmation");
  if (liveConfirmBox) liveConfirmBox.classList.remove("visible");
}

function renderMenuSection(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = items
    .map(
      (item) => `
      <div class="menu-item">
        <div>
          <div class="menu-item-name">
            <span>${item.name}</span>
            ${item.tag ? `<span class="dish-tag">${item.tag}</span>` : ""}
          </div>
          <div class="menu-item-desc">${item.desc}</div>
        </div>
        <div class="menu-item-price">${item.price}</div>
      </div>
    `
    )
    .join("");
}

function renderRestaurantsList() {
  const allRests = Object.values(RESTAURANTS_DATA);

  let totalTables = 0;
  let totalFree = 0;

  allRests.forEach((r) => {
    const active = r.tables.filter((t) => t.is_active !== false);
    totalTables += active.length;
    totalFree += active.filter((t) => t.liveStatus === "free").length;
  });

  const barometerEl = document.getElementById("hub-barometer-stats");
  if (barometerEl) {
    barometerEl.innerHTML = `
      <div class="barometer-card">
        <div class="barometer-label">Aktywne lokale</div>
        <div class="barometer-value">${allRests.length} restauracje</div>
      </div>
      <div class="barometer-card">
        <div class="barometer-label">Moduł kamery YOLO</div>
        <div class="barometer-value" style="font-size:1.15rem; color:var(--on-surface-variant);">Niepodpięty (Placeholder)</div>
      </div>
      <div class="barometer-card">
        <div class="barometer-label">Warstwa danych API</div>
        <div class="barometer-value highlight-terracotta" style="font-size:1.15rem;">Pamięć RAM (tymczasowa)</div>
      </div>
      <div class="barometer-card">
        <div class="barometer-label">Wolne stoliki (z API)</div>
        <div class="barometer-value highlight-green">${totalFree} / ${totalTables} wolnych</div>
      </div>
    `;
  }

  const listContainer = document.getElementById("restaurants-aggregator-list");
  if (!listContainer) return;

  const filtered = allRests.filter((r) => {
    if (currentCuisineFilter === "all") return true;
    return r.layoutType === currentCuisineFilter;
  });

  listContainer.innerHTML = filtered
    .map((r) => {
      const active = r.tables.filter((t) => t.is_active !== false);
      const freeCount = active.filter((t) => t.liveStatus === "free").length;
      const busyCount = active.length - freeCount;
      const occupancyPct = active.length ? Math.round((busyCount / active.length) * 100) : 0;

      return `
      <article class="restaurant-card">
        <div class="restaurant-card-banner" style="background-image: url('${r.bannerImage}'); cursor: pointer;" onclick="selectRestaurant('${r.id}', 'view-home')" title="Otwórz stronę główną lokalu">
          <div class="banner-top-badges">
            <span class="yolo-floating-pill">
              <span class="pulse-dot"></span>
              ${freeCount} z ${active.length} wolnych (z API)
            </span>
            <span class="rating-chip">★ ${r.rating || "4.9"}</span>
          </div>
          <div class="banner-bottom-info">
            <span class="banner-feature-tag">${r.interiorFeature || "Rzut Sali"}</span>
          </div>
        </div>

        <div class="restaurant-card-body">
          <div>
            <div class="rest-cuisine-overline">${r.cuisine}</div>
            <h3 class="rest-card-title" style="cursor:pointer;" onclick="selectRestaurant('${r.id}', 'view-home')">${r.name}</h3>
            <div class="rest-meta-line">
              <span>📍 ${r.address}</span>
              <span>🕒 ${r.hours}</span>
            </div>
            <p class="rest-tagline">${r.tagline}</p>

            <div class="occupancy-meter-box">
              <div class="occupancy-meter-header">
                <span>ZAREZERWOWANE / ZAJĘTE (API)</span>
                <span>${occupancyPct}% ZAJĘTYCH</span>
              </div>
              <div class="occupancy-bar-track">
                <div class="occupancy-bar-fill" style="width: ${occupancyPct}%;"></div>
              </div>
            </div>
          </div>

          <div class="card-actions-stack">
            <div class="card-actions-label">Wybierz sekcję lokalu:</div>

            <button type="button" class="card-option-btn primary-opt" onclick="selectRestaurant('${r.id}', 'view-live-floor')">
              <div>
                <span class="opt-title">🟢 Rezerwacja LIVE (do 1h)</span>
                <span class="opt-desc">Stan sali na żywo z kamery YOLO i blokada od ręki</span>
              </div>
              <span class="opt-arrow">&rarr;</span>
            </button>

            <button type="button" class="card-option-btn" onclick="selectRestaurant('${r.id}', 'view-booking-form')">
              <div>
                <span class="opt-title">📅 Rezerwacja na wybrany dzień</span>
                <span class="opt-desc">Wybierz datę z kalendarza, godzinę i stolik na mapie</span>
              </div>
              <span class="opt-arrow">&rarr;</span>
            </button>

            <button type="button" class="card-option-btn" onclick="selectRestaurant('${r.id}', 'view-menu')">
              <div>
                <span class="opt-title">📖 Zobacz Menu (Karta Dań)</span>
                <span class="opt-desc">Przystawki, dania główne oraz karta win i napojów</span>
              </div>
              <span class="opt-arrow">&rarr;</span>
            </button>
          </div>
        </div>
      </article>
    `;
    })
    .join("");
}

// Rezerwacja ekspresowa LIVE (POST /api/v1/reservations z flagą express_live: true)
async function handleLiveBookingSubmit(event) {
  event.preventDefault();

  if (!selectedTableForLive) {
    alert("Najpierw kliknij wolny (zielony) stolik na planie sali LIVE.");
    return;
  }

  const rest = RESTAURANTS_DATA[currentRestaurantId];
  const offsetSelect = document.getElementById("live-arrival-offset");
  const offsetMinutes = parseInt(offsetSelect.value, 10) || 15;
  const arrivalText = offsetSelect.options[offsetSelect.selectedIndex].text;
  const nameVal = document.getElementById("live-booking-name").value.trim();
  const emailVal = document.getElementById("live-booking-email").value.trim();
  const phoneVal = document.getElementById("live-booking-phone").value.trim();
  const bookedTable = selectedTableForLive;

  let displayCode = "";

  if (await checkBackendHealth()) {
    try {
      const startIso = new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
      const created = await apiCreateReservation({
        restaurant_id: currentRestaurantId,
        table_id: bookedTable.id,
        guest_name: nameVal,
        guest_email: emailVal,
        guest_phone: phoneVal || null,
        party_size: bookedTable.seats,
        starts_at: startIso,
        notes: `Szybka rezerwacja LIVE (${arrivalText})`,
        express_live: true
      });

      lastClientReservations.live = {
        id: created.id,
        token: created.cancel_token
      };
      displayCode = `#ID-${created.id} (token: ${created.cancel_token.slice(0, 8)}…)`;
      await syncPublicTablesFromApi(currentRestaurantId);
    } catch (err) {
      alert(`Nie udało się zapisać rezerwacji LIVE w API:\n${err.message}`);
      return;
    }
  } else {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let suffix = "";
    for (let i = 0; i < 4; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    const cancelCode = `TK-${suffix}`;
    displayCode = `#${cancelCode}`;
    lastClientReservations.live = { id: Date.now(), token: null, localTableId: bookedTable.id };

    bookedTable.liveStatus = "reserved";
    bookedTable.liveLabel = `Zarezerwowany (${arrivalText})`;

    const startIso = new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
    const endIso = new Date(Date.now() + (offsetMinutes + 90) * 60 * 1000).toISOString();
    rest.reservations.unshift({
      id: lastClientReservations.live.id,
      guest_name: nameVal,
      guest_phone: phoneVal,
      guest_email: emailVal,
      party_size: bookedTable.seats,
      table_id: bookedTable.id,
      table_number: bookedTable.name,
      starts_at: startIso,
      ends_at: endIso,
      status: "confirmed",
      notes: `Szybka rezerwacja LIVE (${arrivalText})`,
      cancel_code: cancelCode
    });
  }

  const summaryList = document.getElementById("live-confirmation-summary-list");
  if (summaryList) {
    summaryList.innerHTML = `
      <li><strong>Lokal:</strong> ${rest.name}</li>
      <li><strong>Stolik:</strong> ${bookedTable.name} (${bookedTable.seats} os. — ${bookedTable.zone})</li>
      <li><strong>Przyjście:</strong> Dzisiaj, ${arrivalText}</li>
      <li><strong>Gość:</strong> ${nameVal} (${phoneVal})</li>
    `;
  }

  const codeEl = document.getElementById("live-confirmation-code");
  if (codeEl) codeEl.textContent = displayCode;

  renderAllFloorPlans();
  renderRestaurantsList();
  updateLiveConfirmationStepVisibility();

  const confirmBox = document.getElementById("live-booking-confirmation");
  if (confirmBox) confirmBox.classList.add("visible");
}

// Rezerwacja kalendarzowa na wybrany dzień (POST /api/v1/reservations)
async function handleBookingSubmit(event) {
  event.preventDefault();

  if (!selectedTableForBooking) {
    alert("Najpierw kliknij wolny (zielony) stolik na planie sali powyżej.");
    return;
  }

  const rest = RESTAURANTS_DATA[currentRestaurantId];
  const dateVal = document.getElementById("booking-date").value;
  const timeVal = document.getElementById("booking-time").value;
  const guestsSelect = document.getElementById("booking-guests");
  const guestsVal = guestsSelect.options[guestsSelect.selectedIndex].text;
  const partySizeNum = parseInt(guestsSelect.value, 10) || 2;
  const nameVal = document.getElementById("booking-name").value.trim();
  const emailVal = document.getElementById("booking-email").value.trim();
  const phoneVal = document.getElementById("booking-phone").value.trim();
  const notesVal = document.getElementById("booking-notes").value.trim() || "Brak uwag";
  const chosenTable = selectedTableForBooking;

  let displayCode = "";

  if (await checkBackendHealth()) {
    try {
      const startsAtAware = buildAwareISO(dateVal, timeVal);
      const created = await apiCreateReservation({
        restaurant_id: currentRestaurantId,
        table_id: chosenTable.id,
        guest_name: nameVal,
        guest_email: emailVal,
        guest_phone: phoneVal || null,
        party_size: partySizeNum,
        starts_at: startsAtAware,
        notes: notesVal,
        express_live: false
      });

      lastClientReservations.calendar = {
        id: created.id,
        token: created.cancel_token
      };
      displayCode = `#ID-${created.id} • Token: ${created.cancel_token.slice(0, 10)}…`;
      await syncPublicTablesFromApi(currentRestaurantId);
    } catch (err) {
      alert(`Nie udało się zapisać rezerwacji w API:\n${err.message}`);
      return;
    }
  } else {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let suffix = "";
    for (let i = 0; i < 4; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    const cancelCode = `TK-${suffix}`;
    displayCode = `#${cancelCode}`;
    lastClientReservations.calendar = { id: Date.now(), token: null, slot: timeVal, localTableId: chosenTable.id };

    if (!chosenTable.bookedSlots.includes(timeVal)) {
      chosenTable.bookedSlots.push(timeVal);
    }

    const startDate = new Date(`${dateVal}T${timeVal}:00`);
    const endDate = new Date(startDate.getTime() + 90 * 60 * 1000);
    rest.reservations.unshift({
      id: lastClientReservations.calendar.id,
      guest_name: nameVal,
      guest_phone: phoneVal,
      guest_email: emailVal,
      party_size: partySizeNum,
      table_id: chosenTable.id,
      table_number: chosenTable.name,
      starts_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
      status: "confirmed",
      notes: notesVal,
      cancel_code: cancelCode
    });
  }

  const summaryList = document.getElementById("confirmation-summary-list");
  if (summaryList) {
    summaryList.innerHTML = `
      <li><strong>Lokal:</strong> ${rest.name}</li>
      <li><strong>Wybrany stolik:</strong> ${chosenTable.name} (${chosenTable.seats} os. — ${chosenTable.zone})</li>
      <li><strong>Termin:</strong> ${dateVal}, godz. ${timeVal} (90 min)</li>
      <li><strong>Liczba gości:</strong> ${guestsVal}</li>
      <li><strong>Gość:</strong> ${nameVal} (${emailVal}, tel. ${phoneVal})</li>
      <li><strong>Uwagi:</strong> ${notesVal}</li>
    `;
  }

  const codeEl = document.getElementById("confirmation-code");
  if (codeEl) codeEl.textContent = displayCode;

  renderAllFloorPlans();
  updateConfirmationStepVisibility();

  const confirmBox = document.getElementById("booking-confirmation");
  if (confirmBox) {
    confirmBox.classList.add("visible");
    confirmBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// Anulowanie rezerwacji przez klienta przy użyciu tokena z backendu (POST /api/v1/reservations/{id}/cancel?token=...)
async function cancelClientReservation(type) {
  const saved = lastClientReservations[type];
  if (!saved) return;

  if (BACKEND_ONLINE && saved.token) {
    try {
      await apiCancelReservation(saved.id, saved.token);
      await syncPublicTablesFromApi(currentRestaurantId);
    } catch (err) {
      alert(`Błąd anulowania w API: ${err.message}`);
      return;
    }
  } else if (currentRestaurantId) {
    const rest = RESTAURANTS_DATA[currentRestaurantId];
    const r = rest.reservations.find((x) => x.id === saved.id);
    if (r) r.status = "cancelled";
    const tbl = rest.tables.find((t) => t.id === saved.localTableId);
    if (tbl) {
      if (type === "live") tbl.liveStatus = "free";
      if (saved.slot) tbl.bookedSlots = tbl.bookedSlots.filter((s) => s !== saved.slot);
    }
  }

  lastClientReservations[type] = null;
  const boxId = type === "live" ? "live-booking-confirmation" : "booking-confirmation";
  const boxEl = document.getElementById(boxId);
  if (boxEl) boxEl.classList.remove("visible");

  renderAllFloorPlans();
  renderRestaurantsList();
  updateLiveConfirmationStepVisibility();
  updateConfirmationStepVisibility();
  alert("Rezerwacja została anulowana, a stolik jest ponownie wolny.");
}
