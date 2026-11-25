// ==========================================================================
// Plik: js/data.js — Słownik statusów, baza danych 3 restauracji,
// współdzielony stan aplikacji oraz funkcje pomocnicze daty/czasu
// ==========================================================================

const STATUS_LABELS = {
  free: "wolny",
  occupied: "zajęty",
  reserved: "zarezerwowany",
  dirty: "do sprzątania",
  online: "włączona",
  offline: "wyłączona",
  error: "błąd",
  confirmed: "potwierdzona",
  seated: "w trakcie",
  completed: "zakończona",
  cancelled: "anulowana",
  no_show: "nieobecność"
};

function statusLabel(status) {
  if (!status) return "";
  return STATUS_LABELS[status] || status;
}

function statusBadgeHTML(status) {
  if (!status) return "";
  return `<span class="staff-badge ${status}">${statusLabel(status)}</span>`;
}

// Wspólna baza danych 3 restauracji (łączy Panel Klienta w stylu Google Stitch oraz Panel Pracownika StolikAI)
const RESTAURANTS_DATA = {
  "bistro-agh": {
    id: "bistro-agh",
    layoutType: "bistro",
    rating: "4.9",
    interiorFeature: "Historyczna Przeszklona Kopuła",
    name: "Restauracja & Bistro Pod Kopułą",
    cuisine: "🍷 Kuchnia polska i europejska • Winiarnia",
    address: "ul. Reymonta 17, Kraków",
    hours: "12:00 – 22:00",
    bannerImage: "assets/bg_bistro.svg",
    tagline: "Historyczna przeszklona kopuła, dębowy parkiet, ciepłe światło lamp Edison i podgląd wolnych stolików na żywo.",
    menu: {
      przystawki: [
        { name: "Tatar wołowy z polędwicy", tag: "Bestseller", desc: "Szalotka, ogórek kiszony, grzybki marynowane, żółtko, pieczywo żytnie (180g)", price: "42 zł" },
        { name: "Bruschetta z pomidorami malinowymi", tag: "Wegetariańskie", desc: "Chrupiąca ciabatta, bazylia, czosnek, oliwa extra vergine (160g)", price: "26 zł" },
        { name: "Krem z pieczonych buraków", tag: "Wegetariańskie", desc: "Kozi ser, prażone pestki dyni, świeży tymianek (300ml)", price: "24 zł" }
      ],
      glowne: [
        { name: "Pierś z kaczki sous-vide", tag: "Specjalność Szefa", desc: "Puree ziemniaczano-truflowe, sos wiśniowy, karmelizowane buraczki (320g)", price: "58 zł" },
        { name: "Stek z rostbefu sezonowanego", tag: "Premium", desc: "Pieczone ziemniaki, masło czosnkowo-ziołowe, grillowane szparagi (250g)", price: "79 zł" },
        { name: "Risotto z leśnymi borowikami", tag: "Wegetariańskie", desc: "Ryż Arborio, borowiki, parmezan 24-miesięczny, białe wino (340g)", price: "46 zł" }
      ],
      napoje: [
        { name: "Lemoniada domowa cytrusowo-miętowa", tag: "Orzeźwiające", desc: "Świeżo wyciskane cytryny, pomarańcze, mięta (400 ml)", price: "18 zł" },
        { name: "Kieliszek wina domowego (Białe / Czerwone)", tag: "Sommelier", desc: "Selekcja winiarni Pod Kopułą (150 ml)", price: "22 zł" },
        { name: "Herbata zimowa rozgrzewająca", tag: "Sezonowe", desc: "Czarna herbata, goździki, pomarańcza, syrop malinowy, imbir (350 ml)", price: "19 zł" }
      ]
    },
    tables: [
      { id: 1, name: "Stolik #1", seats: 2, zone: "Witryna Okienna", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: ["19:00"], seats_detected: 0, confidence: 0.94, pos_x: 15, pos_y: 18, is_active: true },
      { id: 2, name: "Stolik #2", seats: 2, zone: "Witryna Okienna", liveStatus: "occupied", liveLabel: "Zajęty (YOLO: 2 os.)", bookedSlots: ["18:00"], seats_detected: 2, confidence: 0.96, pos_x: 35, pos_y: 18, is_active: true },
      { id: 3, name: "Stolik #3", seats: 2, zone: "Witryna Okienna", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: 0, confidence: 0.91, pos_x: 55, pos_y: 18, is_active: true },
      { id: 4, name: "Stolik #4", seats: 2, zone: "Witryna Okienna", liveStatus: "reserved", liveLabel: "Rezerwacja w systemie", bookedSlots: ["18:00", "20:00"], seats_detected: 0, confidence: 0.89, pos_x: 75, pos_y: 18, is_active: true },
      { id: 5, name: "Stolik #5", seats: 4, zone: "Rotunda Pod Kopułą", liveStatus: "dirty", liveLabel: "Do sprzątania", bookedSlots: ["17:00"], seats_detected: 0, confidence: 0.87, pos_x: 20, pos_y: 48, is_active: true },
      { id: 6, name: "Stolik #6", seats: 4, zone: "Rotunda Pod Kopułą", liveStatus: "occupied", liveLabel: "Zajęty (YOLO: 4 os.)", bookedSlots: ["18:00"], seats_detected: 4, confidence: 0.95, pos_x: 45, pos_y: 48, is_active: true },
      { id: 7, name: "Stolik #7", seats: 6, zone: "Rotunda Pod Kopułą", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: ["20:00"], seats_detected: 0, confidence: 0.93, pos_x: 70, pos_y: 48, is_active: true },
      { id: 8, name: "Stół #8 (Pod Kopułą VIP)", seats: 8, zone: "Centrum Kopuły", liveStatus: "occupied", liveLabel: "Zajęty (YOLO: 7 os.)", bookedSlots: ["19:00"], seats_detected: 7, confidence: 0.98, pos_x: 50, pos_y: 65, is_active: true },
      { id: 9, name: "Stolik #9", seats: 4, zone: "Przy Winiarni", liveStatus: "reserved", liveLabel: "Rezerwacja w systemie", bookedSlots: ["18:00"], seats_detected: 0, confidence: 0.92, pos_x: 25, pos_y: 80, is_active: true },
      { id: 10, name: "Stolik #10", seats: 6, zone: "Przy Winiarni", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: 0, confidence: 0.9, pos_x: 55, pos_y: 80, is_active: true },
      { id: 11, name: "Stolik #11", seats: 4, zone: "Kącik Kameralny", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: 0, confidence: 0.91, pos_x: 82, pos_y: 80, is_active: true }
    ],
    cameras: [
      { id: 1, name: "Kamera Kopuła 1 (Witryna)", stream_url: "rtsp://192.168.1.10/stream1", zone_name: "Witryna Okienna", status: "online", model_enabled: true, last_heartbeat: "2026-11-03T19:30:00.000Z" },
      { id: 2, name: "Kamera Kopuła 2 (Rotunda)", stream_url: "rtsp://192.168.1.11/stream1", zone_name: "Rotunda Pod Kopułą", status: "online", model_enabled: true, last_heartbeat: "2026-11-03T19:30:00.000Z" },
      { id: 3, name: "Kamera Winiarnia", stream_url: "rtsp://192.168.1.12/stream1", zone_name: "Przy Winiarni", status: "online", model_enabled: true, last_heartbeat: "2026-11-03T19:29:00.000Z" },
      { id: 4, name: "Kamera VIP", stream_url: "rtsp://192.168.1.13/stream1", zone_name: "Centrum Kopuły", status: "offline", model_enabled: false, last_heartbeat: "2026-11-03T16:00:00.000Z" }
    ],
    reservations: [
      { id: 1, guest_name: "Anna Kowalska", guest_phone: "+48 500 100 200", guest_email: "anna@example.com", party_size: 2, table_id: 4, table_number: "Stolik #4", starts_at: "2026-11-03T20:00:00.000Z", ends_at: "2026-11-03T22:00:00.000Z", status: "confirmed", notes: "Przy oknie", cancel_code: "TK-9M2X" },
      { id: 2, guest_name: "Marek Nowak", guest_phone: "+48 600 200 300", guest_email: "marek@nowak.pl", party_size: 4, table_id: 9, table_number: "Stolik #9", starts_at: "2026-11-03T20:30:00.000Z", ends_at: "2026-11-03T22:30:00.000Z", status: "confirmed", notes: "Urodziny — prośba o świeczkę", cancel_code: "TK-7T4L" },
      { id: 3, guest_name: "Firma SoftTech", guest_phone: "+48 22 111 22 33", guest_email: "biuro@softtech.pl", party_size: 6, table_id: 7, table_number: "Stolik #7", starts_at: "2026-11-03T21:00:00.000Z", ends_at: "2026-11-03T23:00:00.000Z", status: "confirmed", notes: "Faktura VAT", cancel_code: "TK-3N8B" },
      { id: 4, guest_name: "Laura Wiśniewska", guest_phone: "+48 512 345 678", guest_email: "", party_size: 2, table_id: 2, table_number: "Stolik #2", starts_at: "2026-11-03T18:30:00.000Z", ends_at: "2026-11-03T20:30:00.000Z", status: "seated", notes: "", cancel_code: "TK-5V9C" }
    ],
    detections: [
      { id: 1, table_id: 2, table_number: "Stolik #2", camera_id: 1, seats_detected: 2, occupied: true, confidence: 0.96, detected_at: "2026-11-03T19:32:00.000Z" },
      { id: 2, table_id: 1, table_number: "Stolik #1", camera_id: 1, seats_detected: 0, occupied: false, confidence: 0.94, detected_at: "2026-11-03T19:31:55.000Z" },
      { id: 3, table_id: 6, table_number: "Stolik #6", camera_id: 2, seats_detected: 4, occupied: true, confidence: 0.95, detected_at: "2026-11-03T19:31:50.000Z" },
      { id: 4, table_id: 8, table_number: "Stół #8 (Pod Kopułą VIP)", camera_id: 2, seats_detected: 7, occupied: true, confidence: 0.98, detected_at: "2026-11-03T19:31:45.000Z" },
      { id: 5, table_id: 5, table_number: "Stolik #5", camera_id: 2, seats_detected: 0, occupied: false, confidence: 0.87, detected_at: "2026-11-03T19:31:40.000Z" }
    ]
  },
  "trattoria-roma": {
    id: "trattoria-roma",
    layoutType: "trattoria",
    rating: "4.8",
    interiorFeature: "Piec Chlebowy & Rzymskie Arkady",
    name: "Trattoria Bella Roma",
    cuisine: "🍕 Kuchnia włoska • Piec opalany drewnem",
    address: "ul. Krupnicza 14, Kraków",
    hours: "13:00 – 23:00",
    bannerImage: "assets/bg_trattoria.svg",
    tagline: "Włoska posadzka w terakotową szachownicę, rzymskie arkady i żywy ogień w piecu chlebowym do pizzy.",
    menu: {
      przystawki: [
        { name: "Carpaccio di Manzo", tag: "Klasyk Rzymu", desc: "Cienkie plastry polędwicy wołowej, rukola, kapary, Grana Padano (160g)", price: "39 zł" },
        { name: "Focaccia z rozmarynem i solą morską", tag: "Wegetariańskie", desc: "Wypiekana w piecu opalanym drewnem, oliwa truflowa (220g)", price: "22 zł" }
      ],
      glowne: [
        { name: "Pizza Margherita DOP z pieca", tag: "Bestseller", desc: "Pomidory San Marzano, mozzarella di bufala, świeża bazylia (420g)", price: "36 zł" },
        { name: "Tagliatelle al Tartufo", tag: "Specjalność Szefa", desc: "Świeży makaron jajeczny, pasta z czarnej trufli, masło, parmezan (310g)", price: "49 zł" },
        { name: "Pizza Diavola Piccante", tag: "Pikantne", desc: "Spianata Calabrese, mozzarella fior di latte, papryczki peperoncino (440g)", price: "43 zł" }
      ],
      napoje: [
        { name: "Woda San Pellegrino (750 ml)", tag: "Import Włochy", desc: "Gazowana / niegazowana z sycylijską cytryną", price: "16 zł" },
        { name: "Aperol Spritz Bezalkoholowy", tag: "Aperitivo", desc: "Syrop gorzka pomarańcza, tonik, lód, plaster pomarańczy (300 ml)", price: "24 zł" }
      ]
    },
    tables: [
      { id: 1, name: "Stolik #1", seats: 2, zone: "Arkada Włoska", liveStatus: "occupied", liveLabel: "Zajęty (YOLO: 2 os.)", bookedSlots: ["18:00"], seats_detected: 2, confidence: 0.93, pos_x: 20, pos_y: 20, is_active: true },
      { id: 2, name: "Stolik #2", seats: 2, zone: "Arkada Włoska", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: 0, confidence: 0.91, pos_x: 50, pos_y: 20, is_active: true },
      { id: 3, name: "Stolik #3", seats: 2, zone: "Arkada Włoska", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: ["19:00"], seats_detected: 0, confidence: 0.9, pos_x: 80, pos_y: 20, is_active: true },
      { id: 4, name: "Stolik #4", seats: 4, zone: "Blisko Pieca", liveStatus: "occupied", liveLabel: "Zajęty (YOLO: 3 os.)", bookedSlots: [], seats_detected: 3, confidence: 0.95, pos_x: 20, pos_y: 50, is_active: true },
      { id: 5, name: "Stolik #5", seats: 4, zone: "Szachownica Środek", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: ["18:00"], seats_detected: 0, confidence: 0.92, pos_x: 50, pos_y: 50, is_active: true },
      { id: 6, name: "Stolik #6", seats: 4, zone: "Szachownica Środek", liveStatus: "reserved", liveLabel: "Rezerwacja w systemie", bookedSlots: ["18:00", "20:00"], seats_detected: 0, confidence: 0.89, pos_x: 80, pos_y: 50, is_active: true },
      { id: 7, name: "Stolik #7", seats: 6, zone: "Pergola Winorośli", liveStatus: "dirty", liveLabel: "Do sprzątania", bookedSlots: [], seats_detected: 0, confidence: 0.88, pos_x: 25, pos_y: 78, is_active: true },
      { id: 8, name: "Stolik #8", seats: 6, zone: "Pergola Winorośli", liveStatus: "occupied", liveLabel: "Zajęty (YOLO: 5 os.)", bookedSlots: ["19:00"], seats_detected: 5, confidence: 0.96, pos_x: 55, pos_y: 78, is_active: true },
      { id: 9, name: "Stolik #9", seats: 4, zone: "Ogród Zimowy", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: 0, confidence: 0.94, pos_x: 80, pos_y: 78, is_active: true },
      { id: 10, name: "Stół #10 (La Famiglia)", seats: 8, zone: "Stół Biesiadny Włoski", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: ["20:00"], seats_detected: 0, confidence: 0.97, pos_x: 50, pos_y: 90, is_active: true }
    ],
    cameras: [
      { id: 1, name: "Kamera Piec & Sala", stream_url: "rtsp://192.168.2.10/stream1", zone_name: "Blisko Pieca", status: "online", model_enabled: true, last_heartbeat: "2026-11-03T19:30:00.000Z" },
      { id: 2, name: "Kamera Arkady", stream_url: "rtsp://192.168.2.11/stream1", zone_name: "Arkada Włoska", status: "online", model_enabled: true, last_heartbeat: "2026-11-03T19:30:00.000Z" }
    ],
    reservations: [
      { id: 1, guest_name: "Marco Rossi", guest_phone: "+48 601 234 567", guest_email: "marco@roma.it", party_size: 4, table_id: 6, table_number: "Stolik #6", starts_at: "2026-11-03T20:00:00.000Z", ends_at: "2026-11-03T22:00:00.000Z", status: "confirmed", notes: "Wino Chianti Classico", cancel_code: "TK-4M8P" }
    ],
    detections: [
      { id: 1, table_id: 1, table_number: "Stolik #1", camera_id: 2, seats_detected: 2, occupied: true, confidence: 0.93, detected_at: "2026-11-03T19:30:00.000Z" },
      { id: 2, table_id: 8, table_number: "Stolik #8", camera_id: 1, seats_detected: 5, occupied: true, confidence: 0.96, detected_at: "2026-11-03T19:29:30.000Z" }
    ]
  },
  "sushi-zen": {
    id: "sushi-zen",
    layoutType: "sushi",
    rating: "4.9",
    interiorFeature: "Strefa Tatami & Otwarty Bar Omakase",
    name: "Zen Ramen & Sushi Bar",
    cuisine: "🍣 Kuchnia japońska • Ramen & Izakaya",
    address: "ul. Kazimierza Wielkiego 40, Kraków",
    hours: "12:00 – 21:30",
    bannerImage: "assets/bg_sushi.svg",
    tagline: "Ciemne maty Tatami, czerwone lampiony Chochin, otwarty bar Sushi Master i automatyczna detekcja miejsc.",
    menu: {
      przystawki: [
        { name: "Edamame z solą morską Maldon", tag: "Wegańskie", desc: "Gotowane na parze strąki młodej soi z kryształkami soli (150g)", price: "19 zł" },
        { name: "Pierożki Gyoza (6 szt.)", tag: "Bestseller", desc: "Podsmażane pierożki wieprzowo-warzywne, sos ponzu z sezamem (180g)", price: "28 zł" }
      ],
      glowne: [
        { name: "Tonkotsu Ramen", tag: "Specjalność Lokalu", desc: "Bulion wieprzowy 12h, boczek chashu, jajko ajitsuke, grzyby mun, nori (550ml)", price: "44 zł" },
        { name: "Zestaw Omakase Nigiri & Uramaki (14 szt.)", tag: "Sushi Master", desc: "Łosoś, tuńczyk, krewetka w tempurze, awokado, kawior tobiko", price: "68 zł" },
        { name: "Tantanmen Ramen (Pikantny)", tag: "Pikantne", desc: "Pasta sezamowa, pikantna wieprzowina soboro, pak choi, olej chili (550ml)", price: "46 zł" }
      ],
      napoje: [
        { name: "Zielona herbata Sencha / Matcha", tag: "Uji Kyoto", desc: "Liściasta herbata japońska z prefektury Uji (300 ml)", price: "16 zł" },
        { name: "Lemoniada Yuzu & Shiso", tag: "Autorskie", desc: "Japoński cytrus yuzu, woda gazowana, liście shiso (350 ml)", price: "21 zł" }
      ]
    },
    tables: [
      { id: 1, name: "Boks #1", seats: 2, zone: "Przy Barze Sushi", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: 0, confidence: 0.95, pos_x: 15, pos_y: 20, is_active: true },
      { id: 2, name: "Boks #2", seats: 2, zone: "Przy Barze Sushi", liveStatus: "occupied", liveLabel: "Zajęty (YOLO: 2 os.)", bookedSlots: ["18:00"], seats_detected: 2, confidence: 0.97, pos_x: 38, pos_y: 20, is_active: true },
      { id: 3, name: "Boks #3", seats: 2, zone: "Przy Barze Sushi", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: 0, confidence: 0.92, pos_x: 62, pos_y: 20, is_active: true },
      { id: 4, name: "Boks #4", seats: 2, zone: "Przy Barze Sushi", liveStatus: "reserved", liveLabel: "Rezerwacja w systemie", bookedSlots: ["18:00"], seats_detected: 0, confidence: 0.9, pos_x: 85, pos_y: 20, is_active: true },
      { id: 5, name: "Stolik #5", seats: 4, zone: "Aleja Lampionów", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: ["19:00"], seats_detected: 0, confidence: 0.93, pos_x: 25, pos_y: 50, is_active: true },
      { id: 6, name: "Stolik #6", seats: 4, zone: "Aleja Lampionów", liveStatus: "occupied", liveLabel: "Zajęty (YOLO: 4 os.)", bookedSlots: [], seats_detected: 4, confidence: 0.96, pos_x: 55, pos_y: 50, is_active: true },
      { id: 7, name: "Stolik #7", seats: 4, zone: "Ogród Bambusowy", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: 0, confidence: 0.91, pos_x: 82, pos_y: 50, is_active: true },
      { id: 8, name: "Stolik #8", seats: 6, zone: "Mata Tatami Wschód", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: ["18:00"], seats_detected: 0, confidence: 0.94, pos_x: 28, pos_y: 80, is_active: true },
      { id: 9, name: "Stolik #9", seats: 6, zone: "Mata Tatami Zachód", liveStatus: "reserved", liveLabel: "Rezerwacja w systemie", bookedSlots: ["19:00"], seats_detected: 0, confidence: 0.89, pos_x: 60, pos_y: 80, is_active: true },
      { id: 10, name: "Stół #10 (Omakase VIP)", seats: 8, zone: "Prywatna Sala Tatami", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: 0, confidence: 0.98, pos_x: 85, pos_y: 80, is_active: true }
    ],
    cameras: [
      { id: 1, name: "Kamera Bar Sushi", stream_url: "rtsp://192.168.3.10/stream1", zone_name: "Przy Barze Sushi", status: "online", model_enabled: true, last_heartbeat: "2026-11-03T19:30:00.000Z" },
      { id: 2, name: "Kamera Sala Tatami", stream_url: "rtsp://192.168.3.11/stream1", zone_name: "Mata Tatami Wschód", status: "online", model_enabled: true, last_heartbeat: "2026-11-03T19:30:00.000Z" }
    ],
    reservations: [
      { id: 1, guest_name: "Kenji Takahashi", guest_phone: "+48 509 888 777", guest_email: "kenji@tokyo.jp", party_size: 2, table_id: 4, table_number: "Boks #4", starts_at: "2026-11-03T20:00:00.000Z", ends_at: "2026-11-03T22:00:00.000Z", status: "confirmed", notes: "Zestaw Omakase", cancel_code: "TK-8K2M" }
    ],
    detections: [
      { id: 1, table_id: 2, table_number: "Boks #2", camera_id: 1, seats_detected: 2, occupied: true, confidence: 0.97, detected_at: "2026-11-03T19:31:00.000Z" },
      { id: 2, table_id: 6, table_number: "Stolik #6", camera_id: 2, seats_detected: 4, occupied: true, confidence: 0.96, detected_at: "2026-11-03T19:30:20.000Z" }
    ]
  }
};

let currentRestaurantId = null;
let staffRestaurantId = "bistro-agh";
let currentCuisineFilter = "all";
let inspectedLiveTable = null;
let selectedTableForLive = null;
let selectedTableForBooking = null;

function formatWhen(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toLocalInput(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
