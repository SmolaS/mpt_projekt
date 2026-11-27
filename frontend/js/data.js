// ==========================================================================
// Plik: js/data.js — Słownik statusów, makieta lokali i menu (bez sztucznych
// rezerwacji, bez podpiętych kamer i bez udawanych odczytów YOLO).
// Wszystkie rezerwacje i statusy stolików pobierane są z Backendu FastAPI (RAM).
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

// Dane statyczne lokali (opisy i menu) + puste tablice rezerwacji, kamer i detekcji
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
    tagline: "Historyczna przeszklona kopuła, dębowy parkiet, ciepłe światło lamp Edison i interaktywny rzut sali.",
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
      { id: 1, name: "Stolik 1", seats: 2, zone: "Witryna Okienna", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 2, name: "Stolik 2", seats: 2, zone: "Witryna Okienna", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 3, name: "Stolik 3", seats: 4, zone: "Rotunda Pod Kopułą", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 4, name: "Stolik 4", seats: 4, zone: "Przy Winiarni", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 5, name: "Stolik 5", seats: 6, zone: "Rotunda Pod Kopułą", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 6, name: "Stolik 6", seats: 8, zone: "Centrum Kopuły", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true }
    ],
    cameras: [],
    reservations: [],
    detections: []
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
      { id: 7, name: "Stolik 1", seats: 2, zone: "Arkada Włoska", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 8, name: "Stolik 2", seats: 2, zone: "Arkada Włoska", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 9, name: "Stolik 3", seats: 4, zone: "Blisko Pieca", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 10, name: "Stolik 4", seats: 4, zone: "Szachownica Środek", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 11, name: "Stolik 5", seats: 6, zone: "Pergola Winorośli", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 12, name: "Stolik 6", seats: 8, zone: "Stół Biesiadny La Famiglia", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true }
    ],
    cameras: [],
    reservations: [],
    detections: []
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
    tagline: "Ciemne maty Tatami, czerwone lampiony Chochin i otwarty bar Sushi Master.",
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
      { id: 13, name: "Boks 1", seats: 2, zone: "Przy Barze Sushi", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 14, name: "Boks 2", seats: 2, zone: "Przy Barze Sushi", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 15, name: "Stolik 3", seats: 4, zone: "Aleja Lampionów", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 16, name: "Stolik 4", seats: 4, zone: "Ogród Bambusowy", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 17, name: "Stolik 5", seats: 6, zone: "Mata Tatami Wschód", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true },
      { id: 18, name: "Stolik 6", seats: 8, zone: "Prywatna Sala Omakase", liveStatus: "free", liveLabel: "Wolny — Kliknij", bookedSlots: [], seats_detected: null, confidence: null, is_active: true }
    ],
    cameras: [],
    reservations: [],
    detections: []
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
