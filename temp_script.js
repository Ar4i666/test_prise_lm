
>     <script>
          tailwind.config = {
              darkMode: 'class',
              theme: {
                  extend: {
                      colors: {
                          emerald: {
                              50: '#e6fbf8',
                              100: '#cdfaee',
                              200: '#9cf3dd',
                              300: '#60e6c8',
                              400: '#2dcfaf',
                              500: '#00c0a5',
                              600: '#009782',
                              700: '#00796b',
                              800: '#005f54',
                              900: '#004f46',
                              950: '#002e29',
                          }
                      }
                  }
              }
          }
      </script>
      <!-- Leaflet.js Maps -->
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" 
integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" 
integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
      <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
      <!-- Tailwind needed in print window too, loaded via window.open -->
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" 
rel="stylesheet">
      <style>
          body { font-family: 'Inter', sans-serif; }
          .glass {
              background: rgba(30, 41, 59, 0.7);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              border: 1px solid rgba(255, 255, 255, 0.1);
          }
          .scrollbar-hide::-webkit-scrollbar {
              display: none;
          }
          .scrollbar-hide {
              -ms-overflow-style: none;
              scrollbar-width: none;
          }
          [x-cloak] { display: none !important; }
          
          /* 2GIS dark tiles styling using CSS filter - grayscaled to neutralize POI clutter and make user markers 
stand out */
          .dark-tiles {
              filter: invert(100%) grayscale(100%) brightness(75%) contrast(105%);
          }
          #coords-map {
              background: #090d16 !important;
          }
          
          /* РЎС‚РёР»Рё РґР»СЏ РІРєР»Р°РґРѕРє */
          .tab-active {
              @apply border-emerald-500 text-emerald-400 bg-emerald-900/20;
          }
          .tab-inactive {
              @apply border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600;
          }
  
          /* РЎС‚РёР»Рё РґР»СЏ РіРµРЅРµСЂР°С‚РѕСЂР° PDF */
          .pdf-preview-container {
              background: #0f172a;
              padding: 2rem 1rem;
              border-radius: 1.5rem;
              border: 1px solid #334155;
              max-height: 800px;
              overflow-y: auto;
              width: 100%;
          }
          .pdf-print-wrapper {
              display: flex;
              flex-direction: column;
              gap: 2rem;
              align-items: center;
              width: 100%;
          }
          .pdf-page {
              width: 210mm;
              height: 297mm;
              min-height: 297mm;
              box-sizing: border-box;
              position: relative;
              background-color: white;
              color: #1e293b;
              font-size: 11px;
              line-height: 1.35;
              flex-shrink: 0;
          }
          
          /* Cover page styles */
          .pdf-page-cover {
              padding: 55mm 18mm 25mm 18mm;
          }
  
          /* Ordinary page styles (standard margins, no background) */
          .pdf-page-standard {
              padding: 20mm 18mm 20mm 18mm;
          }
  
          /* Prevent page split in middle of table rows */
          .pdf-page table tr {
              page-break-inside: avoid;
          }
  
          /* Shadow only for web preview, not PDF export */
          .pdf-print-wrapper .pdf-page {
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          }
          .pdf-print-wrapper.exporting-pdf .pdf-page {
              box-shadow: none !important;
          }
  
          /* Export clean-up class */
          .pdf-print-wrapper.exporting-pdf {
              display: block !important;
              gap: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
              background: transparent !important;
          }
          .pdf-print-wrapper.exporting-pdf .pdf-page {
              box-shadow: none !important;
              margin: 0 !important;
              page-break-after: always !important;
          }
  
          /* PDF generation overlay */
          #pdf-loading-overlay {
              display: none;
              position: fixed;
              inset: 0;
              z-index: 99999;
              background: rgba(0, 0, 0, 0.75);
              backdrop-filter: blur(6px);
              -webkit-backdrop-filter: blur(6px);
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 1.5rem;
          }
          #pdf-loading-overlay.active {
              display: flex;
          }
          .pdf-spinner {
              width: 56px;
              height: 56px;
              border: 5px solid rgba(0,192,165,0.2);
              border-top-color: #00c0a5;
              border-radius: 50%;
              animation: spin 0.9s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          .pdf-loading-text {
              color: #fff;
              font-size: 15px;
              font-weight: 600;
              letter-spacing: 0.02em;
          }
          .pdf-loading-sub {
              color: rgba(255,255,255,0.55);
              font-size: 12px;
              margin-top: -0.75rem;
          }
  
          /* Hidden render stage outside any scroll container */
          #pdf-render-stage {
              position: fixed;
              top: 0;
              left: -9999px;
              z-index: -1;
              pointer-events: none;
              width: 794px;  /* 210mm @ 96dpi */
              height: 1123px; /* 297mm @ 96dpi */
              overflow: hidden;
              background: white;
          }
      </style>
  </head>
  <body class="bg-gray-900 text-gray-100 min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] 
from-gray-800 via-gray-900 to-black">
  
  
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" x-data="mappingApp()">
          <!-- Header -->
          <header class="mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                  <h1 class="text-4xl font-extrabold tracking-tight text-white sm:text-5xl bg-clip-text 
text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 mb-2">
                      РЎРІСЏР·Рё РђРґСЂРµСЃРЅРѕР№ РџСЂРѕРіСЂР°РјРјС‹
                  </h1>
                  <p class="text-lg text-gray-400">РЎРѕРїРѕСЃС‚Р°РІСЊС‚Рµ РѕР±СЉРµРєС‚С‹ РёР· Google Sheets СЃ 
Р»РѕРєР°Р»СЊРЅРѕР№ Р±Р°Р·РѕР№ РґР°РЅРЅС‹С… LiftMedia.</p>
                  <div class="mt-4 flex gap-3">
                      <a href="/map.html" target="_blank" class="inline-flex items-center gap-2 bg-gradient-to-r 
from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 active:scale-[0.98] text-white font-semibold 
text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/10 border border-emerald-400/20 transition-all">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 
20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 
18.382V7.618a1 1 0 00-.553-.894L16 4m0 13V4m0 0L9 7"></path>
                          </svg>
                          РћС‚РєСЂС‹С‚СЊ РёРЅС‚РµСЂР°РєС‚РёРІРЅСѓСЋ РєР°СЂС‚Сѓ
                      </a>
                  </div>
              </div>
              <div class="flex space-x-4 shrink-0">
                  <div class="bg-gray-800/80 rounded-2xl p-4 border border-gray-700/50 shadow-lg text-center 
min-w-[120px] backdrop-blur-sm">
                      <p class="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Р’СЃРµРіРѕ</p>
                      <p class="text-3xl font-bold text-white" x-text="stats.total"></p>
                  </div>
                  <div class="bg-gray-800/80 rounded-2xl p-4 border border-gray-700/50 shadow-lg text-center 
min-w-[120px] backdrop-blur-sm">
                      <p class="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">РќРµ 
СЃРІСЏР·Р°РЅРѕ</p>
                      <p class="text-3xl font-bold text-rose-400" x-text="stats.unmapped"></p>
                  </div>
              </div>
          </header>
  
          <!-- Navigation & Filters -->
          <div class="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
              <div class="border-b border-gray-700 w-full md:w-auto">
                  <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                      <button @click="currentTab = 'mapping'" 
                              :class="currentTab === 'mapping' ? 'tab-active' : 'tab-inactive'"
                              class="whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors">
                          РњР°РїРїРёРЅРі Р”РѕРјРѕРІ
                      </button>
                      <button @click="currentTab = 'sectors'; fetchSectors();" 
                              :class="currentTab === 'sectors' ? 'tab-active' : 'tab-inactive'"
                              class="whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors flex 
items-center">
                          РњР°РїРїРёРЅРі РЎРµРєС‚РѕСЂРѕРІ
                      </button>
                      <button @click="currentTab = 'pricelist'; fetchPriceList();" 
                              :class="currentTab === 'pricelist' ? 'tab-active' : 'tab-inactive'"
                              class="whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors flex 
items-center">
                          РС‚РѕРіРѕРІС‹Р№ РџСЂР°Р№СЃ-Р»РёСЃС‚
                          <span x-show="(currentTab === 'mapping' || currentTab === 'sectors') && stats.unmapped === 
0" class="ml-2 bg-emerald-500 rounded-full w-2 h-2"></span>
                      </button>
                      <button @click="currentTab = 'dbhouses'; fetchDbOnlyHouses();" 
                              :class="currentTab === 'dbhouses' ? 'tab-active' : 'tab-inactive'"
                              class="whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors flex 
items-center">
                          Р”РѕРјР° РёР· Р‘Р”
                          <span x-show="dbOnlyHouses.length > 0" class="ml-2 bg-amber-500 text-black text-xs font-bold 
rounded-full px-1.5" x-text="dbOnlyHouses.filter(h => !h.is_test).length"></span>
                      </button>
                      <button @click="currentTab = 'generator'; initGenerator();" 
                              :class="currentTab === 'generator' ? 'tab-active' : 'tab-inactive'"
                              class="whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors flex 
items-center">
                          Р“РµРЅРµСЂР°С‚РѕСЂ РЎРјРµС‚
                          <span class="ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-950/60 
text-emerald-400 border border-emerald-500/30">PDF</span>
                      </button>
                  </nav>
              </div>
              
              <div class="flex items-center space-x-3 w-full md:w-auto">
                  <label for="city-filter" class="text-sm text-gray-400">Р“РѕСЂРѕРґ (Р›РёСЃС‚):</label>
                  <select id="city-filter" x-model="selectedCity" class="bg-gray-800 border border-gray-700 text-white 
text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5">
                      <option value="all">Р’СЃРµ РіРѕСЂРѕРґР°</option>
                      <template x-for="city in availableCities" :key="city">
                          <option :value="city" x-text="city"></option>
                      </template>
                  </select>
              </div>
          </div>
  
          <!-- Main Content -->
          <main>
              <!-- Loading State -->
              <div x-show="loading" class="flex justify-center items-center py-32">
                  <div class="relative">
                      <div class="absolute inset-0 bg-emerald-400 blur-xl opacity-20 rounded-full"></div>
                      <svg class="animate-spin relative h-12 w-12 text-emerald-400" xmlns="http://www.w3.org/2000/svg" 
fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" 
stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 
12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                  </div>
              </div>
  
              <!-- Mapping List -->
              <div x-show="!loading && currentTab === 'mapping'" class="space-y-4" x-cloak>
                  <template x-for="(item, index) in filteredItems" :key="item.sheet_house_name">
                      <div class="glass relative rounded-2xl p-5 md:p-6 transition-all duration-300 hover:shadow-2xl 
hover:bg-gray-800/40 flex flex-col md:flex-row gap-6 items-center border"
                           :style="{ zIndex: items.length - index }"
                           :class="{ 'border-emerald-500/30': item.is_mapped && !item.is_ignored, 
'border-rose-500/30': !item.is_mapped && !item.is_ignored, 'border-gray-500/30 opacity-70': item.is_ignored }">
                          
                          <!-- Left Side: Sheet Data -->
                          <div class="w-full md:w-1/2 flex items-start space-x-5">
                              <div class="flex-shrink-0 mt-1.5">
                                  <div class="w-3.5 h-3.5 rounded-full shadow-[0_0_12px_rgba(0,0,0,0.5)] 
transition-colors duration-300"
                                       :class="{ 'bg-emerald-400 shadow-emerald-400/50': item.is_mapped && 
!item.is_ignored, 'bg-rose-400 shadow-rose-400/50': !item.is_mapped && !item.is_ignored, 'bg-gray-500 
shadow-gray-500/50': item.is_ignored }">
                                  </div>
                              </div>
                              <div class="flex-1 min-w-0">
                                  <h3 class="text-xl font-bold text-white mb-1.5 truncate" 
x-text="item.sheet_house_name" :title="item.sheet_house_name"></h3>
                                  <p class="text-sm text-gray-400 mb-3 truncate" x-text="item.sheet_address" 
:title="item.sheet_address"></p>
                                  <div class="flex flex-wrap gap-2 items-center">
                                      <span class="inline-flex items-center px-3 py-1 rounded-full text-xs 
font-semibold bg-blue-900/30 text-blue-300 border border-blue-800/50">
                                          <svg class="-ml-1 mr-1.5 h-3.5 w-3.5 text-blue-400" fill="currentColor" 
viewBox="0 0 20 20">
                                              <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 
00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"></path>
                                          </svg>
                                          <span x-text="item.sheet_monitors + ' РјРѕРЅРёС‚РѕСЂРѕРІ'"></span>
                                      </span>
                                      <template x-if="item.latitude && item.longitude">
                                          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs 
font-semibold bg-emerald-900/30 text-emerald-300 border border-emerald-800/50">
                                              <svg class="-ml-1 mr-1.5 h-3.5 w-3.5 text-emerald-400" fill="none" 
viewBox="0 0 24 24" stroke="currentColor">
                                                  <path stroke-linecap="round" stroke-linejoin="round" 
stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                  <path stroke-linecap="round" stroke-linejoin="round" 
stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                              </svg>
                                              <span x-text="Number(item.latitude).toFixed(4) + ', ' + 
Number(item.longitude).toFixed(4)"></span>
                                          </span>
                                      </template>
                                  </div>
                              </div>
                          </div>
  
                          <!-- Right Side: Mapping Actions -->
                          <div class="w-full md:w-1/2 flex flex-col justify-center">
                              <!-- Already Mapped -->
                              <div x-show="item.is_mapped && !item.is_ignored" class="bg-emerald-900/10 border 
border-emerald-800/40 rounded-xl p-4 flex justify-between items-center group transition-colors 
hover:bg-emerald-900/20">
                                  <div class="flex items-center space-x-3">
                                      <div class="p-2 bg-emerald-500/10 rounded-lg">
                                          <svg class="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" 
stroke="currentColor">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
d="M5 13l4 4L19 7" />
                                          </svg>
                                      </div>
                                      <div>
                                          <p class="text-sm font-medium text-emerald-300">РЎРІСЏР·Р°РЅ СЃ Р‘Р”</p>
                                          <div class="flex flex-wrap gap-1 mt-1">
                                              <template x-for="id in item.db_house_ids" :key="id">
                                                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs 
font-medium bg-emerald-900/40 text-emerald-400 border border-emerald-700/50">
                                                      ID: <span x-text="id"></span>
                                                      <button @click="removeSingleId(item, id)" class="ml-1.5 
text-emerald-600 hover:text-rose-400 transition-colors">
                                                          <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 
20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 
4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
clip-rule="evenodd"></path></svg>
                                                      </button>
                                                  </span>
                                              </template>
                                          </div>
                                      </div>
                                  </div>
                                  <div class="flex space-x-2">
                                      <button @click="editCoordinates(item)" class="p-2 text-gray-500 
hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all" title="РРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ 
РєРѕРѕСЂРґРёРЅР°С‚С‹">
                                          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                          </svg>
                                      </button>
                                      <button @click="showAddMore(item)" class="p-2 text-gray-500 
hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all" title="Р”РѕР±Р°РІРёС‚СЊ РµС‰Рµ РѕРґРёРЅ 
РґРѕРј">
                                          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
d="M12 4v16m8-8H4" />
                                          </svg>
                                      </button>
                                      <button @click="deleteMapping(item)" class="p-2 text-gray-500 
hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all focus:outline-none" title="РЈРґР°Р»РёС‚СЊ РІСЃРµ 
СЃРІСЏР·Рё">
                                          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 
1v3M4 7h16" />
                                          </svg>
                                      </button>
                                  </div>
                              </div>
  
                              <!-- Ignored -->
                              <div x-show="item.is_ignored" class="bg-gray-800/30 border border-gray-700/50 rounded-xl 
p-4 flex justify-between items-center group hover:bg-gray-800/50 transition-colors">
                                  <div class="flex items-center space-x-3">
                                      <div class="p-2 bg-gray-700/50 rounded-lg">
                                          <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" 
stroke="currentColor">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 
4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 
0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                          </svg>
                                      </div>
                                      <div>
                                          <p class="text-sm font-medium text-gray-400">РРіРЅРѕСЂРёСЂСѓРµС‚СЃСЏ</p>
                                          <p class="text-xs text-gray-500 mt-0.5">РќРµ РїРѕРїР°РґРµС‚ РІ 
РїСЂР°Р№СЃ-Р»РёСЃС‚</p>
                                      </div>
                                  </div>
                                  <button @click="deleteMapping(item)" class="p-2 text-gray-500 hover:text-white 
hover:bg-gray-700 rounded-lg transition-all focus:outline-none" title="Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ">
                                      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 
4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                  </button>
                              </div>
  
                              <!-- Needs Mapping (or adding more) -->
                              <div x-show="(!item.is_mapped && !item.is_ignored) || item._showSearch" class="relative" 
x-data="{ searchQuery: '', searchResults: [], searching: false, showResults: false }">
                                  <div class="flex gap-3">
                                      <div class="relative flex-1">
                                          <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center 
pointer-events-none">
                                              <svg class="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" 
stroke="currentColor">
                                                  <path stroke-linecap="round" stroke-linejoin="round" 
stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                              </svg>
                                          </div>
                                          <input type="text" 
                                                 x-model="searchQuery" 
                                                 @input.debounce.300ms="
                                                     if (searchQuery.length >= 2) {
                                                         searching = true; showResults = true;
                                                         fetch('/api/search-houses?q=' + 
encodeURIComponent(searchQuery))
                                                          .then(r => r.json())
                                                          .then(d => { 
                                                              $data.allMappedIds = items.flatMap(i => i.db_house_ids 
|| []);
                                                              searchResults = d.success && d.data ? d.data : [];
                                                              searching = false; 
                                                          })
                                                          .catch(err => {
                                                              console.error(err);
                                                              searchResults = [];
                                                              searching = false;
                                                          });
                                                     } else {
                                                         searchResults = []; showResults = false;
                                                     }
                                                 "
                                                 @click="if(searchQuery.length >= 2) showResults = true"
                                                 class="block w-full pl-10 pr-4 py-3 border border-gray-700 rounded-xl 
leading-5 bg-gray-900 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 
focus:border-emerald-500 sm:text-sm transition-all duration-200 ease-in-out shadow-inner" 
                                                 placeholder="Р”РѕР±Р°РІРёС‚СЊ РґРѕРј РёР· Р±Р°Р·С‹...">
                                          
                                          <!-- Search Results Dropdown -->
                                          <div x-show="showResults && searchQuery.length >= 2" 
@click.away="showResults = false" 
                                               x-transition:enter="transition ease-out duration-200"
                                               x-transition:enter-start="opacity-0 translate-y-1"
                                               x-transition:enter-end="opacity-100 translate-y-0"
                                               x-transition:leave="transition ease-in duration-150"
                                               x-transition:leave-start="opacity-100 translate-y-0"
                                               x-transition:leave-end="opacity-0 translate-y-1"
                                               class="absolute left-0 right-0 top-full z-[100] mt-2 bg-gray-800 
shadow-[0_20px_50px_rgba(0,0,0,0.9)] rounded-xl border border-emerald-500/30 max-h-72 flex flex-col overflow-hidden 
py-1 backdrop-blur-xl">
                                              
                                              <div class="overflow-auto scrollbar-hide flex-1">
                                                  <div x-show="searching" class="p-4 text-sm text-gray-400 flex 
items-center justify-center space-x-2">
                                                      <svg class="animate-spin h-4 w-4 text-emerald-400" 
xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" 
stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 
018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                      <span>РС‰РµРј СЃРѕРІРїР°РґРµРЅРёСЏ...</span>
                                                  </div>
                                                  
                                                  <div x-show="!searching && searchResults.length === 0" class="p-4 
text-sm text-gray-400 text-center">
                                                      РќРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ РІ Р‘Р”
                                                  </div>
                                                  
                                                  <ul x-show="!searching && searchResults.length > 0" class="divide-y 
divide-gray-700/50">
                                                      <template x-for="res in searchResults" :key="res.id">
                                                          <li @mousedown.stop="
                                                                  $event.preventDefault();
                                                                  if ($event.ctrlKey || $event.metaKey) {
                                                                      item._showSearch = true;
                                                                      $data.saveMapping(item, res.id, false);
                                                                  } else {
                                                                      $data.startMappingWithCoords(item, res.id, 
false);
                                                                  }
                                                                  if (!$event.ctrlKey && !$event.metaKey) {
                                                                      showResults = false; 
                                                                      searchQuery = ''; 
                                                                      item._showSearch = false;
                                                                  }
                                                              " 
                                                              @click.stop
                                                              class="px-4 py-3 hover:bg-emerald-600 hover:text-white 
cursor-pointer text-sm transition-colors flex justify-between items-center group"
                                                              :class="$data.allMappedIds && 
$data.allMappedIds.includes(res.id) ? 'text-gray-500 bg-gray-800/50' : 'text-gray-200'">
                                                              <div class="flex items-center space-x-2">
                                                                  <span class="font-medium" x-text="res.title"></span>
                                                                  <span x-show="$data.allMappedIds && 
$data.allMappedIds.includes(res.id)" class="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-gray-700 
text-gray-400">РЈР¶Рµ РїСЂРёРІСЏР·Р°РЅ</span>
                                                              </div>
                                                              <span class="text-xs group-hover:text-emerald-200" 
:class="$data.allMappedIds && $data.allMappedIds.includes(res.id) ? 'text-gray-600' : 'text-gray-500'" x-text="'ID: ' 
+ res.id"></span>
                                                          </li>
                                                      </template>
                                                  </ul>
                                              </div>
                                              <!-- Hint footer -->
                                              <div x-show="!searching && searchResults.length > 0" class="px-4 py-2 
bg-gray-900/50 border-t border-gray-700/50 text-[10px] text-gray-400 uppercase tracking-wide flex justify-between 
items-center">
                                                  <span>РЈРґРµСЂР¶РёРІР°Р№С‚Рµ <kbd class="bg-gray-700 px-1.5 py-0.5 
rounded text-gray-200 font-sans border border-gray-600">Ctrl</kbd> РґР»СЏ РІС‹Р±РѕСЂР° РЅРµСЃРєРѕР»СЊРєРёС…</span>
                                              </div>
                                          </div>
                                      </div>
                                      
                                      <button x-show="!item.is_mapped" @click="saveMapping(item, null, true)" 
                                              class="px-4 py-2 border border-gray-700 rounded-xl text-sm font-medium 
text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-white hover:border-gray-500 focus:outline-none focus:ring-2 
focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-600 transition-all shadow-sm flex items-center 
justify-center shrink-0">
                                          РџСЂРѕРїСѓСЃС‚РёС‚СЊ
                                      </button>
                                      <button x-show="item._showSearch" @click="item._showSearch = false" 
                                              class="px-4 py-2 border border-gray-700 rounded-xl text-sm font-medium 
text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-white transition-all shadow-sm flex items-center justify-center 
shrink-0">
                                          РћС‚РјРµРЅР°
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </template>
              </div>
  
              <!-- Sector Mapping List -->
              <div x-show="!loading && currentTab === 'sectors'" class="space-y-4" x-cloak>
                  <div class="mb-4 text-sm text-gray-400">
                      Р—РґРµСЃСЊ РІС‹ РјРѕР¶РµС‚Рµ РїСЂРёРІСЏР·Р°С‚СЊ СѓРЅРёРєР°Р»СЊРЅС‹Рµ СЃРµРєС‚РѕСЂР° РёР· 
С‚Р°Р±Р»РёС†С‹ Рє СЂР°Р№РѕРЅР°Рј РІ Р±Р°Р·Рµ РґР°РЅРЅС‹С…. РС‚Рѕ РѕРїСЂРµРґРµР»РёС‚, РїРѕ РєР°РєРёРј СЂР°Р№РѕРЅР°Рј 
Р±СѓРґСѓС‚ РіСЂСѓРїРїРёСЂРѕРІР°С‚СЊСЃСЏ РґРѕРјР° РІ РёС‚РѕРіРѕРІРѕРј РїСЂР°Р№СЃРµ.
                  </div>
                  <template x-for="(sector, index) in filteredSectors" :key="sector.sheet_name + '|' + 
sector.sheet_sector_name">
                      <div class="glass relative rounded-2xl p-5 md:p-6 transition-all duration-300 hover:shadow-2xl 
hover:bg-gray-800/40 flex flex-col md:flex-row gap-6 items-center border"
                           :style="{ zIndex: filteredSectors.length - index }"
                           :class="{ 'border-emerald-500/30': sector.is_mapped, 'border-rose-500/30': 
!sector.is_mapped }">
                          
                          <!-- Left Side: Sheet Sector -->
                          <div class="flex-1 min-w-0 w-full">
                              <div class="flex items-center justify-between mb-2">
                                  <h2 class="text-xl font-bold text-white truncate" x-text="sector.sheet_sector_name + 
' (' + sector.sheet_name + ')'"></h2>
                              </div>
                              <div class="mt-4 flex items-center space-x-3">
                                  <label class="text-sm text-gray-400 font-medium">Р¦РµРЅР° (С‚Рі):</label>
                                  <input type="number" 
                                         x-model="sector.price" 
                                         @change="$data.saveSectorPrice(sector)" 
                                         class="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm 
text-white w-32 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all 
shadow-inner" 
                                         placeholder="РќР°РїСЂРёРјРµСЂ: 50000">
                              </div>
                          </div>
  
                          <!-- Right Side: DB District Mapping -->
                          <div class="flex-1 w-full flex flex-col justify-center space-y-3">
                              
                              <!-- Mapped state -->
                              <div x-show="sector.db_district_ids && sector.db_district_ids.length > 0" 
class="bg-emerald-900/10 border border-emerald-800/40 rounded-xl p-4 transition-colors hover:bg-emerald-900/20">
                                  <p class="text-sm font-medium text-emerald-300 mb-2">РџСЂРёРІСЏР·Р°РЅРЅС‹Рµ 
СЂР°Р№РѕРЅС‹:</p>
                                  <div class="flex flex-wrap gap-2">
                                      <template x-for="(db_id, idx) in sector.db_district_ids" :key="db_id">
                                          <span class="inline-flex items-center px-2 py-1 rounded-md text-xs 
font-medium bg-emerald-800/50 text-emerald-200 border border-emerald-700/50 group">
                                              <span x-text="sector.db_district_titles[idx]"></span>
                                              <button @click.stop="removeDistrictFromSector(sector, idx)" 
class="ml-1.5 flex-shrink-0 inline-flex items-center justify-center text-emerald-400 hover:bg-emerald-800 
hover:text-white rounded-full p-0.5 focus:outline-none transition-colors">
                                                  <svg class="h-3.5 w-3.5" stroke="currentColor" fill="none" 
viewBox="0 0 8 8"><path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" /></svg>
                                              </button>
                                          </span>
                                      </template>
                                  </div>
                              </div>
  
                              <!-- Needs Mapping / Add More -->
                              <div class="relative" x-data="{ searchQuery: '', searchResults: [], searching: false, 
showResults: false }">
                                  <div class="flex gap-3">
                                      <div class="relative flex-1">
                                          <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center 
pointer-events-none">
                                              <svg class="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" 
stroke="currentColor">
                                                  <path stroke-linecap="round" stroke-linejoin="round" 
stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                              </svg>
                                          </div>
                                          <input type="text" 
                                                 x-model="searchQuery" 
                                                 @input.debounce.300ms="
                                                     if (searchQuery.length >= 2) {
                                                         searching = true; showResults = true;
                                                         fetch('/api/search-districts?q=' + 
encodeURIComponent(searchQuery))
                                                          .then(r => r.json())
                                                          .then(d => { 
                                                              $data.allMappedDistrictIds = sectors.flatMap(s => 
s.db_district_ids || []);
                                                              searchResults = d.success && d.data ? d.data.filter(res 
=> !$data.allMappedDistrictIds.includes(res.id)) : [];
                                                              searching = false; 
                                                          })
                                                          .catch(err => {
                                                              console.error(err);
                                                              searchResults = [];
                                                              searching = false;
                                                          });
                                                     } else {
                                                         searchResults = []; showResults = false;
                                                     }
                                                 "
                                                 @click="if(searchQuery.length >= 2) showResults = true"
                                                 class="block w-full pl-10 pr-4 py-3 border border-gray-700 rounded-xl 
leading-5 bg-gray-900 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 
focus:border-emerald-500 sm:text-sm transition-all duration-200 ease-in-out shadow-inner" 
                                                 placeholder="РќР°Р№С‚Рё СЂР°Р№РѕРЅ РІ Р±Р°Р·Рµ...">
                                          
                                          <!-- Search Results Dropdown -->
                                          <div x-show="showResults && searchQuery.length >= 2" 
@click.away="showResults = false" 
                                               class="absolute left-0 right-0 top-full z-[100] mt-2 bg-gray-800 
shadow-[0_20px_50px_rgba(0,0,0,0.9)] rounded-xl border border-emerald-500/30 max-h-72 flex flex-col overflow-hidden 
py-1 backdrop-blur-xl">
                                              
                                              <div class="overflow-auto scrollbar-hide flex-1">
                                                  <div x-show="searching" class="p-4 text-sm text-gray-400 flex 
items-center justify-center space-x-2">
                                                      <svg class="animate-spin h-4 w-4 text-emerald-400" 
xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" 
stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 
018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                      <span>РС‰РµРј СЃРѕРІРїР°РґРµРЅРёСЏ...</span>
                                                  </div>
                                                  
                                                  <div x-show="!searching && searchResults.length === 0" class="p-4 
text-sm text-gray-400 text-center">
                                                      РќРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ РІ Р‘Р”
                                                  </div>
                                                  
                                                  <ul x-show="!searching && searchResults.length > 0" class="divide-y 
divide-gray-700/50">
                                                      <template x-for="res in searchResults" :key="res.id">
                                                          <li @mousedown="
                                                                  $event.preventDefault();
                                                                  $data.saveSectorMapping(sector, res.id, res.title); 
                                                                  showResults = false; 
                                                                  searchQuery = ''; 
                                                              " 
                                                              class="px-4 py-3 hover:bg-emerald-600 hover:text-white 
cursor-pointer text-sm transition-colors flex justify-between items-center group text-gray-200">
                                                              <div class="flex items-center space-x-2">
                                                                  <span class="font-medium" x-text="res.title"></span>
                                                              </div>
                                                              <span class="text-xs group-hover:text-emerald-200 
text-gray-500" x-text="'ID: ' + res.id"></span>
                                                          </li>
                                                      </template>
                                                  </ul>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </template>
              </div>
  
              <!-- Final Price List -->
              <div x-show="!loading && currentTab === 'pricelist'" x-cloak class="space-y-8">
                  <template x-for="(districtGroup, districtName) in groupedPriceList" :key="districtName">
                      <div class="glass rounded-2xl overflow-hidden border border-gray-700/50">
                          <div class="bg-gray-800/80 px-6 py-4 border-b border-gray-700">
                              <h3 class="text-xl font-bold text-emerald-400" x-text="districtName"></h3>
                          </div>
                          <div class="overflow-x-auto">
                              <table class="min-w-full divide-y divide-gray-700">
                                  <thead class="bg-gray-900/50">
                                      <tr>
                                          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 
uppercase tracking-wider" x-text="districtGroup[0].is_bc ? 'Р‘РёР·РЅРµСЃ Р¦РµРЅС‚СЂ' : 'РќР°Р·РІР°РЅРёРµ Р–Рљ'"></th>
                                          <th x-show="!districtGroup[0].is_bc" scope="col" class="px-6 py-3 
text-center text-xs font-medium text-gray-400 uppercase tracking-wider">РџРѕРґСЉРµР·РґРѕРІ</th>
                                          <th scope="col" class="px-6 py-3 text-center text-xs font-medium 
text-gray-400 uppercase tracking-wider">РС‚Р°Р¶РµР№</th>
                                          <th scope="col" class="px-6 py-3 text-center text-xs font-medium 
text-gray-400 uppercase tracking-wider" x-text="districtGroup[0].is_bc ? 'РћСЂРіР°РЅРёР·Р°С†РёРё' : 
'РљРІР°СЂС‚РёСЂС‹'"></th>
                                          <th scope="col" class="px-6 py-3 text-center text-xs font-medium 
text-gray-400 uppercase tracking-wider">РњРѕРЅРёС‚РѕСЂС‹</th>
                                          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 
uppercase tracking-wider">РђРґСЂРµСЃ</th>
                                      </tr>
                                  </thead>
                                  <tbody class="divide-y divide-gray-800 bg-gray-800/20">
                                      <template x-for="house in districtGroup" :key="house.sheet_house_name">
                                          <tr class="hover:bg-gray-700/30 transition-colors">
                                              <td class="px-6 py-4 whitespace-nowrap text-sm text-white" 
x-text="house.sheet_house_name"></td>
                                              <td x-show="!districtGroup[0].is_bc" class="px-6 py-4 whitespace-nowrap 
text-sm text-center text-gray-300" x-text="house.entrances"></td>
                                              <td class="px-6 py-4 whitespace-nowrap text-sm text-center 
text-gray-300" x-text="house.floors"></td>
                                              <td class="px-6 py-4 whitespace-nowrap text-sm text-center 
text-gray-300" x-text="house.apartments"></td>
                                              <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                                                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full 
font-medium border"
                                                        :class="house.actual_monitors === house.original_monitors ? 
'bg-emerald-900/50 text-emerald-400 border-emerald-800' : 'bg-rose-900/50 text-rose-400 border-rose-800 font-bold'">
                                                      <span x-text="house.actual_monitors"></span>
                                                  </span>
                                                  <div x-show="house.actual_monitors !== house.original_monitors" 
class="text-[10px] text-rose-400 mt-1 font-semibold">
                                                      Р’ РїСЂР°Р№СЃРµ: <span x-text="house.original_monitors"></span>
                                                  </div>
                                              </td>
                                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                                  <div class="flex items-center space-x-1.5">
                                                      <span x-text="house.sheet_address"></span>
                                                      <template x-if="house.latitude && house.longitude">
                                                          <a :href="'https://yandex.ru/maps/?text=' + house.latitude + 
',' + house.longitude" 
                                                             target="_blank" 
                                                             class="text-emerald-400 hover:text-emerald-300 
transition-colors" 
                                                             title="РћС‚РєСЂС‹С‚СЊ РЅР° РЇРЅРґРµРєСЃ.РљР°СЂС‚Р°С…">
                                                              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" 
stroke="currentColor">
                                                                  <path stroke-linecap="round" stroke-linejoin="round" 
stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                  <path stroke-linecap="round" stroke-linejoin="round" 
stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                              </svg>
                                                          </a>
                                                      </template>
                                                  </div>
                                              </td>
                                          </tr>
                                      </template>
                                  </tbody>
                                  <tfoot class="bg-gray-900/80 border-t border-gray-700">
                                      <tr>
                                          <th scope="row" class="px-6 py-4 text-left text-sm font-bold text-white 
uppercase tracking-wider">РС‚РѕРіРѕ:</th>
                                          <th x-show="!districtGroup[0].is_bc" class="px-6 py-4 text-center text-sm 
font-bold text-white" x-text="districtGroup.reduce((sum, h) => sum + (h.entrances || 0), 0)"></th>
                                          <th class="px-6 py-4 text-center text-sm font-bold text-gray-500">-</th>
                                          <th class="px-6 py-4 text-center text-sm font-bold text-white" 
x-text="districtGroup.reduce((sum, h) => sum + (h.apartments || 0), 0)"></th>
                                          <th class="px-6 py-4 text-center text-sm font-bold text-emerald-400" 
x-text="districtGroup.reduce((sum, h) => sum + (h.actual_monitors || 0), 0)"></th>
                                          <th class="px-6 py-4 text-right text-sm font-bold text-emerald-400" 
x-text="'РЎСѓРјРјР°: ' + (districtGroup[0].price || 0).toLocaleString() + ' в‚ё'"></th>
                                      </tr>
                                  </tfoot>
                              </table>
                          </div>
                      </div>
                  </template>
                  <div x-show="Object.keys(groupedPriceList).length === 0" class="text-center py-12 text-gray-500">
                      РќРµС‚ РґР°РЅРЅС‹С… РґР»СЏ РёС‚РѕРіРѕРІРѕРіРѕ РїСЂР°Р№СЃР°. РЎРЅР°С‡Р°Р»Р° РїСЂРёРІСЏР¶РёС‚Рµ 
РґРѕРјР°.
                  </div>
  
                  <!-- Grand Total -->
                  <div x-show="Object.keys(groupedPriceList).length > 0" class="glass rounded-2xl overflow-hidden 
border border-emerald-500/50 bg-gray-900/90 shadow-2xl mt-8">
                      <div class="px-6 py-6 border-b border-emerald-500/30 bg-emerald-900/20">
                          <h3 class="text-2xl font-black text-emerald-400 uppercase tracking-widest 
text-center">РћР±С‰РёР№ РС‚РѕРі <span x-show="selectedCity !== 'all'" x-text="'РїРѕ Рі. ' + selectedCity"></span></h3>
                      </div>
                      <div class="px-6 py-8">
                          <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                              <div class="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center flex flex-col 
justify-center">
                                  <div class="text-sm text-gray-400 uppercase tracking-wide font-medium 
mb-2">Р’СЃРµРіРѕ РїРѕРґСЉРµР·РґРѕРІ</div>
                                  <div class="text-3xl font-bold text-white" 
x-text="Object.values(groupedPriceList).flat().reduce((sum, h) => sum + (h.entrances || 0), 0)"></div>
                              </div>
                              <div class="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center flex flex-col 
justify-center">
                                  <div class="text-sm text-gray-400 uppercase tracking-wide font-medium 
mb-2">Р’СЃРµРіРѕ РєРІР°СЂС‚РёСЂ/РѕСЂРі.</div>
                                  <div class="text-3xl font-bold text-white" 
x-text="Object.values(groupedPriceList).flat().reduce((sum, h) => sum + (h.apartments || 0), 0)"></div>
                              </div>
                              <div class="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center flex flex-col 
justify-center">
                                  <div class="text-sm text-gray-400 uppercase tracking-wide font-medium 
mb-2">Р’СЃРµРіРѕ РјРѕРЅРёС‚РѕСЂРѕРІ</div>
                                  <div class="text-3xl font-bold text-emerald-400" 
x-text="Object.values(groupedPriceList).flat().reduce((sum, h) => sum + (h.actual_monitors || 0), 0)"></div>
                              </div>
                              <div class="bg-gray-800 rounded-xl p-5 border border-emerald-500/50 bg-emerald-900/20 
text-center flex flex-col justify-center shadow-inner">
                                  <div class="text-sm text-emerald-300 uppercase tracking-wide font-medium 
mb-2">РћР±С‰Р°СЏ РЎС‚РѕРёРјРѕСЃС‚СЊ</div>
                                  <div class="text-3xl md:text-4xl font-black text-emerald-400" 
x-text="Object.values(groupedPriceList).reduce((sum, group) => sum + (group[0].price || 0), 0).toLocaleString() + ' 
в‚ё'"></div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
              <!-- DB Only Houses Tab -->
              <div x-show="!loading && currentTab === 'dbhouses'" x-cloak class="space-y-4">
                  <div class="mb-4 flex items-center justify-between">
                      <p class="text-sm text-gray-400">Р”РѕРјР° РёР· Р±Р°Р·С‹ РґР°РЅРЅС‹С… LiftMedia, РєРѕС‚РѕСЂС‹Рµ 
<strong class="text-white">РЅРµ РїСЂРёРІСЏР·Р°РЅС‹</strong> РЅРё Рє РѕРґРЅРѕРјСѓ РґРѕРјСѓ РёР· РїСЂР°Р№СЃ-Р»РёСЃС‚Р°. 
РўРµСЃС‚РѕРІС‹Рµ РґРѕРјР° Р±СѓРґСѓС‚ РёСЃРєР»СЋС‡РµРЅС‹ РёР· РёС‚РѕРіРѕРІРѕРіРѕ СЂР°СЃС‡С‘С‚Р°.</p>
                      <div class="flex items-center space-x-2">
                          <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium 
bg-amber-900/40 text-amber-300 border border-amber-700/50">РўРµСЃС‚</span>
                          <span class="text-xs text-gray-500">= РёСЃРєР»СЋС‡С‘РЅ РёР· РїСЂР°Р№СЃР°</span>
                      </div>
                  </div>
  
                  <!-- Search & Filter -->
                  <div class="glass rounded-2xl p-4 border border-gray-700/50 flex gap-3">
                      <input type="text" x-model="dbHouseSearch" placeholder="РџРѕРёСЃРє РїРѕ РЅР°Р·РІР°РЅРёСЋ РёР»Рё 
Р°РґСЂРµСЃСѓ..." 
                             class="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm 
text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500">
                      <label class="flex items-center space-x-2 text-sm text-gray-400 cursor-pointer select-none">
                          <input type="checkbox" x-model="showTestOnly" class="rounded border-gray-600 text-amber-500 
focus:ring-amber-500 bg-gray-800">
                          <span>РўРѕР»СЊРєРѕ С‚РµСЃС‚РѕРІС‹Рµ</span>
                      </label>
                  </div>
  
                  <!-- Table -->
                  <div class="glass rounded-2xl overflow-hidden border border-gray-700/50">
                      <table class="min-w-full divide-y divide-gray-700">
                          <thead class="bg-gray-900/50">
                              <tr>
                                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase 
tracking-wider">РќР°Р·РІР°РЅРёРµ</th>
                                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase 
tracking-wider">РР°Р№РѕРЅ</th>
                                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase 
tracking-wider">РџРѕРґСЉРµР·РґРѕРІ</th>
                                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase 
tracking-wider">Р”РµР№СЃС‚РІРёРµ</th>
                              </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-800 bg-gray-800/20">
                              <template x-for="house in filteredDbOnlyHouses" :key="house.id">
                                  <tr class="hover:bg-gray-700/30 transition-colors" :class="{ 'bg-amber-900/10': 
house.is_test }">
                                      <td class="px-6 py-3 text-sm">
                                          <span class="text-white font-medium" x-text="house.title"></span>
                                          <span x-show="house.is_test" class="ml-2 inline-flex items-center px-2 
py-0.5 rounded-md text-xs font-medium bg-amber-900/40 text-amber-300 border border-amber-700/50">РўРµСЃС‚</span>
                                      </td>
                                      <td class="px-6 py-3 text-sm text-gray-400" x-text="house.district || 
'вЂ”'"></td>
                                      <td class="px-6 py-3 text-sm text-center text-gray-300" 
x-text="house.total_entrances || 0"></td>
                                      <td class="px-6 py-3 text-center">
                                          <button x-show="!house.is_test"
                                                  @click="markAsTest(house)"
                                                  class="px-3 py-1.5 text-xs font-medium rounded-lg border 
border-amber-700/50 text-amber-300 bg-amber-900/20 hover:bg-amber-900/40 transition-colors">
                                              РџРѕРјРµС‚РёС‚СЊ С‚РµСЃС‚РѕРІС‹Рј
                                          </button>
                                          <button x-show="house.is_test"
                                                  @click="unmarkAsTest(house)"
                                                  class="px-3 py-1.5 text-xs font-medium rounded-lg border 
border-gray-600 text-gray-400 bg-gray-800 hover:bg-gray-700 transition-colors">
                                              РЎРЅСЏС‚СЊ РјРµС‚РєСѓ
                                          </button>
                                      </td>
                                  </tr>
                              </template>
                              <tr x-show="filteredDbOnlyHouses.length === 0">
                                  <td colspan="4" class="px-6 py-12 text-center text-gray-500">
                                      <span x-show="!dbHouseSearch && !showTestOnly">Р’СЃРµ РґРѕРјР° РёР· Р±Р°Р·С‹ 
РїСЂРёРІСЏР·Р°РЅС‹ Рє РїСЂР°Р№СЃ-Р»РёСЃС‚Сѓ. рџЋ‰</span>
                                      <span x-show="dbHouseSearch || showTestOnly">РќРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ 
РїРѕ С„РёР»СЊС‚СЂСѓ.</span>
                                  </td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
              </div>
  
              <!-- PDF Generator Tab -->
              <div x-show="!loading && currentTab === 'generator'" x-cloak class="grid grid-cols-1 lg:grid-cols-12 
gap-8">
                  <!-- Left Controls Panel -->
                  <div class="lg:col-span-4 space-y-6">
                      <div class="glass rounded-3xl p-6 border border-gray-700/50 space-y-6">
                          <h3 class="text-xl font-bold text-white mb-4">РќР°СЃС‚СЂРѕР№РєРё СЃРјРµС‚С‹</h3>
                          
                          <!-- Client Name Input -->
                          <div>
                              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider 
mb-2">РќР°Р·РІР°РЅРёРµ РєР»РёРµРЅС‚Р° / РєРѕРјРїР°РЅРёРё</label>
                              <input type="text" x-model="generatorClientName" placeholder="РђРћ 
'РљР°Р·Р°С…С‚РµР»РµРєРѕРј'..."
                                     class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm 
text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                          </div>
  
                          <!-- Placement Start Date -->
                          <div>
                              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider 
mb-2">Р”Р°С‚Р° РЅР°С‡Р°Р»Р° СЂР°Р·РјРµС‰РµРЅРёСЏ</label>
                              <input type="date" x-model="generatorStartDate"
                                     class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm 
text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                          </div>
  
                          <!-- Placements Duration (Days) -->
                          <div>
                              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider 
mb-2">РЎСЂРѕРє СЂР°Р·РјРµС‰РµРЅРёСЏ (РґРЅРµР№)</label>
                              <div class="flex gap-2">
                                  <input type="number" x-model.number="generatorDays" min="1" max="365"
                                         class="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 
text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                                  <div class="flex gap-1">
                                      <button @click="generatorDays = 15" class="px-3 py-2 text-xs bg-gray-800 
hover:bg-gray-700 text-gray-300 rounded-xl border border-gray-700 transition-colors">15 РґРЅ.</button>
                                      <button @click="generatorDays = 30" class="px-3 py-2 text-xs bg-gray-800 
hover:bg-gray-700 text-gray-300 rounded-xl border border-gray-700 transition-colors">30 РґРЅ.</button>
                                  </div>
                              </div>
                          </div>
  
                          <!-- Discount Input -->
                          <div>
                              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider 
mb-2">РЎРєРёРґРєР° (%)</label>
                              <input type="number" x-model.number="generatorDiscount" min="0" max="99" placeholder="0"
                                     class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm 
text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                          </div>
  
                          <!-- VAT Toggle -->
                          <div class="flex items-center justify-between p-3.5 bg-gray-900/40 rounded-xl border 
border-gray-800">
                              <div>
                                  <span class="text-sm font-semibold text-gray-200">РќР”РЎ (16%)</span>
                                  <p class="text-xs text-gray-500 mt-0.5">Р’РєР»СЋС‡РёС‚СЊ РЅР°Р»РѕРі РІ 
СЃС‚РѕРёРјРѕСЃС‚СЊ</p>
                              </div>
                              <label class="relative inline-flex items-center cursor-pointer select-none">
                                  <input type="checkbox" x-model="generatorIncludeVat" class="sr-only peer">
                                  <div class="w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer 
peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] 
after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 
after:transition-all peer-checked:after:bg-white peer-checked:bg-emerald-500 animate-all"></div>
                              </label>
                          </div>
  
                          <!-- Sector Selection -->
                          <div>
                              <div class="flex justify-between items-center mb-3">
                                  <label class="block text-xs font-semibold text-gray-400 uppercase 
tracking-wider">Р’С‹Р±РµСЂРёС‚Рµ СЃРµРєС‚РѕСЂР°</label>
                                  <div class="flex gap-2 text-[10px] font-bold">
                                      <button @click="generatorSelectedSectors = sectors.filter(s => s.is_mapped && 
s.price > 0).map(s => s.sheet_name + '|' + s.sheet_sector_name)" 
                                              class="text-emerald-400 hover:text-emerald-300 transition-colors 
uppercase tracking-wider">Р’С‹Р±СЂР°С‚СЊ РІСЃРµ</button>
                                      <span class="text-gray-600">|</span>
                                      <button @click="generatorSelectedSectors = []; generatorExpandedSectors = [];" 
                                              class="text-rose-400 hover:text-rose-300 transition-colors uppercase 
tracking-wider">РЎР±СЂРѕСЃРёС‚СЊ РІСЃРµ</button>
                                  </div>
                              </div>
                              <div class="max-h-[380px] overflow-y-auto scrollbar-hide space-y-4 pr-1">
                                  <!-- Group sectors by city -->
                                  <template x-for="city in availableCities" :key="city">
                                      <div class="space-y-2">
                                          <h4 class="text-xs font-bold text-emerald-400 uppercase tracking-widest 
border-b border-gray-800 pb-1" x-text="city"></h4>
                                          <div class="space-y-2 pl-1">
                                              <template x-for="sector in sectors.filter(s => s.sheet_name === city)" 
:key="sector.sheet_sector_name">
                                                  <div class="space-y-1">
                                                      <div class="flex items-center justify-between text-sm 
text-gray-300 select-none py-0.5">
                                                          <label class="flex items-center space-x-3 hover:text-white 
cursor-pointer flex-1 min-w-0">
                                                              <input type="checkbox" :value="sector.sheet_name + '|' + 
sector.sheet_sector_name" x-model="generatorSelectedSectors"
                                                                     class="rounded border-gray-700 text-emerald-500 
focus:ring-emerald-500 bg-gray-900 w-4 h-4 shrink-0">
                                                              <span x-text="sector.sheet_sector_name" 
class="font-medium truncate"></span>
                                                          </label>
                                                          <div class="flex items-center space-x-2 shrink-0 ml-2">
                                                              <span @click.stop="showSectorOccupancy(sector)" 
                                                                     class="text-[9px] px-1.5 py-0.5 rounded-md 
font-semibold cursor-pointer hover:bg-opacity-80 active:scale-95 transition-all select-none shrink-0" 
                                                                     
:class="getSlotBadgeClass(getSectorRemainingSlots(sector))"
                                                                     title="РљР»РёРєРЅРёС‚Рµ, С‡С‚РѕР±С‹ 
РїРѕСЃРјРѕС‚СЂРµС‚СЊ РєР»РёРµРЅС‚РѕРІ Рё СЂРѕР»РёРєРё РІ СЂРѕС‚Р°С†РёРё" 
                                                                     x-text="getSectorRemainingSlots(sector) + ' 
СЃР».'"></span>
                                                               <span class="text-xs text-gray-500" 
x-text="(sector.price || 0).toLocaleString() + ' в‚ё/РјРµСЃ'"></span>
                                                              <button 
x-show="generatorSelectedSectors.includes(sector.sheet_name + '|' + sector.sheet_sector_name)"
                                                                      
@click.prevent="toggleSectorExpansion(sector.sheet_name + '|' + sector.sheet_sector_name)" 
                                                                      class="text-gray-500 hover:text-emerald-400 
p-0.5 rounded transition-colors"
                                                                      title="РќР°СЃС‚СЂРѕР№РєР° РґРѕРјРѕРІ РІ 
СЃРµРєС‚РѕСЂРµ">
                                                                  <svg class="w-3.5 h-3.5 transform 
transition-transform duration-200" 
                                                                       
:class="generatorExpandedSectors.includes(sector.sheet_name + '|' + sector.sheet_sector_name) ? 'rotate-180 
text-emerald-400' : 'rotate-0'"
                                                                       fill="none" viewBox="0 0 24 24" 
stroke="currentColor">
                                                                      <path stroke-linecap="round" 
stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
                                                                  </svg>
                                                              </button>
                                                          </div>
                                                      </div>
                                                      
                                                      <!-- Houses checklist inside selected sector -->
                                                      <div x-show="generatorSelectedSectors.includes(sector.sheet_name 
+ '|' + sector.sheet_sector_name) && generatorExpandedSectors.includes(sector.sheet_name + '|' + 
sector.sheet_sector_name)" 
                                                           class="pl-7 pr-1 py-1.5 space-y-1 bg-gray-950/40 rounded-lg 
border border-gray-800/30 max-h-[140px] overflow-y-auto scrollbar-hide text-xs"
                                                           x-transition>
                                                          <div class="text-[9px] uppercase tracking-wider 
text-gray-500 font-semibold mb-1">РСЃРєР»СЋС‡РёС‚СЊ РґРѕРјР°:</div>
                                                          <template x-for="house in priceListData.filter(h => 
h.sheet_name === sector.sheet_name && h.sheet_sector_name === sector.sheet_sector_name)" :key="house.sheet_house_name">
                                                              <label class="flex items-center space-x-2 py-0.5 
text-[11px] text-gray-400 hover:text-white cursor-pointer select-none">
                                                                  <input type="checkbox" 
                                                                         
:checked="!generatorExcludedHouses.includes(house.sheet_name + '|' + house.sheet_house_name)"
                                                                         
@change="toggleHouseExclusion(house.sheet_name + '|' + house.sheet_house_name)"
                                                                         class="rounded border-gray-800 
text-emerald-500 focus:ring-emerald-500 bg-gray-900 w-3 h-3">
                                                                  <span x-text="house.sheet_house_name" 
class="truncate flex-1"></span>
                                                                   <span class="text-[9px] px-1.5 py-0.5 rounded-md 
font-semibold cursor-help select-none shrink-0"
                                                                           
:class="getSlotBadgeClass(getHouseRemainingSlots(house))"
                                                                           :title="getHouseOccupancyTooltip(house)"
                                                                           x-text="getHouseRemainingSlots(house) + ' 
СЃР».'"></span>
                                                                  <span class="text-[9px] text-gray-600 font-mono" 
x-text="(house.actual_monitors || 0) + ' РјРѕРЅ.'"></span>
                                                              </label>
                                                          </template>
                                                      </div>
                                                  </div>
                                              </template>
                                          </div>
                                      </div>
                                  </template>
                              </div>
                          </div>
  
                          <!-- Checkbox for Detailed Address Program -->
                          <div class="flex items-center space-x-3 text-sm text-gray-300 hover:text-white 
cursor-pointer select-none py-2 border-t border-gray-800 mt-4 mb-2">
                              <input type="checkbox" id="include-detailed-address" 
x-model="generatorIncludeDetailedAddress"
                                     class="rounded border-gray-700 text-emerald-500 focus:ring-emerald-500 
bg-gray-900 w-4 h-4">
                              <label for="include-detailed-address" class="cursor-pointer font-medium">РЎРѕР·РґР°С‚СЊ 
РїРѕРґСЂРѕР±РЅСѓСЋ Р°РґСЂРµСЃРЅСѓСЋ РїСЂРѕРіСЂР°РјРјСѓ</label>
                          </div>
  
                          <!-- Action Buttons -->
                          <div class="space-y-3">
                              <!-- Download PDF Button -->
                              <button @click="downloadSmetaPdf()" 
                                      :disabled="generatorTotals.sectors.length === 0"
                                      class="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 
hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-sm uppercase tracking-wider rounded-xl 
shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 
disabled:opacity-50 disabled:cursor-not-allowed">
                                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 
16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                  </svg>
                                  РЎРєР°С‡Р°С‚СЊ СЃРјРµС‚Сѓ РІ PDF
                              </button>
  
                              <!-- Copy Link Button -->
                              <button @click="copyMapLink()" 
                                      :disabled="generatorTotals.sectors.length === 0"
                                      class="w-full py-3.5 bg-gray-800 hover:bg-gray-700 text-emerald-400 
hover:text-emerald-300 font-bold text-xs uppercase tracking-wider rounded-xl border border-gray-700 
active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 
disabled:cursor-not-allowed">
                                  <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 
24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 
10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 
1.1"></path>
                                  </svg>
                                  <span x-text="generatorCopyLinkText">РљРѕРїРёСЂРѕРІР°С‚СЊ СЃСЃС‹Р»РєСѓ РЅР° 
РєР°СЂС‚Сѓ</span>
                              </button>
  
                              <!-- Tracker Link Generator -->
                              <div class="mt-4 pt-4 border-t border-gray-800">
                                  <h4 class="text-xs font-bold text-emerald-400 uppercase tracking-widest 
mb-2">РЎРѕР·РґР°С‚СЊ СЃСЃС‹Р»РєСѓ РґР»СЏ РєР»РёРµРЅС‚Р°</h4>
                                  <p class="text-[10px] text-gray-400 mb-3 leading-relaxed">РЎРєР°С‡Р°Р№С‚Рµ PDF 
СЃРјРµС‚Сѓ РІС‹С€Рµ, Р·Р°С‚РµРј Р·Р°РіСЂСѓР·РёС‚Рµ СЌС‚РѕС‚ С„Р°Р№Р» СЃСЋРґР°, С‡С‚РѕР±С‹ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё 
СЃРѕС…СЂР°РЅРёС‚СЊ РµРіРѕ РІ РѕР±Р»Р°РєРѕ Рё РїРѕР»СѓС‡РёС‚СЊ СЃСЃС‹Р»РєСѓ СЃ РѕС‚СЃР»РµР¶РёРІР°РЅРёРµРј.</p>
                                  <div class="relative">
                                      <input type="file" @change="handlePdfUpload" accept="application/pdf" 
class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" :disabled="isGeneratingLink">
                                      <button class="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white text-xs 
font-bold uppercase tracking-wider rounded-xl border border-gray-700 transition-all flex justify-center items-center 
gap-2" :class="{'opacity-50 cursor-not-allowed': isGeneratingLink}">
                                          <svg x-show="!isGeneratingLink" class="w-4 h-4 text-gray-400" fill="none" 
stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 
16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                          <svg x-show="isGeneratingLink" class="animate-spin w-4 h-4 text-emerald-400" 
xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" 
stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 
018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                          <span x-text="isGeneratingLink ? 'Р“РµРЅРµСЂР°С†РёСЏ...' : 
'Р—Р°РіСЂСѓР·РёС‚СЊ PDF'"></span>
                                      </button>
                                  </div>
                                  <div x-show="trackingLinkUrl" x-transition class="mt-3 p-3 bg-emerald-900/20 border 
border-emerald-500/30 rounded-xl text-center">
                                      <p class="text-[10px] text-gray-400 mb-1">РЎСЃС‹Р»РєР°-С‚СЂРµРєРµСЂ 
РіРѕС‚РѕРІР°:</p>
                                      <a :href="trackingLinkUrl" target="_blank" class="text-emerald-400 text-sm 
font-bold tracking-wide hover:underline break-all" x-text="trackingLinkUrl"></a>
                                      <div class="mt-2 text-[10px] text-gray-500">РџСЂРё РїРµСЂРµС…РѕРґРµ Р±СѓРґРµС‚ 
Р·Р°РїРёСЃР°РЅРѕ РІСЂРµРјСЏ РѕС‚РєСЂС‹С‚РёСЏ.</div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
  
                  <!-- Right Preview Panel -->
                  <div class="lg:col-span-8">
                      <div class="w-full bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-2xl 
overflow-x-auto">
                          <div class="text-xs text-gray-400 mb-3 flex items-center justify-between">
                              <span>РџСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ РґРѕРєСѓРјРµРЅС‚Р° (Рђ4):</span>
                              <span>РЎРєСЂРѕР»Р»СЊС‚Рµ РґР»СЏ РїСЂРѕСЃРјРѕС‚СЂР° СЃС‚СЂР°РЅРёС†</span>
                          </div>
                          
                          <!-- PDF pages preview container -->
                          <div class="pdf-preview-container">
                              <div id="smeta-print-template" class="pdf-print-wrapper">
                                  <template x-for="(page, pageIdx) in generatorPages" :key="pageIdx">
                                      <div class="pdf-page" :class="{
                                           'pdf-page-cover': page.type === 'cover',
                                           'pdf-page-standard': page.type !== 'cover'
                                       }">
                                          
                                          <!-- Background Image for Cover Page (using actual img tag for max quality) 
-->
                                          <template x-if="page.type === 'cover'">
                                              <img :src="page.city === 'almaty' ? '/blank_almaty.jpg' : 
'/blank_astana.jpg'" 
                                                   class="absolute inset-0 w-full h-full" 
                                                   style="pointer-events: none; border: none; margin: 0; padding: 0; 
z-index: 1;">
                                          </template>
                                      
                                      <!-- Page 1: Cover and Summary -->
                                      <template x-if="page.type === 'cover'">
                                          <div class="flex flex-col justify-between relative" style="height: 195mm; 
z-index: 10; box-sizing: border-box;">
                                              <div class="space-y-5">
                                                  <!-- Title -->
                                                  <h2 class="text-center text-[15px] font-black uppercase 
tracking-wider text-gray-900 mt-2">РљРћРњРњР•РР§Р•РЎРљРћР• РџРР•Р”Р›РћР–Р•РќРР•</h2>
                                                  
                                                  <!-- Intro Text -->
                                                  <p class="text-[10px] leading-relaxed text-gray-600">
                                                      Р‘Р»Р°РіРѕРґР°СЂРёРј РІР°СЃ Р·Р° РїСЂРѕСЏРІР»РµРЅРЅС‹Р№ 
РёРЅС‚РµСЂРµСЃ Рє РЅР°С€РµР№ СЂРµРєР»Р°РјРЅРѕР№ СЃРµС‚Рё. РќР°С€Р° РєРѕРјРїР°РЅРёСЏ РїСЂРµРґР»Р°РіР°РµС‚ 
СЂР°Р·РјРµС‰РµРЅРёРµ СЂРµРєР»Р°РјРЅС‹С… РІРёРґРµРѕРјР°С‚РµСЂРёР°Р»РѕРІ РЅР° РјРѕРЅРёС‚РѕСЂР°С… РІ Р»РёС„С‚РѕРІС‹С… 
С…РѕР»Р»Р°С… Рё РІРЅСѓС‚СЂРё Р»РёС„С‚РѕРІ РІ Р¶РёР»С‹С… РєРѕРјРїР»РµРєСЃР°С… Р±РёР·РЅРµСЃ- Рё 
РїСЂРµРјРёСѓРј-РєР»Р°СЃСЃР°. РќРёР¶Рµ РїСЂРµРґСЃС‚Р°РІР»РµРЅР° СЃРІРѕРґРЅР°СЏ СЃРјРµС‚Р° РїРѕ РІС‹Р±СЂР°РЅРЅС‹Рј 
СЃРµРєС‚РѕСЂР°Рј:
                                                  </p>
  
                                                  <!-- Details Info -->
                                                  <div class="grid grid-cols-2 gap-4 p-3.5 rounded-xl border-2 
border-emerald-500">
                                                      <div class="space-y-1">
                                                          <p class="text-gray-400 text-[9px] uppercase font-bold 
tracking-wider">Р—Р°РєР°Р·С‡РёРє:</p>
                                                          <p class="font-extrabold text-xs text-gray-900" 
x-text="generatorClientName.trim() ? generatorClientName.trim() : 'РЈРІР°Р¶Р°РµРјС‹Р№ РєР»РёРµРЅС‚'"></p>
                                                      </div>
                                                      <div class="text-right space-y-1">
                                                          <p class="text-gray-400 text-[9px] uppercase font-bold 
tracking-wider">Р”Р°С‚Р° СЃРѕР·РґР°РЅРёСЏ РґРѕРєСѓРјРµРЅС‚Р°:</p>
                                                          <p class="font-extrabold text-xs text-gray-900" 
x-text="todayDate"></p>
                                                          <p class="text-gray-400 text-[9px] uppercase font-bold 
tracking-wider mt-1">РЎСЂРѕРє СЂР°Р·РјРµС‰РµРЅРёСЏ:</p>
                                                          <p class="font-extrabold text-xs text-gray-900" 
x-text="generatorDays + ' РґРЅРµР№'"></p>
                                                      </div>
                                                  </div>
  
                                                  <!-- Grand Totals / Summary Box -->
                                                  <div class="border-2 border-emerald-500 rounded-xl p-4 space-y-3">
                                                      <h3 class="text-[10px] font-black uppercase tracking-wider 
text-emerald-600 border-b-2 border-emerald-500 pb-1.5">РЎРІРѕРґРЅР°СЏ СЃРјРµС‚Р° РїРѕ СЂР°Р·РјРµС‰РµРЅРёСЋ</h3>
                                                      <div class="grid grid-cols-2 gap-4 text-[9.5px]">
                                                          <!-- Left column: breakdown by city/format -->
                                                          <div class="space-y-2 text-gray-700 flex flex-col 
justify-center">
                                                              <template x-for="cat in generatorCategorySummaries" 
:key="cat.name">
                                                                  <div class="flex justify-between">
                                                                      <span class="font-semibold text-gray-800" 
x-text="cat.name + ':'"></span>
                                                                      <span class="text-gray-900" x-text="cat.monitors 
+ ' РјРѕРЅРёС‚РѕСЂРѕРІ'"></span>
                                                                  </div>
                                                              </template>
                                                          </div>
                                                          <!-- Right column: financial calculations -->
>     <script>
          document.addEventListener('alpine:init', () => {
              Alpine.data('mappingApp', () => ({
                  currentTab: 'mapping',
                  selectedCity: 'all',
                  availableCities: [],
                  items: [],
                  sectors: [],
                  priceListData: [],
                  dbOnlyHouses: [],
                  dbHouseSearch: '',
                  showTestOnly: false,
                  stats: { total: 0, unmapped: 0 },
                  loading: true,
  
                  // Generator State
                  generatorClientName: '',
                  generatorSelectedSectors: [],
                  generatorDiscount: 0,
                  generatorDays: 30,
                  generatorIncludeVat: false,
                  generatorIncludeDetailedAddress: false,
                  generatorExcludedHouses: [],
                  generatorExpandedSectors: [],
                  generatorCopyLinkText: 'РљРѕРїРёСЂРѕРІР°С‚СЊ СЃСЃС‹Р»РєСѓ РЅР° РєР°СЂС‚Сѓ',
                  generatorStartDate: '',
                  occupancyData: {},
                  occupancyLoading: false,
                  showSectorOccupancyModal: false,
                  sectorOccupancyModalData: null,
  
                  // Coordinates Modal State
                  showCoordinatesModal: false,
                  coordsModalItem: null,
                  coordsModalDbId: null,
                  coordsModalIsIgnored: false,
                  coordsModalLat: '',
                  coordsModalLng: '',
                  coordsModalLoading: false,
                  coordsGeocodingError: '',
                  manualSearchAddress: '',
                  leafletMap: null,
                  leafletMarker: null,
                  coordsModalPhotoUrl: '',
                  coordsImageSearchQuery: '',
                  coordsImageSearchResults: [],
                  coordsImageSearching: false,
  
                  async init() {
                      const today = new Date();
                      const year = today.getFullYear();
                      const month = String(today.getMonth() + 1).padStart(2, '0');
                      const day = String(today.getDate()).padStart(2, '0');
                      this.generatorStartDate = `${year}-${month}-${day}`;
  
                      this.$watch('generatorDays', () => this.fetchOccupancy());
                      this.$watch('generatorStartDate', () => this.fetchOccupancy());
  
                      await this.fetchData();
                  },
  
                  toggleHouseExclusion(key) {
                      const idx = this.generatorExcludedHouses.indexOf(key);
                      if (idx === -1) {
                          this.generatorExcludedHouses.push(key);
                      } else {
                          this.generatorExcludedHouses.splice(idx, 1);
                      }
                  },
  
                  toggleSectorExpansion(key) {
                      const idx = this.generatorExpandedSectors.indexOf(key);
                      if (idx === -1) {
                          this.generatorExpandedSectors.push(key);
                      } else {
                          this.generatorExpandedSectors.splice(idx, 1);
                      }
                  },
  
                  get filteredItems() {
                      if (this.selectedCity === 'all') return this.items;
                      return this.items.filter(i => i.sheet_name === this.selectedCity);
                  },
  
                  get filteredSectors() {
                      if (this.selectedCity === 'all') return this.sectors;
                      return this.sectors.filter(s => s.sheet_name === this.selectedCity);
                  },
  
                  get groupedPriceList() {
                      let filtered = this.priceListData;
                      if (this.selectedCity !== 'all') {
                          filtered = filtered.filter(i => i.sheet_name === this.selectedCity);
                      }
                      
                      const grouped = {};
                      filtered.forEach(item => {
                          const key = item.sheet_sector_name || 'РќРµРёР·РІРµСЃС‚РЅС‹Р№ СЃРµРєС‚РѕСЂ';
                          if (!grouped[key]) grouped[key] = [];
                          grouped[key].push(item);
                      });
                      return grouped;
                  },
  
                  async fetchData() {
                      this.loading = true;
                      try {
                          const res = await fetch('/api/sync-status');
                          const data = await res.json();
                          if (data.success) {
                              this.items = data.data.map(i => ({ ...i, _showSearch: false }));
                              
                              // РЎРѕР±РёСЂР°РµРј СѓРЅРёРєР°Р»СЊРЅС‹Рµ РіРѕСЂРѕРґР° (РЅР°Р·РІР°РЅРёСЏ Р»РёСЃС‚РѕРІ)
                              const cities = new Set(this.items.map(i => i.sheet_name));
                              this.availableCities = Array.from(cities).filter(Boolean);
                              
                              this.updateStats();
                          }
                      } catch (e) {
                          console.error("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РґР°РЅРЅС‹С…", e);
                      } finally {
                          this.loading = false;
                      }
                  },
  
                  async fetchPriceList() {
                      this.loading = true;
                      try {
                          const res = await fetch('/api/price-list');
                          const data = await res.json();
                          if (data.success) {
                              this.priceListData = data.data;
                          }
                      } catch (e) {
                          console.error("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РїСЂР°Р№СЃ-Р»РёСЃС‚Р°", e);
                      } finally {
                          this.loading = false;
                      }
                  },
  
                  updateStats() {
                      const targetItems = this.filteredItems;
                      this.stats.total = targetItems.length;
                      this.stats.unmapped = targetItems.filter(i => !i.is_mapped && !i.is_ignored).length;
                  },
  
                  async fetchSectors() {
                      this.loading = true;
                      try {
                          const res = await fetch('/api/sectors');
                          const data = await res.json();
                          if (data.success) {
                              this.sectors = data.data;
                          }
                      } catch (e) {
                          console.error("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё СЃРµРєС‚РѕСЂРѕРІ", e);
                      } finally {
                          this.loading = false;
                      }
                  },
  
                  async fetchOccupancy() {
                      if (!this.generatorStartDate) return;
                      this.occupancyLoading = true;
                      try {
                          const start = new Date(this.generatorStartDate);
                          const end = new Date(start);
                          end.setDate(end.getDate() + (this.generatorDays || 30) - 1);
                          
                          const startStr = start.toISOString().split('T')[0];
                          const endStr = end.toISOString().split('T')[0];
  
                          const res = await fetch(`/api/occupancy?start_date=${startStr}&end_date=${endStr}`);
                          const data = await res.json();
                          if (data.success) {
                              this.occupancyData = data.occupancy || {};
                          }
                      } catch (e) {
                          console.error("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё Р·Р°РЅСЏС‚РѕСЃС‚Рё", e);
                      } finally {
                          this.occupancyLoading = false;
                      }
                  },
  
                  getHouseOccupancy(house) {
                      if (!this.occupancyData || !house.db_house_ids || house.db_house_ids.length === 0) return [];
                      
                      let bookings = [];
                      house.db_house_ids.forEach(dbId => {
                          if (this.occupancyData[dbId]) {
                              bookings.push(...this.occupancyData[dbId]);
                          }
                      });
                      
                      const seen = new Set();
                      const uniqueBookings = [];
                      bookings.forEach(b => {
                          if (!seen.has(b.plan_id)) {
                              seen.add(b.plan_id);
                              uniqueBookings.push(b);
                          }
                      });
                      
                      return uniqueBookings;
                  },
  
                  getHouseVideoDurationSum(house) {
                      const bookings = this.getHouseOccupancy(house);
                      let totalDuration = 0;
                      bookings.forEach(b => {
                          if (b.videos && b.videos.length > 0) {
                              b.videos.forEach(v => {
                                  totalDuration += Number(v.duration || 0);
                              });
                          }
                      });
                      return totalDuration;
                  },
  
                  getHouseRemainingSlots(house) {
                      const sumDuration = this.getHouseVideoDurationSum(house);
                      return Math.max(0, Math.floor((600 - sumDuration) / 30));
                  },
  
                  getSectorRemainingSlots(sector) {
                      if (!this.priceListData || this.priceListData.length === 0) return 20;
                      const houses = this.priceListData.filter(h => h.sheet_name === sector.sheet_name && 
h.sheet_sector_name === sector.sheet_sector_name);
                      if (houses.length === 0) return 20;
                      let minSlots = 20;
                      houses.forEach(h => {
                          const s = this.getHouseRemainingSlots(h);
                          if (s < minSlots) {
                              minSlots = s;
                          }
                      });
                      return minSlots;
                  },
  
                  getSlotBadgeClass(slots) {
                      if (slots <= 2) {
                          return 'bg-rose-950/40 text-rose-400 border border-rose-900/30';
                      } else if (slots === 3 || slots === 4) {
                          return 'bg-amber-950/40 text-amber-400 border border-amber-900/30';
                      } else {
                          return 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30';
                      }
                  },
  
                  isHouseOccupied(house) {
                      return this.getHouseOccupancy(house).length > 0;
                  },
  
                  getHouseOccupancyTooltip(house) {
                      const bookings = this.getHouseOccupancy(house);
                      const sumDuration = this.getHouseVideoDurationSum(house);
                      const slotsLeft = this.getHouseRemainingSlots(house);
                      const occupiedPerLoop = sumDuration / 2;
                      const freePerLoop = (600 - sumDuration) / 2;
  
                      let tooltip = "РЎРІРѕР±РѕРґРЅРѕ СЃР»РѕС‚РѕРІ: " + slotsLeft + " (РїРѕ 15 СЃРµРє)\n";
                      tooltip += "Р—Р°РЅСЏС‚Рѕ РІ РѕРґРЅРѕРј С†РёРєР»Рµ: " + occupiedPerLoop + " СЃРµРє\n";
                      tooltip += "РЎРІРѕР±РѕРґРЅРѕ РІ РѕРґРЅРѕРј С†РёРєР»Рµ: " + freePerLoop + " СЃРµРє\n\n";
  
                      if (bookings.length === 0) {
                          tooltip += 'РќРµС‚ Р°РєС‚РёРІРЅС‹С… РєР°РјРїР°РЅРёР№';
                          return tooltip;
                      }
  
                      tooltip += 'РђРєС‚РёРІРЅС‹Рµ РєР°РјРїР°РЅРёРё:\n';
                      bookings.forEach(b => {
                          const from = new Date(b.date_from).toLocaleDateString('ru-RU');
                          const to = new Date(b.date_to).toLocaleDateString('ru-RU');
                          tooltip += "- " + b.customer_title + " (" + (b.contract_number || 'Р±РµР· РґРѕРіРѕРІРѕСЂР°') 
+ ")\n";
                          tooltip += "  РџРµСЂРёРѕРґ: СЃ " + from + " РїРѕ " + to + "\n";
                          tooltip += "  РРѕР»РёРєРё (" + (b.videos?.length || 0) + "): " + (b.videos?.map(v => v.title 
+ " (" + v.duration + "СЃ)").join(', ') || 'РЅРµС‚') + "\n";
                      });
  
                      return tooltip;
                  },
  
                  getHouseOccupancyLabel(house) {
                      const bookings = this.getHouseOccupancy(house);
                      if (bookings.length === 0) return '';
                      if (bookings.length === 1) {
                          return "Р—Р°РЅСЏС‚: " + bookings[0].customer_title;
                      }
                      return "Р—Р°РЅСЏС‚ (РєР»РёРµРЅС‚РѕРІ: " + bookings.length + ")";
                  },
  
                  getSectorOccupancyCount(sector) {
                      if (!this.priceListData || this.priceListData.length === 0) return 0;
                      const houses = this.priceListData.filter(h => h.sheet_name === sector.sheet_name && 
h.sheet_sector_name === sector.sheet_sector_name);
                      let occupiedCount = 0;
                      houses.forEach(h => {
                          if (this.isHouseOccupied(h)) {
                              occupiedCount++;
                          }
                      });
                      return occupiedCount;
                  },
  
                  showSectorOccupancy(sector) {
                      const houses = this.priceListData.filter(h => h.sheet_name === sector.sheet_name && 
h.sheet_sector_name === sector.sheet_sector_name);
                      const bookingsMap = new Map();
                      
                      let maxSectorDuration = 0;
                      houses.forEach(h => {
                          const dur = this.getHouseVideoDurationSum(h);
                          if (dur > maxSectorDuration) {
                              maxSectorDuration = dur;
                          }
                          
                          const houseBookings = this.getHouseOccupancy(h);
                          houseBookings.forEach(b => {
                              if (!bookingsMap.has(b.plan_id)) {
                                  bookingsMap.set(b.plan_id, {
                                      plan_id: b.plan_id,
                                      customer_title: b.customer_title,
                                      contract_number: b.contract_number,
                                      date_from: b.date_from,
                                      date_to: b.date_to,
                                      videos: b.videos || [],
                                      houses: []
                                  });
                              }
                              if (!bookingsMap.get(b.plan_id).houses.includes(h.sheet_house_name)) {
                                  bookingsMap.get(b.plan_id).houses.push(h.sheet_house_name);
                              }
                          });
                      });
  
                      const freeDuration = Math.max(0, 600 - maxSectorDuration);
                      const slotsLeft = Math.max(0, Math.floor(freeDuration / 30));
  
                      this.sectorOccupancyModalData = {
                          sectorName: sector.sheet_sector_name,
                          cityName: sector.sheet_name,
                          occupiedSeconds: maxSectorDuration,
                          freeSeconds: freeDuration,
                          occupiedLoopSeconds: maxSectorDuration / 2,
                          freeLoopSeconds: freeDuration / 2,
                          slotsLeft: slotsLeft,
                          bookings: Array.from(bookingsMap.values())
                      };
                      this.showSectorOccupancyModal = true;
                  },
  
                  async saveSectorMapping(sector, db_id, title) {
                      try {
                          const newIds = [...(sector.db_district_ids || []), db_id];
                          const newTitles = [...(sector.db_district_titles || []), title];
  
                          const payload = {
                              sheet_name: sector.sheet_name,
                              sheet_sector_name: sector.sheet_sector_name,
                              db_district_ids: newIds,
                              db_district_titles: newTitles,
                              price: sector.price || 0
                          };
                          const res = await fetch('/api/sector-mappings', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload)
                          });
                          const data = await res.json();
                          if (data.success) {
                              sector.is_mapped = true;
                              sector.db_district_ids = newIds;
                              sector.db_district_titles = newTitles;
                              sector.mapping_id = data.data.id;
                          }
                      } catch (e) {
                          alert('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ');
                      }
                  },
  
                  async saveSectorPrice(sector) {
                      try {
                          const payload = {
                              sheet_name: sector.sheet_name,
                              sheet_sector_name: sector.sheet_sector_name,
                              db_district_ids: sector.db_district_ids || [],
                              db_district_titles: sector.db_district_titles || [],
                              price: sector.price || 0
                          };
                          const res = await fetch('/api/sector-mappings', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload)
                          });
                          const data = await res.json();
                          if (!data.success) {
                              alert('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ С†РµРЅС‹');
                          }
                      } catch (e) {
                          alert('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ С†РµРЅС‹');
                      }
                  },
  
                  async removeDistrictFromSector(sector, idxToRemove) {
                      try {
                          const newIds = sector.db_district_ids.filter((_, idx) => idx !== idxToRemove);
                          const newTitles = sector.db_district_titles.filter((_, idx) => idx !== idxToRemove);
  
                          if (newIds.length === 0) {
                              await this.deleteSectorMapping(sector);
                              return;
                          }
  
                          const payload = {
                              sheet_name: sector.sheet_name,
                              sheet_sector_name: sector.sheet_sector_name,
                              db_district_ids: newIds,
                              db_district_titles: newTitles,
                              price: sector.price || 0
                          };
                          
                          const res = await fetch('/api/sector-mappings', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload)
                          });
                          
                          if (res.ok) {
                              sector.db_district_ids = newIds;
                              sector.db_district_titles = newTitles;
                          }
                      } catch (e) {
                          console.error(e);
                      }
                  },
  
                  async deleteSectorMapping(sector) {
                      if (!sector.mapping_id) return;
                      try {
                          await fetch(`/api/sector-mappings/${sector.mapping_id}`, { method: 'DELETE' });
                          sector.is_mapped = false;
                          sector.db_district_ids = [];
                          sector.db_district_titles = [];
                          sector.mapping_id = null;
                      } catch (e) {
                          alert('РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ');
                      }
                  },
  
                  showAddMore(item) {
                      item._showSearch = true;
                  },
  
                  async removeSingleId(item, idToRemove) {
                      const newIds = item.db_house_ids.filter(id => id !== idToRemove);
                      if (newIds.length === 0) {
                          return this.deleteMapping(item);
                      }
                      return this.saveMapping(item, null, false, newIds);
                  },
  
                  async saveMapping(item, db_id, is_ignored, exactIds = null) {
                      console.log('РЎРѕС…СЂР°РЅРµРЅРёРµ РјР°РїРїРёРЅРіР°:', { item, db_id, is_ignored, exactIds });
                      try {
                          let newIds = exactIds || [...(item.db_house_ids || [])];
                          if (db_id && !newIds.includes(db_id)) {
                              newIds.push(db_id);
                          }
  
                          const payload = {
                              sheet_house_name: item.sheet_house_name,
                              sheet_city_name: item.sheet_name, 
                              db_house_ids: newIds,
                              is_ignored: is_ignored
                          };
  
                          const res = await fetch('/api/mappings', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload)
                          });
                          
                          if (!res.ok) throw new Error('РћС€РёР±РєР° СЃРµСЂРІРµСЂР°: ' + res.status);
  
                          const result = await res.json();
                          if (result.success) {
                              console.log('РЈСЃРїРµС€РЅРѕ СЃРѕС…СЂР°РЅРµРЅРѕ:', result.data);
                              item.is_mapped = true;
                              item.is_ignored = is_ignored;
                              item.db_house_ids = newIds;
                              item.mapping_id = result.data.id;
                              this.updateStats();
                          } else {
                              throw new Error(result.message || 'РћС€РёР±РєР° API');
                          }
                      } catch (e) {
                          console.error('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ СЃРІСЏР·Рё:', e);
                          alert('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ СЃРІСЏР·Рё: ' + e.message);
                      }
                  },
  
                  async deleteMapping(item) {
                      if (!item.mapping_id) return;
                      
                      try {
                          const res = await fetch(`/api/mappings/${item.mapping_id}`, {
                              method: 'DELETE'
                          });
                          
                          const result = await res.json();
                          if (result.success) {
                              item.is_mapped = false;
                              item.is_ignored = false;
                              item.db_house_ids = [];
                              item.mapping_id = null;
                              item._showSearch = false;
                              this.updateStats();
                          }
                      } catch (e) {
                          console.error('РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ СЃРІСЏР·Рё', e);
                          alert('РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ СЃРІСЏР·Рё');
                      }
                  },
  
                  get filteredDbOnlyHouses() {
                      let list = this.dbOnlyHouses;
                      if (this.showTestOnly) list = list.filter(h => h.is_test);
                      if (this.dbHouseSearch.trim()) {
                          const q = this.dbHouseSearch.toLowerCase();
                          list = list.filter(h => 
                              (h.title || '').toLowerCase().includes(q) ||
                              (h.district || '').toLowerCase().includes(q) ||
                              (h.city || '').toLowerCase().includes(q)
                          );
                      }
                      return list;
                  },
  
                  async fetchDbOnlyHouses() {
                      this.loading = true;
                      try {
                          const res = await fetch('/api/db-only-houses');
                          const data = await res.json();
                          if (data.success) this.dbOnlyHouses = data.data;
                      } catch (e) {
                          console.error('РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РґРѕРјРѕРІ РёР· Р‘Р”', e);
                      } finally {
                          this.loading = false;
                      }
                  },
  
                  async markAsTest(house) {
                      try {
                          const res = await fetch('/api/test-houses', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ db_house_id: house.id, db_house_title: house.title })
                          });
                          const data = await res.json();
                          if (data.success) house.is_test = true;
                      } catch(e) { alert('РћС€РёР±РєР°'); }
                  },
  
                  async unmarkAsTest(house) {
                      try {
                          const res = await fetch(`/api/test-houses/${house.id}`, { method: 'DELETE' });
                          const data = await res.json();
                          if (data.success) house.is_test = false;
                      } catch(e) { alert('РћС€РёР±РєР°'); }
                  },
  
                  async startMappingWithCoords(item, db_id, is_ignored) {
                      this.coordsModalItem = item;
                      this.coordsModalDbId = db_id;
                      this.coordsModalIsIgnored = is_ignored;
                      this.showCoordinatesModal = true;
                      this.coordsGeocodingError = '';
                      this.manualSearchAddress = '';
                      this.coordsModalLoading = true;
                      this.coordsModalPhotoUrl = item.photo_url || '';
                      this.coordsImageSearchResults = [];
                      this.coordsImageSearching = false;
                      this.coordsImageSearchQuery = '';
  
                      await this.geocodeAndOpen(item);
                  },
  
                  async geocodeAndOpen(item) {
                      const address = item.sheet_address;
                      const city = item.sheet_name;
                      this.coordsModalLoading = true;
                      this.coordsGeocodingError = '';
  
                      try {
                          const res = await 
fetch(`/api/geocode?address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}`);
                          const data = await res.json();
                          if (data.success) {
                              this.coordsModalLat = data.latitude;
                              this.coordsModalLng = data.longitude;
                          } else {
                              console.warn('Geocoding failed, using default coordinates:', data.message);
                              this.coordsGeocodingError = data.message || 'РђРґСЂРµСЃ РЅРµ РЅР°Р№РґРµРЅ';
                              this.setDefaultCoords(city);
                          }
                      } catch (e) {
                          console.error('Geocoding fetch error:', e);
                          this.coordsGeocodingError = 'РћС€РёР±РєР° СЃРµС‚Рё РїСЂРё РіРµРѕРєРѕРґРёСЂРѕРІР°РЅРёРё';
                          this.setDefaultCoords(city);
                      } finally {
                          this.coordsModalLoading = false;
                          setTimeout(() => {
                              this.initMap(parseFloat(this.coordsModalLat), parseFloat(this.coordsModalLng));
                          }, 150);
                      }
                  },
  
                  async geocodeManualAddress() {
                      if (!this.manualSearchAddress.trim()) return;
                      this.coordsModalLoading = true;
                      this.coordsGeocodingError = '';
  
                      try {
                          const res = await 
fetch(`/api/geocode?address=${encodeURIComponent(this.manualSearchAddress)}`);
                          const data = await res.json();
                          if (data.success) {
                              this.coordsModalLat = data.latitude;
                              this.coordsModalLng = data.longitude;
                              
                              if (this.leafletMarker && this.leafletMap) {
                                  const newLatLng = new L.LatLng(data.latitude, data.longitude);
                                  this.leafletMarker.setLatLng(newLatLng);
                                  this.leafletMap.setView(newLatLng, 15);
                              }
                          } else {
                              this.coordsGeocodingError = data.message || 'РђРґСЂРµСЃ РЅРµ РЅР°Р№РґРµРЅ';
                          }
                      } catch (e) {
                          this.coordsGeocodingError = 'РћС€РёР±РєР° РїСЂРё РіРµРѕРєРѕРґРёСЂРѕРІР°РЅРёРё Р°РґСЂРµСЃР°';
                      } finally {
                          this.coordsModalLoading = false;
                      }
                  },
  
                  setDefaultCoords(city) {
                      const lowerCity = (city || '').toLowerCase();
                      if (lowerCity.includes('Р°Р»РјР°С‚С‹') || lowerCity.includes('almaty')) {
                          this.coordsModalLat = 43.238949;
                          this.coordsModalLng = 76.889709;
                      } else if (lowerCity.includes('Р°СЃС‚Р°РЅР°') || lowerCity.includes('astana') || 
lowerCity.includes('РЅСѓСЂ-СЃСѓР»С‚Р°РЅ') || lowerCity.includes('nur-sultan')) {
                          this.coordsModalLat = 51.160522;
                          this.coordsModalLng = 71.470360;
                      } else if (lowerCity.includes('С€С‹РјРєРµРЅС‚') || lowerCity.includes('shymkent')) {
                          this.coordsModalLat = 42.324913;
                          this.coordsModalLng = 69.588261;
                      } else if (lowerCity.includes('РєР°СЂР°РіР°РЅРґР°') || lowerCity.includes('karaganda')) {
                          this.coordsModalLat = 49.801889;
                          this.coordsModalLng = 73.087402;
                      } else {
                          this.coordsModalLat = 48.0196;
                          this.coordsModalLng = 66.9237;
                      }
                  },
  
                  async initMap(lat, lng) {
                      const container = document.getElementById('coords-map');
                      if (!container) return;
  
                      if (this.leafletMap) {
                          this.leafletMap.remove();
                          this.leafletMap = null;
                      }
  
                      this.leafletMap = L.map('coords-map').setView([lat, lng], 15);
  
                      // Fetch config for 2GIS API Key
                      let twogisKey = '';
                      try {
                          const configRes = await fetch('/api/config');
                          const configData = await configRes.json();
                          if (configData.success) {
                              twogisKey = configData.twogis_api_key || '';
                          }
                      } catch (e) {
                          console.error('РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РєРѕРЅС„РёРіСѓСЂР°С†РёРё:', e);
                      }
  
                      // 2GIS dark tiles вЂ” uses CSS filter for custom dark styling
                      let tileUrl = 'https://tile{s}.maps.2gis.com/tiles?x={x}&y={y}&z={z}';
                      let tileOptions = {
                          maxZoom: 19,
                          maxNativeZoom: 18,
                          subdomains: '0123',
                          className: 'dark-tiles',
                          attribution: 'В© 2GIS'
                      };
  
                      if (twogisKey) {
                          // Official high-resolution 2GIS tiles if key is provided
                          tileUrl = 'https://tile{s}.maps.2gis.com/v2/tiles/online_hd/{z}/{x}/{y}.png?key=' + 
encodeURIComponent(twogisKey);
                          tileOptions.subdomains = '0123';
                      }
  
                      L.tileLayer(tileUrl, tileOptions).addTo(this.leafletMap);
  
                      this.leafletMarker = L.marker([lat, lng], { draggable: true }).addTo(this.leafletMap);
  
                      this.leafletMarker.on('dragend', () => {
                          const position = this.leafletMarker.getLatLng();
                          this.coordsModalLat = position.lat.toFixed(6);
                          this.coordsModalLng = position.lng.toFixed(6);
                      });
  
                      this.leafletMap.on('click', (e) => {
                          this.leafletMarker.setLatLng(e.latlng);
                          this.coordsModalLat = e.latlng.lat.toFixed(6);
                          this.coordsModalLng = e.latlng.lng.toFixed(6);
                      });
  
                      setTimeout(() => {
                          this.leafletMap.invalidateSize();
                      }, 50);
                  },
  
                  updateMarkerFromInputs() {
                      const lat = parseFloat(this.coordsModalLat);
                      const lng = parseFloat(this.coordsModalLng);
                      if (!isNaN(lat) && !isNaN(lng) && this.leafletMarker && this.leafletMap) {
                          const newLatLng = new L.LatLng(lat, lng);
                          this.leafletMarker.setLatLng(newLatLng);
                          this.leafletMap.panTo(newLatLng);
                      }
                  },
  
                  async searchHousePhotos() {
                      if (!this.coordsImageSearchQuery.trim()) {
                          this.coordsImageSearchQuery = `${this.coordsModalItem.sheet_name} 
${this.coordsModalItem.sheet_house_name}`;
                      }
                      this.coordsImageSearching = true;
                      this.coordsImageSearchResults = [];
                      try {
                          const res = await 
fetch(`/api/search-images?q=${encodeURIComponent(this.coordsImageSearchQuery)}`);
                          const data = await res.json();
                          if (data.success) {
                              this.coordsImageSearchResults = data.data;
                          }
                      } catch (e) {
                          console.error('Error searching images:', e);
                      } finally {
                          this.coordsImageSearching = false;
                      }
                  },
  
                  async uploadLocalPhoto(event) {
                      const file = event.target.files[0];
                      if (!file) return;
  
                      const reader = new FileReader();
                      reader.onload = async (e) => {
                          const base64Data = e.target.result.split(',')[1];
                          try {
                              const res = await fetch('/api/upload-photo', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                      image: base64Data,
                                      filename: file.name
                                  })
                              });
                              const data = await res.json();
                              if (data.success) {
                                  this.coordsModalPhotoUrl = data.url;
                              } else {
                                  alert('РћС€РёР±РєР° РїСЂРё Р·Р°РіСЂСѓР·РєРµ: ' + data.message);
                              }
                          } catch (err) {
                              console.error('Upload request error:', err);
                              alert('РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё С„Р°Р№Р»Р° РЅР° СЃРµСЂРІРµСЂ');
                          }
                      };
                      reader.readAsDataURL(file);
                  },
  
                  editCoordinates(item) {
                      this.coordsModalItem = item;
                      this.coordsModalDbId = null;
                      this.coordsModalIsIgnored = false;
                      this.showCoordinatesModal = true;
                      this.coordsGeocodingError = '';
                      this.manualSearchAddress = '';
                      this.coordsModalPhotoUrl = item.photo_url || '';
                      this.coordsImageSearchResults = [];
                      this.coordsImageSearching = false;
                      this.coordsImageSearchQuery = '';
  
                      if (item.latitude && item.longitude) {
                          this.coordsModalLat = Number(item.latitude);
                          this.coordsModalLng = Number(item.longitude);
                          this.coordsModalLoading = false;
                          setTimeout(() => {
                              this.initMap(parseFloat(this.coordsModalLat), parseFloat(this.coordsModalLng));
                          }, 150);
                      } else {
                          this.geocodeAndOpen(item);
                      }
                  },
  
                  async confirmAndSaveMapping() {
                      try {
                          let newIds = [...(this.coordsModalItem.db_house_ids || [])];
                          if (this.coordsModalDbId && !newIds.includes(this.coordsModalDbId)) {
                              newIds.push(this.coordsModalDbId);
                          }
  
                          const payload = {
                              sheet_house_name: this.coordsModalItem.sheet_house_name,
                              sheet_city_name: this.coordsModalItem.sheet_name, 
                              db_house_ids: newIds,
                              is_ignored: this.coordsModalIsIgnored,
                              latitude: parseFloat(this.coordsModalLat) || null,
                              longitude: parseFloat(this.coordsModalLng) || null,
                              photo_url: this.coordsModalPhotoUrl || null
                          };
  
                          const res = await fetch('/api/mappings', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload)
                          });
                          
                          if (!res.ok) throw new Error('РћС€РёР±РєР° СЃРµСЂРІРµСЂР°: ' + res.status);
  
                          const result = await res.json();
                          if (result.success) {
                              this.coordsModalItem.is_mapped = true;
                              this.coordsModalItem.is_ignored = this.coordsModalIsIgnored;
                              this.coordsModalItem.db_house_ids = newIds;
                              this.coordsModalItem.mapping_id = result.data.id;
                              this.coordsModalItem.latitude = payload.latitude;
                              this.coordsModalItem.longitude = payload.longitude;
                              this.coordsModalItem.photo_url = payload.photo_url;
                              
                              this.showCoordinatesModal = false;
                              this.updateStats();
                          } else {
                              throw new Error(result.message || 'РћС€РёР±РєР° API');
                          }
                      } catch (e) {
                          console.error('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ СЃРІСЏР·Рё:', e);
                          alert('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ СЃРІСЏР·Рё: ' + e.message);
                      }
                  },
  
                  async initGenerator() {
                      this.loading = true;
                      try {
                          await Promise.all([
                              this.fetchSectors(),
                              this.fetchPriceList()
                          ]);
                          this.generatorSelectedSectors = this.sectors
                              .filter(s => s.is_mapped && s.price > 0)
                              .map(s => `${s.sheet_name}|${s.sheet_sector_name}`);
                          await this.fetchOccupancy();
                      } catch (e) {
                          console.error('РћС€РёР±РєР° РёРЅРёС†РёР°Р»РёР·Р°С†РёРё РіРµРЅРµСЂР°С‚РѕСЂР°:', e);
                      } finally {
                          this.loading = false;
                      }
                  },
  
                  get generatorTotals() {
                      let subtotal = 0;
                      let totalHouses = 0;
                      let totalMonitors = 0;
                      const selectedSectorsData = [];
  
                      this.sectors.forEach(sector => {
                          const key = `${sector.sheet_name}|${sector.sheet_sector_name}`;
                          if (this.generatorSelectedSectors.includes(key)) {
                              const houses = this.priceListData.filter(h => 
                                  h.sheet_name === sector.sheet_name && 
                                  h.sheet_sector_name === sector.sheet_sector_name &&
                                  !this.generatorExcludedHouses.includes(`${h.sheet_name}|${h.sheet_house_name}`)
                              );
                              const houseCount = houses.length;
                              const monitorCount = houses.reduce((sum, h) => sum + (h.actual_monitors || 0), 0);
                              
                              const basePrice = sector.price || 0;
                              const adjustedPrice = Math.round((basePrice / 30) * this.generatorDays);
                              
                              selectedSectorsData.push({
                                  sheet_name: sector.sheet_name,
                                  sheet_sector_name: sector.sheet_sector_name,
                                  houseCount,
                                  monitorCount,
                                  basePrice,
                                  adjustedPrice,
                                  houses
                              });
                              
                              subtotal += adjustedPrice;
                              totalHouses += houseCount;
                              totalMonitors += monitorCount;
                          }
                      });
  
                      const discountAmount = Math.round(subtotal * (this.generatorDiscount / 100));
                      const subtotalAfterDiscount = subtotal - discountAmount;
                      const vatAmount = this.generatorIncludeVat ? Math.round(subtotalAfterDiscount * 0.16) : 0;
                      const grandTotal = subtotalAfterDiscount + vatAmount;
  
                      return {
                          sectors: selectedSectorsData,
                          subtotal,
                          discountAmount,
                          subtotalAfterDiscount,
                          vatAmount,
                          grandTotal,
                          totalHouses,
                          totalMonitors
                      };
                  },
  
                  get generatorSummaryTables() {
                      const sectors = this.generatorTotals.sectors;
                      const astanaJK = [];
                      const almatyJK = [];
                      const bcSectors = [];
                      
                      sectors.forEach(s => {
                          // Strip city/format prefix from sector name (e.g. "Astana вЂ” РљРѕРјС„РѕСЂС‚-1" -> 
"РљРѕРјС„РѕСЂС‚-1")
                          let cleanName = s.sheet_sector_name;
                          // Replace city prefix with dash/whitespace
                          cleanName = cleanName.replace(/^(Astana|Almaty|BC Astana|BC Almaty)\s*[\-вЂ”вЂ“]\s*/i, '');
                          // Also replace in case it doesn't have dash
                          cleanName = cleanName.replace(/^(Astana|Almaty|BC Astana|BC Almaty)\s+/i, '');
                          
                          const item = {
                              ...s,
                              cleanSectorName: cleanName
                          };
                          
                          if (s.sheet_name === 'Astana') {
                              astanaJK.push(item);
                          } else if (s.sheet_name === 'Almaty') {
                              almatyJK.push(item);
                          } else if (s.sheet_name.startsWith('BC')) {
                              bcSectors.push(item);
                          } else {
                              bcSectors.push(item);
                          }
                      });
                      
                      return {
                          astanaJK,
                          almatyJK,
                          bcSectors
                      };
                  },
  
                  get mapShareLink() {
                      if (!this.generatorSelectedSectors || this.generatorSelectedSectors.length === 0) return '';
                      const formatted = this.generatorSelectedSectors.map(key => {
                          return encodeURIComponent(key.replace('|', ':'));
                      }).join(',');
                      return `${window.location.origin}/map.html?s=${formatted}`;
                  },
  
                  copyMapLink() {
                      const link = this.mapShareLink;
                      if (!link) return;
                      
                      navigator.clipboard.writeText(link).then(() => {
                          this.generatorCopyLinkText = 'РЎСЃС‹Р»РєР° СЃРєРѕРїРёСЂРѕРІР°РЅР°!';
                          setTimeout(() => {
                              this.generatorCopyLinkText = 'РљРѕРїРёСЂРѕРІР°С‚СЊ СЃСЃС‹Р»РєСѓ РЅР° РєР°СЂС‚Сѓ';
                          }, 2000);
                      }).catch(err => {
                          console.error('РћС€РёР±РєР° РєРѕРїРёСЂРѕРІР°РЅРёСЏ СЃСЃС‹Р»РєРё:', err);
                          alert('РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєРѕРїРёСЂРѕРІР°С‚СЊ СЃСЃС‹Р»РєСѓ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё. 
Р’РѕС‚ РѕРЅР°:\n' + link);
                      });
                  },
  
                  get generatorCategorySummaries() {
                      const categories = [
                          { name: 'Р–Рљ Рі. РђСЃС‚Р°РЅР°', sheet: 'Astana' },
                          { name: 'Р–Рљ Рі. РђР»РјР°С‚С‹', sheet: 'Almaty' },
                          { name: 'Р‘РёР·РЅРµСЃ-С†РµРЅС‚СЂС‹ (Р‘Р¦)', isBC: true }
                      ];
                      
                      const summaries = [];
                      const selectedHouses = this.priceListData.filter(house => {
                          const key = `${house.sheet_name}|${house.sheet_sector_name}`;
                          const isSectorSelected = this.generatorSelectedSectors.includes(key);
                          const isHouseExcluded = 
this.generatorExcludedHouses.includes(`${house.sheet_name}|${house.sheet_house_name}`);
                          return isSectorSelected && !isHouseExcluded;
                      });
  
                      categories.forEach(cat => {
                          let filtered = [];
                          if (cat.isBC) {
                              filtered = selectedHouses.filter(h => h.sheet_name.startsWith('BC'));
                          } else {
                              filtered = selectedHouses.filter(h => h.sheet_name === cat.sheet);
                          }
> <script>
    // Auto-trigger print dialog once fonts + images are loaded
    window.addEventListener('load', function () {
      // Give fonts a moment to render
      setTimeout(function () {
        window.print();
        // Automatically close the child window when print dialog closes (cancels or saves)
        window.close();
      }, 600);
    });
  <\/script>
  </body>
  </html>`;
  
                      printWindow.document.open();
                      printWindow.document.write(html);
                      printWindow.document.close();
                  },
  
                  trackingLinkUrl: null,
                  isGeneratingLink: false,
                  
                  async handlePdfUpload(event) {
                      const file = event.target.files[0];
                      if (!file) return;
                      
                      this.isGeneratingLink = true;
                      this.trackingLinkUrl = null;
                      
                      try {
                          const base64 = await new Promise((resolve, reject) => {
                              const reader = new FileReader();
                              reader.onload = () => resolve(reader.result.split(',')[1]);
                              reader.onerror = error => reject(error);
                              reader.readAsDataURL(file);
                          });
                          
                          const client = this.generatorClientName.trim() ? this.generatorClientName.trim() : 'Client';
                          const filename = `Smeta_LiftMedia_${client.replace(/\s+/g, 
'_')}_${this.todayDate.replace(/\./g, '-')}.pdf`;
                          
                          const res = await fetch('/api/upload-and-track', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                  filename: filename,
                                  fileBase64: base64,
                                  client_id: client
                              })
                          });
                          
                          const data = await res.json();
                          if (data.success) {
                              this.trackingLinkUrl = data.tracking_url;
                          } else {
                              alert('РћС€РёР±РєР° РіРµРЅРµСЂР°С†РёРё СЃСЃС‹Р»РєРё: ' + data.message);
                          }
                      } catch (error) {
                          console.error(error);
                          alert('РћС€РёР±РєР° СЃРµС‚Рё РїСЂРё Р·Р°РіСЂСѓР·РєРµ PDF.');
                      } finally {
                          this.isGeneratingLink = false;
                          event.target.value = ''; // РЎР±СЂРѕСЃ РёРЅРїСѓС‚Р°
                      }
                  }
  
              }));
          });
      </script>
  </body>
  </html>


