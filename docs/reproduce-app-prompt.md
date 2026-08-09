# 🎯 Complete Reproduction Prompt — Rafa Voucher Tracker

> **What this is:** A self-contained, exhaustive specification that lets any capable LLM rebuild this app **from scratch** — pixel-faithful, behavior-faithful, bug-for-bug faithful — without ever seeing the original source. Nothing is omitted. Read this entire document before writing a single line of code.

---

## YOUR MISSION

Build a **single-file web app** (`index.html`) called **"My Rafa Voucher Tracker"** — a mobile-first voucher attendance tracker used by a shift worker. The user tracks their **shift pattern** (e.g. 2-2-2: 2 morning shifts, 2 night shifts, 2 days off), marks missed working days, sees attendance stats per 4-week "voucher period", and can switch to **any** repeating shift pattern at any time.

**Hard constraints:**
- Exactly **one file**: `index.html`. All HTML, CSS, and JavaScript inside it. No build tools, no package.json, no frameworks (Tailwind is loaded via CDN, see below).
- No backend, no network requests except the CDN `<script>`/`<link>` tags. All data persists in the browser's `localStorage` only.
- Must work offline after first load. Must work on phone, tablet, and desktop.
- Reproduce the exact element IDs, CSS class strings, text content, behaviors, animations, timings, and data formats specified below. Where an exact class string or message is given, use it verbatim.

---

## 1. TECH STACK & CONVENTIONS

| Layer | Technology |
|---|---|
| Markup | Semantic HTML5 |
| Styling | Tailwind CSS via CDN (`https://cdn.tailwindcss.com`) + a custom `<style>` block with `!important` dark-mode overrides |
| Font | Google Poppins (`300;400;600;700`) via `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap">` |
| Logic | Vanilla JavaScript (ES6), no modules |
| Persistence | Browser `localStorage` |

- `<html lang="en">`, `<meta charset="UTF-8">`, viewport `<meta name="viewport" content="width=device-width, initial-scale=1.0">`.
- `<title>My Rafa Voucher Tracker</title>`.
- The `<head>` order: Tailwind CDN script → Poppins link → the custom `<style>` block.
- Tailwind classes are used for almost everything; the custom CSS block exists ONLY for: (a) the Poppins body font, (b) dark-mode fixes where Tailwind `dark:` variants are unreliable, (c) popup/toast/tooltip animations, (d) help-button attention animation. These overrides rely on a `data-theme` attribute on `<html>` and `!important`.
- Dark mode is implemented with a `cl(light, dark)` JavaScript helper (see §8) that picks a class string at runtime based on the current theme — NOT with Tailwind `dark:` variants.

---

## 2. APP IDENTITY & BRANDING

### 2.1 Page body layout shell
```html
<body class="flex flex-col items-center min-h-screen pt-6 sm:pt-8 px-2 sm:px-4 bg-gray-100">
```
Everything is centered in a `max-w-md` column. There are THREE top-level regions outside the main card (in order): the brand header, the main card, the footer. Modals come after the footer.

### 2.2 Brand header (OUTSIDE and ABOVE the main card)
```html
<div class="w-full max-w-md mb-5 text-center brand-section">
    <div class="mb-3 flex justify-center brand-logo"> [SVG logo] </div>
    <h1 class="brand-title text-2xl sm:text-3xl font-bold tracking-tight drop-shadow-sm">My Rafa Voucher Tracker</h1>
    <p class="brand-subtitle text-[0.6rem] sm:text-xs font-medium uppercase tracking-widest mt-0.5">Attendance Tracker</p>
</div>
```
- `.brand-logo svg` and `.brand-title` / `.brand-subtitle` are styled in the CSS block (§4).

### 2.3 The logo — exact SVG (verbatim)
The logo is a single-path custom brand mark. Use it exactly:
```html
<svg width="140" height="74" viewBox="0 0 225 118" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="drop-shadow-md max-w-[120px] sm:max-w-none">
  <path d="M224.325 63.5161C224.3 63.4873 224.271 63.4585 224.242 63.4379C223.92 63.1869 218.972 65.8084 218.18 60.5325C218.147 60.3061 218.139 60.0715 218.16 59.8452C218.403 56.7504 221.075 29.2555 221.075 29.2555C221.112 28.8727 221.141 28.4982 221.178 28.132L221.71 22.4486C221.751 22.0288 221.405 21.6708 220.98 21.6996C217.747 21.9218 205.706 22.7531 202.51 22.9466C202.056 22.9754 201.697 23.3252 201.656 23.7779L201.586 24.2059C201.541 24.7244 200.98 25.0331 200.522 24.7861C198.65 23.7943 193.928 22.1523 185.524 24.3993C185.095 24.5145 184.67 24.6421 184.25 24.7738C182.827 25.1853 176.885 26.8973 176.885 26.8973C172.151 28.2637 166.637 27.0825 162.955 23.7161C159.656 20.6996 158.146 15.4812 159.285 11.1724C159.845 9.03653 161.136 7.12287 163.017 5.92941C164.629 4.90879 167.037 4.25856 168.324 6.10637C168.485 6.33272 168.608 6.59199 168.707 6.85126C169.285 8.32457 168.901 9.99542 168.332 11.4687C167.763 12.9462 167.004 14.3824 166.827 15.9545C166.501 18.8394 168.365 21.7613 171.029 22.9383C173.689 24.1153 176.943 23.6215 179.318 21.9383C181.693 20.2551 183.194 17.5019 183.631 14.6294C184.844 6.67429 177.066 0.727547 169.549 0.147277C160.505 -0.548225 150.847 1.12674 143.755 7.16402C138.134 11.9461 137.181 17.7776 136.167 24.6174C135.359 30.1032 135.037 35.6426 134.587 41.1654C133.825 50.5773 133.049 56.059 132.274 65.4668L132.163 66.7508C132.006 68.5904 130.27 69.9691 128.468 69.5534C127.511 69.3312 126.662 68.6316 126.41 66.9443C126.377 66.7179 126.369 66.4833 126.385 66.257C126.629 63.1622 129.301 35.6673 129.301 35.6673C129.338 35.2845 129.367 34.91 129.404 34.5479L129.936 28.8645C129.977 28.4447 129.631 28.0867 129.206 28.1155C125.973 28.3377 113.931 29.169 110.736 29.3625C110.282 29.3913 109.923 29.7411 109.882 30.1938L109.812 30.6218C109.766 31.1403 109.206 31.449 108.748 31.2021C106.876 30.2102 102.154 28.5682 93.7498 30.8152C83.0816 33.6672 75.4032 42.1943 72.1908 52.5363C70.599 57.6558 70.2815 63.8824 71.8732 69.3435C71.9763 69.7016 71.898 70.0843 71.6464 70.3642C71.2588 70.8004 70.8835 71.1749 70.4753 71.4383C69.8691 71.8334 69.1969 71.9815 68.3062 71.7305C66.5 71.2119 65.1268 69.4876 64.0958 68.0266C62.2443 65.3969 57.6421 57.7134 56.0998 54.8285C55.8607 54.38 56.1658 53.845 56.6731 53.8038C66.133 53.063 71.8897 42.4165 71.8897 33.2597C71.8897 24.103 62.9494 19.7654 56.4174 19.4238C49.8853 19.0822 34.8336 20.251 34.8336 20.251L9.20444 22.1893L3.37756 88.2702L29.0109 86.3319L31.5264 57.7793C31.6748 56.0755 33.5717 55.6516 34.314 57.1949C36.9161 62.6025 39.4646 68.0348 42.2234 73.3643C44.8544 78.4427 47.242 83.4223 52.8215 85.7722C55.4029 86.8587 58.2607 87.2784 61.0401 86.8587C67.667 85.8627 72.0794 80.5909 73.1145 74.3725C73.1846 73.9528 73.7413 73.8581 73.9599 74.2244C74.5619 75.2285 75.2547 76.1751 76.0465 77.0393C80.7558 82.1877 87.5971 83.6157 94.257 82.126C99.6674 80.916 102.979 78.953 105.399 76.3068C105.816 75.8541 106.538 75.8829 106.942 76.3479C108.583 78.2369 111.21 80.3357 115.61 80.7761C116.002 80.8173 118.406 81.0889 119.944 80.9325C119.977 80.9325 120.014 80.9243 120.047 80.9201C120.36 80.8872 120.67 80.8419 120.979 80.7884C121.28 80.7349 121.581 80.6732 121.882 80.6032C122.175 80.5333 122.464 80.4551 122.752 80.3646C123.037 80.2781 123.317 80.1835 123.593 80.0765C123.866 79.9736 124.138 79.8625 124.402 79.7431C124.666 79.6238 124.925 79.5003 125.177 79.3686C125.429 79.2369 125.676 79.097 125.923 78.953C126.167 78.8089 126.402 78.6567 126.637 78.5003C126.868 78.3439 127.095 78.1834 127.313 78.0147C127.532 77.8459 127.746 77.6772 127.956 77.4961C128.163 77.3192 128.369 77.1381 128.567 76.9488C128.765 76.7636 128.954 76.5743 129.14 76.3767C129.325 76.1833 129.503 75.9858 129.676 75.7841C129.849 75.5866 130.014 75.3808 130.175 75.175C130.336 74.9693 130.488 74.7594 130.637 74.5495C130.785 74.3396 130.925 74.1256 131.062 73.9116C131.198 73.6976 131.326 73.4836 131.449 73.2614C131.54 73.0968 131.627 72.928 131.713 72.7593C131.363 75.4302 130.855 78.0887 129.911 80.6115C129.255 82.3688 128.381 84.0561 127.189 85.5129C125.647 87.4019 124.245 87.9986 121.948 88.6735C121.507 88.8052 121.012 88.9698 121.004 89.5954C121 89.8835 121.127 90.1674 121.325 90.3732C125.016 94.2005 132.835 94.0853 137.713 93.0894C143.214 91.9659 148.237 88.9287 151.548 84.3688C152.856 82.5704 154.241 79.9283 155.12 76.2739C156.748 69.5081 158.513 42.2642 159.004 36.8237C159.037 36.4821 159.334 36.1693 159.676 36.1364C161.19 35.9841 163.903 37.2023 168.031 35.3216C168.604 35.0623 169.161 35.7084 168.798 36.2228C166.691 39.1983 165.05 42.5441 163.944 46.108C161.52 53.919 162.048 64.3022 167.813 70.607C172.522 75.7553 179.363 77.1834 186.023 75.6895C191.438 74.4795 194.753 72.5124 197.174 69.8621C197.582 69.4135 198.279 69.4176 198.675 69.8785C200.316 71.7799 202.947 73.8993 207.372 74.3437C207.764 74.3849 210.168 74.6565 211.706 74.5001C211.739 74.5001 211.776 74.4919 211.809 74.4878C212.118 74.4548 212.432 74.4096 212.741 74.3602C213.042 74.3067 213.343 74.245 213.64 74.175C213.933 74.105 214.225 74.0268 214.51 73.9363C214.795 73.8499 215.075 73.7552 215.351 73.6482C215.623 73.5453 215.896 73.4342 216.16 73.3149C216.423 73.1955 216.683 73.0721 216.935 72.9404C217.186 72.8087 217.434 72.6688 217.681 72.5247C217.92 72.3807 218.16 72.2284 218.395 72.072C218.626 71.9157 218.852 71.7551 219.071 71.5864C219.289 71.4218 219.504 71.249 219.714 71.0679C219.92 70.8909 220.127 70.7098 220.325 70.5205C220.522 70.3353 220.712 70.146 220.898 69.9485C221.083 69.7551 221.261 69.5575 221.434 69.3559C221.607 69.1583 221.772 68.9526 221.933 68.7468C222.094 68.541 222.246 68.3311 222.395 68.1213C222.543 67.9114 222.683 67.6974 222.819 67.4834C222.955 67.2694 223.083 67.0554 223.207 66.8331C223.327 66.6191 223.446 66.3969 223.553 66.1788C223.661 65.9607 223.764 65.7426 223.863 65.5203C223.958 65.3022 224.048 65.0841 224.131 64.8577C224.271 64.4791 224.621 63.8618 224.304 63.4956L224.325 63.5161ZM178.072 7.16402C180.316 9.1353 181.891 11.4111 180.155 15.6952C177.837 21.4115 172.493 20.1893 172.493 20.1893C172.493 20.1893 177.652 14.5347 178.072 7.16402ZM47.5925 44.4742C44.5451 50.6514 37.4563 50.8901 34.8212 50.7543C34.8047 50.7543 34.7841 50.7543 34.7676 50.7543C34.0996 50.7131 33.015 50.6391 32.1655 50.5568L34.2192 27.276C34.2975 26.3665 34.9986 25.6298 35.9017 25.5063C38.7141 25.1195 41.9182 25.0331 44.6275 26.0496C47.741 27.2183 49.3039 30.2884 49.774 33.4202C50.3431 37.2188 49.2709 41.0831 47.5967 44.4742H47.5925ZM108.764 41.8321L106.83 66.4093C106.546 70.0185 103.387 72.714 99.7705 72.4301C96.1539 72.1461 93.4529 68.9937 93.7374 65.3845L95.6715 40.8074C95.956 37.1982 99.1148 34.5026 102.731 34.7866C106.348 35.0705 109.049 38.2229 108.764 41.8321ZM200.535 35.4121L198.601 59.9892C198.316 63.5984 195.157 66.294 191.541 66.0101C187.924 65.7261 185.223 62.5737 185.508 58.9645L187.442 34.3874C187.726 30.7782 190.885 28.0826 194.502 28.3665C198.118 28.6505 200.819 31.8029 200.535 35.4121Z"/>
</svg>
```

### 2.4 Footer (OUTSIDE and BELOW the main card)
```html
<footer id="app-footer" class="w-full max-w-md mt-6 pb-8 text-center text-[0.65rem] text-gray-400 leading-relaxed">
  <p>App Developed By <span class="font-semibold text-indigo-500">Dammie Optimus Solutions</span>. &copy; <span id="copyright-year"></span> All rights reserved. <span id="app-version" class="opacity-50">v1.4.0</span></p>
  <p class="mt-1">Need help? Chat with us on WhatsApp:
    <a href="https://wa.me/2347053331253" target="_blank" rel="noopener" class="inline-flex items-center font-semibold text-indigo-500 hover:text-indigo-600 transition-colors duration-300" aria-label="Chat with us on WhatsApp">
      [WhatsApp SVG icon, inline, 12x14px, `class="w-3.5 h-3.5 mr-1"`, standard WhatsApp chat-bubble path] 0705 333 1253
    </a>
  </p>
</footer>
```
JavaScript sets `#copyright-year` to the current year and `#app-version` to `'v' + APP_VERSION` on load (overwriting the static `v1.4.0`).

---

## 3. MAIN CARD — FULL STRUCTURE (top to bottom)

The main card wraps the dashboard, stats row, calendar, and data-management sections:
```html
<div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
```

### 3.1 Dashboard header (gradient hero)
```html
<div class="relative bg-gradient-to-br from-indigo-500 to-purple-600 p-5 sm:p-8 text-white text-center rounded-b-[2.5rem] shadow-lg overflow-hidden">
```
Inside, in this order:
1. **Theme toggle** (absolute `top-4 left-4`, `z-10`):
   - `#theme-toggle`: pill button `w-14 h-7 rounded-full flex items-center px-1 bg-white/20 backdrop-blur-sm border border-white/15 hover:bg-white/30 transition-all duration-300`, `title="Toggle theme"`, `aria-label="Toggle dark mode"`.
   - Inside it: `#theme-toggle-knob` (`w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center text-xs transition-all duration-300`) containing `#theme-toggle-icon` (initial `☀️`).
2. **Help button** (absolute `top-4 right-4`, `z-10`, inside a `<div class="absolute top-4 right-4 z-10">`):
   - `#help-btn`: `w-8 h-8 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-sm border border-white/15 hover:bg-white/30 hover:scale-110 transition-all duration-300 text-white font-bold text-sm shadow-sm`, `title="How to use this app"`, `aria-label="Open help guide"`, text `?`.
   - `#help-tooltip`: `<span>` with classes `help-tooltip hidden absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-white text-indigo-600 text-xs font-bold px-3 py-2 rounded-xl shadow-lg pointer-events-none`, text **"Tap ? to learn how to use this app"**.
3. `Voucher Period` — `<p class="text-sm font-semibold uppercase tracking-wider opacity-80 mb-1">Voucher Period</p>`
4. Period nav row — `<div class="flex items-center justify-center gap-3">` containing:
   - `#prev-period-btn`: `text-white/60 hover:text-white transition text-2xl leading-none font-bold`, `title="Previous period"`, `aria-label="Previous period"`, content `&larr;`.
   - `#voucher-date-range`: `<h2 class="text-base sm:text-xl font-bold">July 20 - August 19</h2>` (updated by JS; initial text is a placeholder like that).
   - `#next-period-btn`: same classes as prev (with `&rarr;`), `title="Next period"`, `aria-label="Next period"`.
5. `#period-label` — `<p class="text-xs font-medium uppercase tracking-wider mt-1 opacity-60" tabindex="0" role="button" aria-label="Tap for period summary">Current Period</p>`
6. Big counter — `<div class="flex justify-center items-baseline space-x-2 mt-5">` with `#days-present-count` (`text-5xl sm:text-7xl font-bold tracking-tight`, initial `--`) and `<span class="text-sm sm:text-lg font-medium opacity-90">Days</span>`.
7. `<p class="mt-2 text-indigo-100 font-medium tracking-wide">Total Days Present</p>`
8. `#attendance-pct` — `<p class="text-xs text-indigo-200/70 mt-0.5"></p>` (e.g. `86% attendance`).
9. `#streak-display` — `<p class="text-xs text-indigo-200/70 mt-0.5"></p>` (e.g. `🔥 4-day streak`).

### 3.2 Stats row
```html
<div class="flex justify-around items-center p-4 sm:p-6 border-b border-gray-100 bg-gray-50">
  <div class="text-center">
    <p class="text-2xl sm:text-3xl font-bold text-red-500" id="days-missed-count">--</p>
    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Missed</p>
  </div>
  <div class="w-px h-10 bg-gray-200"></div>
  <div class="text-center">
    <p class="text-2xl sm:text-3xl font-bold text-gray-400" id="days-off-count">--</p>
    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Days Off</p>
  </div>
</div>
```

### 3.3 Calendar section
```html
<div class="p-3 sm:p-6">
  <div class="flex justify-between items-center mb-3 gap-2">
    <h3 class="text-lg font-bold text-gray-800" id="calendar-heading">Attendance Grid</h3>
    <div class="flex gap-2 shrink-0">
      <button id="pattern-btn" class="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-2 rounded-full hover:bg-purple-100 transition shadow-sm border border-purple-100" aria-label="Change shift pattern" title="Change shift pattern">Shift Pattern</button>
      <button id="set-cycle-btn" class="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-full hover:bg-indigo-100 transition shadow-sm border border-indigo-100" aria-label="Set cycle start date">Set Cycle Start</button>
    </div>
  </div>
  <div id="calendar-grid" class="grid grid-cols-7 gap-[2px] sm:gap-1" role="grid" aria-label="Attendance calendar"></div>
</div>
```
The grid content is generated entirely by JS (§8 `renderCalendar`).

### 3.4 Export / Import / Reset section
```html
<div class="p-3 sm:p-5 border-t border-gray-100 bg-gray-50 flex flex-col items-center gap-3">
  <div class="flex gap-2 justify-center">
    <button id="export-btn" class="text-xs font-semibold text-indigo-600 bg-white px-4 py-2 rounded-full hover:bg-indigo-50 transition shadow-sm border border-indigo-200" aria-label="Export data as JSON">Export JSON</button>
    <button id="export-csv-btn" class="text-xs font-semibold text-indigo-600 bg-white px-4 py-2 rounded-full hover:bg-indigo-50 transition shadow-sm border border-indigo-200" aria-label="Export data as CSV">Export CSV</button>
    <button id="import-btn" class="text-xs font-semibold text-indigo-600 bg-white px-4 py-2 rounded-full hover:bg-indigo-50 transition shadow-sm border border-indigo-200" aria-label="Import data from file">Import Data</button>
    <button id="reset-btn" class="text-xs font-semibold text-red-500 bg-white px-4 py-2 rounded-full hover:bg-red-50 transition shadow-sm border border-red-200" aria-label="Reset all attendance data">Reset All</button>
  </div>
  <p class="text-[0.6rem] text-gray-400 text-center">Your data stays on your device. Use Export to back it up.</p>
  <input type="file" id="import-file-input" accept=".json" class="hidden">
</div>
```

---

## 4. CUSTOM CSS BLOCK (verbatim — reproduce exactly)

```css
body {
    font-family: 'Poppins', sans-serif;
}

[data-theme="dark"] body { background-color: #030712 !important; }
[data-theme="dark"] .max-w-md.rounded-3xl.shadow-2xl { background-color: #111827 !important; border-color: #1f2937 !important; }
[data-theme="dark"] .from-indigo-500 { background-image: linear-gradient(to bottom right, #1e1b4b, #2e1065) !important; }
[data-theme="dark"] .flex.justify-around.items-center.p-6.border-b { background-color: rgba(31,41,55,0.5) !important; border-color: #1f2937 !important; }
[data-theme="dark"] .w-px.h-10 { background-color: #374151 !important; }
[data-theme="dark"] .text-lg.font-bold.text-gray-800 { color: #e5e7eb !important; }
[data-theme="dark"] .text-\[0\.6rem\].text-center { color: #6b7280 !important; }
[data-theme="dark"] .text-indigo-100 { color: #c7d2fe !important; }
[data-theme="dark"] #days-missed-count { color: #f87171 !important; }
[data-theme="dark"] #days-off-count { color: #6b7280 !important; }
[data-theme="dark"] .text-xs.font-semibold.uppercase.tracking-wide { color: #9ca3af !important; }
[data-theme="dark"] .p-5.border-t { background-color: rgba(31,41,55,0.5) !important; border-color: #1f2937 !important; }
[data-theme="dark"] #set-cycle-btn { background-color: rgba(67,56,202,0.2) !important; color: #818cf8 !important; border-color: #3730a3 !important; }
[data-theme="dark"] #set-cycle-btn:hover { background-color: rgba(67,56,202,0.35) !important; }
[data-theme="dark"] #export-btn, [data-theme="dark"] #import-btn { background-color: #1f2937 !important; color: #818cf8 !important; border-color: #3730a3 !important; }
[data-theme="dark"] #export-btn:hover, [data-theme="dark"] #import-btn:hover { background-color: #374151 !important; }
[data-theme="dark"] #reset-btn { background-color: #1f2937 !important; color: #f87171 !important; border-color: #991b1b !important; }
[data-theme="dark"] #reset-btn:hover { background-color: #374151 !important; }

[data-theme="dark"] .bg-amber-900\/60 { background-color: rgba(120, 72, 0, 0.6) !important; }
[data-theme="dark"] .text-amber-300 { color: #fcd34d !important; }
[data-theme="dark"] .border-amber-600 { border-color: #d97706 !important; }
[data-theme="dark"] .bg-indigo-900\/60 { background-color: rgba(49, 46, 129, 0.6) !important; }
[data-theme="dark"] .text-indigo-300 { color: #a5b4fc !important; }
[data-theme="dark"] .border-indigo-600 { border-color: #4f46e5 !important; }
[data-theme="dark"] .bg-gray-700 { background-color: #374151 !important; }
[data-theme="dark"] .border-gray-600 { border-color: #4b5563 !important; }
[data-theme="dark"] .bg-gray-800 { background-color: #1f2937 !important; }
[data-theme="dark"] .border-gray-700 { border-color: #374151 !important; }
[data-theme="dark"] .text-gray-600 { color: #6b7280 !important; }
[data-theme="dark"] .text-gray-500 { color: #6b7280 !important; }
[data-theme="dark"] .bg-gray-800\/30 { background-color: rgba(31, 41, 55, 0.3) !important; }
[data-theme="dark"] #app-footer { color: #6b7280 !important; }
[data-theme="dark"] #app-footer a { color: #818cf8 !important; }
[data-theme="dark"] #app-footer a:hover { color: #a5b4fc !important; }
.brand-logo svg { color: #4f46e5; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.08)); }
[data-theme="dark"] .brand-logo svg { color: #ffffff !important; }
.brand-title { color: #1f2937; }
[data-theme="dark"] .brand-title { color: #e5e7eb !important; }
.brand-subtitle { color: #9ca3af; }
[data-theme="dark"] .brand-subtitle { color: #6b7280 !important; }
/* Modal */
#help-modal { scrollbar-width: thin; }
#help-modal .max-w-lg { animation: modalPop 0.2s ease-out; }
@keyframes modalPop { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.missed-popup {
    position: fixed;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none; z-index: 100;
    font-weight: 900; font-size: 1.4rem;
    color: #ef4444; letter-spacing: 0.1em;
    -webkit-text-stroke: 2px white;
    paint-order: stroke fill;
    text-shadow: 0 0 14px rgba(255,255,255,0.5);
    transform-origin: center center;
    animation: missedZoomFade 1s ease-out forwards;
}
@keyframes missedZoomFade {
    0%   { opacity: 0; transform: scale(0.2); }
    15%  { opacity: 1; transform: scale(1.3); }
    35%  { transform: scale(1); }
    65%  { opacity: 1; }
    100% { opacity: 0; transform: scale(1.8); }
}
.anchor-popup, .unmissed-popup {
    position: fixed; display: flex; align-items: center; justify-content: center;
    pointer-events: none; z-index: 100;
    font-weight: 900; font-size: 1rem; letter-spacing: 0.05em;
    -webkit-text-stroke: 2px white; paint-order: stroke fill;
    text-shadow: 0 0 14px rgba(255,255,255,0.5);
    transform-origin: center center;
    animation: anchorZoomFade 1s ease-out forwards;
}
.anchor-popup { color: #22c55e; }
.unmissed-popup { color: #22c55e; }
@keyframes anchorZoomFade {
    0%   { opacity: 0; transform: scale(0.3); }
    15%  { opacity: 1; transform: scale(1.3); }
    35%  { transform: scale(1); }
    65%  { opacity: 1; }
    100% { opacity: 0; transform: scale(1.6); }
}
/* Help button attention */
.help-attention {
    animation: helpPulse 3.5s ease-in-out infinite;
}
@keyframes helpPulse {
    0%, 78%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); transform: scale(1); }
    82%  { box-shadow: 0 0 0 9px rgba(255,255,255,0.55); transform: scale(1.18); }
    92%  { box-shadow: 0 0 0 0 rgba(255,255,255,0); transform: scale(1); }
}
.help-tooltip {
    animation: tooltipIn 0.4s ease-out, tooltipOut 0.5s ease-in 7.5s forwards;
}
@keyframes tooltipIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
@keyframes tooltipOut { to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
    .help-attention, .help-tooltip { animation: none !important; }
    .help-tooltip { opacity: 0; }
}
[data-theme="dark"] #help-modal .max-w-lg { background-color: #111827 !important; border: 1px solid #1f2937; }
[data-theme="dark"] #help-modal .px-6.py-5 { background-color: #111827 !important; }
[data-theme="dark"] #help-modal .px-6.py-4.bg-gray-50 { background-color: rgba(31,41,55,0.5) !important; border-color: #1f2937 !important; }
[data-theme="dark"] #help-modal .text-gray-700 { color: #d1d5db !important; }
[data-theme="dark"] #help-modal .text-gray-600 { color: #9ca3af !important; }
[data-theme="dark"] #help-modal hr { border-color: #1f2937 !important; }
[data-theme="dark"] #help-modal .text-amber-800 { color: #fcd34d !important; }
[data-theme="dark"] #help-modal .text-indigo-800 { color: #a5b4fc !important; }
[data-theme="dark"] #help-modal .text-gray-500 { color: #6b7280 !important; }
[data-theme="dark"] #help-modal .text-red-700 { color: #fca5a5 !important; }
```

**Fidelity note:** The dark-mode CSS overrides target only the **help modal** (`#help-modal`). The **pattern editor modal** does NOT have dark-mode styling (it stays white in dark mode) — reproduce this as-is.

---

## 5. MODALS

Both modals share this structure (use the same classes for both):
```html
<div id="help-modal" class="hidden fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-16 px-3 sm:px-4 pb-8 overflow-y-auto" role="dialog" aria-modal="true" aria-label="...">
  <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" id="help-backdrop"></div>
  <div class="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10">
```
Both have a gradient header, a scrollable content area (`max-h-[70vh] overflow-y-auto`), and a footer. Both lock `document.body.style.overflow = 'hidden'` while open and restore `''` on close.

### 5.1 Help modal (`#help-modal`, `#help-backdrop`)
- Header: gradient `from-indigo-500 to-purple-600`, `px-6 py-5 text-white`, title **"How to Use This App"**, subtitle **"Everything you need to know in one place"**, and a close `#help-close` button (round, `bg-white/20 hover:bg-white/30`, `&times;`).
- Content: `px-6 py-5 space-y-5 text-sm text-gray-700`, sections separated by `<hr class="border-gray-100">`. Full section content in §10.
- Footer: `px-6 py-4 bg-gray-50 border-t border-gray-100 text-center` with `#help-got-it` button: `bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-2.5 rounded-full transition shadow-md`, text **"Got It!"**.

### 5.2 Pattern editor modal (`#pattern-modal`, `#pattern-backdrop`)
- Header: gradient `from-purple-500 to-indigo-600`, `px-6 py-5 text-white`, title **"Shift Pattern"**, subtitle **"Works with any schedule &mdash; 2-2-2, 3M-4OFF, 1-1-1, anything"**, close `#pattern-close`.
- Content: `px-6 py-5 space-y-5 text-sm text-gray-700`, with `<hr class="border-gray-100">` dividers, four blocks:
  1. **Start Date** — `<h3 class="font-bold text-indigo-600 text-base mb-1">Start Date</h3>`, explanatory text "The new pattern applies **from this date onward**. Days before keep their old pattern &mdash; your history is never rewritten.", then `<input type="date" id="pattern-start-date" class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" aria-label="Pattern start date">`.
  2. **Presets** — `<h3 class="font-bold text-indigo-600 text-base mb-2">Presets</h3>`, `<div id="pattern-presets" class="flex flex-wrap gap-2"></div>` (populated by JS).
  3. **Custom Pattern** — heading **"Custom Pattern"**, `<div id="pattern-chips" class="flex flex-wrap gap-1.5 items-center min-h-[2.75rem] border-2 border-dashed border-gray-300 rounded-xl p-2"></div>`, then a button row (`flex flex-wrap gap-2 mt-3`):
     - `#chip-add-m`: `text-xs font-bold text-amber-800 bg-amber-200 border-2 border-amber-400 px-4 py-2 rounded-full hover:brightness-105 transition shadow-sm` → **+ M**
     - `#chip-add-n`: `text-xs font-bold text-indigo-800 bg-indigo-200 border-2 border-indigo-400 px-4 py-2 rounded-full hover:brightness-105 transition shadow-sm` → **+ N**
     - `#chip-add-off`: `text-xs font-bold text-gray-500 bg-gray-100 border-2 border-gray-300 px-4 py-2 rounded-full hover:brightness-105 transition shadow-sm` → **+ OFF**
     - `#chip-delete`: `text-xs font-semibold text-red-600 bg-white border border-red-200 px-3 py-2 rounded-full hover:bg-red-50 transition shadow-sm` → **Delete last**
     - `#chip-clear`: `text-xs font-semibold text-gray-500 bg-white border border-gray-300 px-3 py-2 rounded-full hover:bg-gray-50 transition shadow-sm` → **Clear**
  4. **Preview** — heading **"Preview (14 days from start date)"**, `<div id="pattern-preview" class="flex flex-wrap gap-1.5"></div>` (populated by JS).
- Footer: `px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between`:
  - `#pattern-cancel`: `text-sm font-semibold text-gray-500 px-5 py-2 rounded-full hover:bg-gray-100 transition` → **Cancel**
  - `#pattern-save`: `bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-2.5 rounded-full transition shadow-md` → **Save Pattern**

---

## 6. STATE & PERSISTENCE

### 6.1 Module-level state variables
```js
let savedAnchorDate = localStorage.getItem('anchorDate') || null;      // 'YYYY-MM-DD' or null
let missedDays = JSON.parse(localStorage.getItem('missedDays')) || []; // array of 'YYYY-MM-DD' strings
let isSettingCycle = false;                                            // true while waiting for the user to pick an anchor day
let periodOffset = 0;                                                  // 0 = current period, -1 = previous, 1 = next
let shiftSegments = JSON.parse(localStorage.getItem('shiftSegments') || 'null'); // see 6.2
let patternEditorPattern = [];                                         // working copy of labels in the editor, e.g. ['M','M','N','N','OFF','OFF']
```

### 6.2 `shiftSegments` — the segment model (core concept)
```js
// shape: [ { startDate: 'YYYY-MM-DD', pattern: [ {label, work, night, color}, ... ] }, ... ]
```
- The **first segment's `startDate` is the anchor date** (cycle start).
- Each pattern entry: `{ label: 'M'|'N'|'OFF', work: boolean, night: boolean, color: 'amber'|'indigo'|'gray' }`.
- Loading/migration logic (exact):
```js
let shiftSegments = JSON.parse(localStorage.getItem('shiftSegments') || 'null');
if (!Array.isArray(shiftSegments) || !shiftSegments.length) {
    shiftSegments = savedAnchorDate ? [{ startDate: savedAnchorDate, pattern: pattern222() }] : [];
}
shiftSegments.sort((a, b) => a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0);
savedAnchorDate = shiftSegments.length ? shiftSegments[0].startDate : savedAnchorDate;
```

### 6.3 localStorage keys
| Key | Value | Written when |
|---|---|---|
| `anchorDate` | `'YYYY-MM-DD'` or `''` | setting anchor, importing, saving pattern, reset |
| `missedDays` | JSON array of date strings | marking/unmarking missed, importing, reset |
| `shiftSegments` | JSON array of segments | setting anchor, saving pattern, importing, reset |
| `theme` | `'light'` or `'dark'` | theme toggle, init, import |
| `helpIntroSeen` | `'1'` | first time help is opened |

---

## 7. CONSTANTS (verbatim)

```js
const APP_VERSION = '1.4.0';

const SHIFT_COLORS = {
    amber:  { light: 'bg-amber-200 text-amber-800 border-amber-400 shadow-sm',      dark: 'bg-amber-900/60 text-amber-300 border-amber-600 shadow-sm' },
    indigo: { light: 'bg-indigo-200 text-indigo-800 border-indigo-400 shadow-sm',   dark: 'bg-indigo-900/60 text-indigo-300 border-indigo-600 shadow-sm' },
    gray:   { light: 'bg-gray-100 text-gray-500 border-gray-300',                   dark: 'bg-gray-700 text-gray-400 border-gray-600' }
};

const CHIP_CLS = {
    M:   'bg-amber-200 text-amber-800 border-amber-400',
    N:   'bg-indigo-200 text-indigo-800 border-indigo-400',
    OFF: 'bg-gray-100 text-gray-500 border-gray-300'
};

function makeShift(label) {
    if (label === 'M') return { label: 'M', work: true, night: false, color: 'amber' };
    if (label === 'N') return { label: 'N', work: true, night: true, color: 'indigo' };
    return { label: 'OFF', work: false, night: false, color: 'gray' };
}

function pattern222() {
    return ['M', 'M', 'N', 'N', 'OFF', 'OFF'].map(makeShift);
}

const PATTERN_PRESETS = [
    { name: '2-2-2',      pattern: ['M','M','N','N','OFF','OFF'] },
    { name: '3-3-3',      pattern: ['M','M','M','N','N','N','OFF','OFF','OFF'] },
    { name: '1-1-1',      pattern: ['M','N','OFF'] },
    { name: '3M / 4OFF',  pattern: ['M','M','M','OFF','OFF','OFF','OFF'] },
    { name: '4M / 4OFF',  pattern: ['M','M','M','M','OFF','OFF','OFF','OFF'] },
    { name: '5M / 2OFF',  pattern: ['M','M','M','M','M','OFF','OFF'] },
    { name: '6M / 1OFF',  pattern: ['M','M','M','M','M','M','OFF'] },
    { name: '4M / 2OFF',  pattern: ['M','M','M','M','OFF','OFF'] },
    { name: '2M / 1OFF',  pattern: ['M','M','OFF'] }
];

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
```

---

## 8. CORE LOGIC (exact algorithms)

### 8.1 Theme
```js
function applyTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const knob = document.getElementById('theme-toggle-knob');
    const icon = document.getElementById('theme-toggle-icon');
    if (knob && icon) {
        knob.style.transform = isDark ? 'translateX(28px)' : 'translateX(0)';
        icon.textContent = isDark ? '🌙' : '☀️';
    }
}
// Init: saved 'theme' wins; else prefers-color-scheme (dark mode = dark, light = light).
// Toggle: flip current, re-apply.
function isDarkMode() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
function cl(light, dark) { return isDarkMode() ? dark : light; }
```

### 8.2 Voucher period math
```js
function getVoucherPeriod(offset = 0) {
    const today = new Date();
    let baseMonth = today.getMonth();
    let baseYear = today.getFullYear();
    if (today.getDate() < 20) {           // before the 20th → previous month's 20th starts the period
        baseMonth -= 1;
        if (baseMonth < 0) { baseMonth = 11; baseYear -= 1; }
    }
    baseMonth += offset;
    baseYear += Math.floor(baseMonth / 12);
    baseMonth = ((baseMonth % 12) + 12) % 12;
    const startDate = new Date(baseYear, baseMonth, 20);
    let endMonth = baseMonth + 1;
    let endYear = baseYear;
    if (endMonth > 11) { endMonth = 0; endYear += 1; }
    const endDate = new Date(endYear, endMonth, 19);
    return { startDate, endDate };
}

function getPeriodLabel(offset) {
    if (offset === 0) return 'Current Period';
    if (offset === -1) return 'Previous Period';
    if (offset === 1) return 'Next Period';
    return offset < 0 ? `${Math.abs(offset)} Periods Ago` : `${offset} Periods Ahead`;
}

function updateDashboardHeader(startDate, endDate) {
    const options = { month: 'short', day: 'numeric' };
    document.getElementById('voucher-date-range').innerText =
        `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
    document.getElementById('period-label').innerText = getPeriodLabel(periodOffset);
}
```

### 8.3 Shift engine — the heart of the app
```js
function getShiftInfo(targetDate) {
    if (!savedAnchorDate || !shiftSegments.length) return null;

    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    const targetKey = `${y}-${m}-${d}`;

    // "Rulebook" model: the most recent segment whose startDate is on/before the target wins.
    let seg = null;
    for (let i = shiftSegments.length - 1; i >= 0; i--) {
        if (shiftSegments[i].startDate <= targetKey) { seg = shiftSegments[i]; break; }
    }
    // Dates before the first segment wrap backward around the first pattern.
    if (!seg) seg = shiftSegments[0];

    const sp = seg.startDate.split('-');
    const start = new Date(Number(sp[0]), Number(sp[1]) - 1, Number(sp[2]));
    const d1 = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const d2 = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const diffDays = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
    const len = seg.pattern.length;
    if (!len) return null;
    const index = ((diffDays % len) + len) % len;     // handles any pattern length + negative diff
    const entry = seg.pattern[index];

    const color = SHIFT_COLORS[entry.color];
    return {
        label: entry.label,
        work: !!entry.work,
        night: !!entry.night,
        color: color ? cl(color.light, color.dark) : ''
    };
}
```

### 8.4 Streak calculation
```js
function calcStreak(startDate, endDate) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let streak = 0;
    let d = new Date(endDate);
    while (d >= startDate) {
        if (d > today) { d.setDate(d.getDate() - 1); continue; }   // skip future days
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const ds = `${y}-${m}-${dd}`;
        const shift = getShiftInfo(d);
        if (!shift || !shift.work) { d.setDate(d.getDate() - 1); continue; }  // skip OFF
        if (missedDays.includes(ds)) break;                                    // streak broken
        streak++;
        d.setDate(d.getDate() - 1);
    }
    return streak;
}
```

### 8.5 Calendar rendering (`renderCalendar`)
Clears `#calendar-grid` (`innerHTML = ''`), then:
1. `updateDashboardHeader(startDate, endDate)`.
2. Set `#calendar-heading`: if an anchor exists → `` `${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · Attendance` `` else `'Attendance Grid'`.
3. Weekday header row: 7 `<div>`s with `WEEKDAY_LABELS[i]`, classes `text-center text-[0.5rem] sm:text-[0.65rem] font-bold text-gray-400 uppercase tracking-wider pb-1` (light) / `...text-gray-500...` (dark) via `cl()`.
4. **Friendly banner** — only when `!savedAnchorDate && !isSettingCycle`: append a `<div id="friendly-banner">` with `col-span-7 flex flex-col items-center justify-center py-10 text-gray-400 text-sm`, `innerHTML = '<span class="text-3xl mb-2">📋</span><span>Tap <strong>"Set Cycle Start"</strong> above,<br>then tap <strong>any day</strong> to begin!</span>'`. Also set all four stat displays to `--`/empty. **Important: still fall through and render the day buttons below the banner.**
5. Leading empty cells: `startDow = startDate.getDay()`; append that many empty `<div>`s (no classes).
6. Day loop from `startDate` through `endDate` (inclusive). For each day:
   - `fullDateString` = `YYYY-MM-DD`.
   - `shiftInfo = getShiftInfo(currentDate)`; `isFuture = currentDate > today` (today normalized to midnight).
   - Each day is a `<button type="button">` with `data-date="YYYY-MM-DD"` and **base classes** (verbatim):
     ```
     flex flex-col items-center justify-center rounded-xl border-2 sm:border-2 transition font-bold relative overflow-hidden min-h-[2.8rem] sm:min-h-[4rem] lg:min-h-[4.5rem] px-1 py-1 sm:px-2 sm:py-2 text-[0.75rem] sm:text-xl lg:text-2xl shadow-sm
     ```
   - **No shift info** (`!shiftInfo`, i.e. no anchor): append ` bg-white border-gray-200 shadow-sm cursor-pointer` (light) or ` bg-gray-800 border-gray-700 shadow-sm cursor-pointer` (dark); content = day number only.
   - **Future day** (has shiftInfo): muted classes ` border-gray-100 text-gray-300 bg-gray-50/50 shadow-none cursor-default` (light) / ` border-gray-700 text-gray-600 bg-gray-800/30 shadow-none cursor-default` (dark). Content = day number + a small label line: if `shiftInfo.work` show `shiftInfo.label`, else show `OFF`. Label line classes: `text-[0.4rem] sm:text-[0.5rem] lg:text-[0.55rem] font-bold uppercase tracking-widest mt-0.5` plus muted text color.
   - **Past/today, OFF day** (`!shiftInfo.work`): increment `offCount`; append ` ${shiftInfo.color}`; content = day number + label line (`text-[0.45rem] sm:text-[0.6rem] lg:text-[0.65rem] font-bold uppercase tracking-widest mt-0.5 sm:mt-1`) with `shiftInfo.label`.
   - **Past/today, missed** (`missedDays.includes(fullDateString)`): increment `missedCount`; classes ` bg-red-500 text-white border-red-600 shadow-md ring-2 ring-red-300`; content = day number + `MISSED` line (`text-[0.4rem] sm:text-[0.55rem] lg:text-[0.6rem] font-bold uppercase tracking-widest mt-0.5 sm:mt-1`).
   - **Past/today, present work day**: increment `presentCount`; classes ` ${shiftInfo.color} hover:shadow-lg hover:-translate-y-0.5`; content = day number + label line with `shiftInfo.label`.
7. After the loop, update stats:
   - If anchor: `#days-present-count` = presentCount, `#days-missed-count` = missedCount, `#days-off-count` = offCount; `totalWork = presentCount + missedCount`; `pct = totalWork > 0 ? Math.round(presentCount / totalWork * 100) : 0`; `#attendance-pct` = `` `${pct}% attendance` ``; `streak = calcStreak(startDate, endDate)`; `#streak-display` = `streak > 0 ? \`🔥 ${streak}-day streak\` : ''`.
   - Else: all four displays reset to `--` / empty.

### 8.6 Popup animations
```js
function showPopup(btn, text, className) {
    const rect = btn.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = className;
    el.textContent = text;
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}
function showMissedPopup(btn) { showPopup(btn, 'MISSED', 'missed-popup'); }
function showAnchorPopup(btn) { showPopup(btn, 'ANCHOR ✓', 'anchor-popup'); }
function showUnmissedPopup(btn) { showPopup(btn, 'UNMISSED ✓', 'unmissed-popup'); }
```

### 8.7 Event delegation on `#calendar-grid` (single `onclick`)
```js
document.getElementById('calendar-grid').onclick = function (e) {
    const btn = e.target.closest('button[data-date]');
    if (!btn) return;
    const date = btn.dataset.date;
    const dt = new Date(date + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (dt > today) return;                          // future days are not clickable

    if (isSettingCycle) {
        // Set/change the anchor: reset segments to ONE segment starting today,
        // reusing the CURRENT (last) pattern.
        localStorage.setItem('anchorDate', date);
        savedAnchorDate = date;
        const currentPattern = shiftSegments.length ? shiftSegments[shiftSegments.length - 1].pattern : pattern222();
        shiftSegments = [{ startDate: date, pattern: currentPattern }];
        localStorage.setItem('shiftSegments', JSON.stringify(shiftSegments));
        isSettingCycle = false;
        document.getElementById('set-cycle-btn').innerText = 'Change Cycle Start';
        document.getElementById('set-cycle-btn').classList.remove('animate-pulse', 'bg-red-100', 'text-red-600');
        renderCalendar();
        showAnchorPopup(btn);
    } else {
        const shift = getShiftInfo(dt);
        if (!shift || !shift.work) return;           // OFF days can't be marked missed
        if (missedDays.includes(date)) {
            missedDays = missedDays.filter(d => d !== date);
            showUnmissedPopup(btn);
        } else {
            missedDays.push(date);
            showMissedPopup(btn);
        }
        localStorage.setItem('missedDays', JSON.stringify(missedDays));
        renderCalendar();
    }
};
```

### 8.8 Copy date on double-tap (separate click listener)
```js
let lastTapTime = 0;
document.getElementById('calendar-grid').addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-date]');
    if (!btn) return;
    const now = Date.now();
    if (now - lastTapTime < 400) {
        const date = btn.dataset.date;
        navigator.clipboard.writeText(date).catch(() => {});
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg text-xs z-50 shadow-lg';
        toast.textContent = `Copied ${date}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
    }
    lastTapTime = now;
});
```

### 8.9 Swipe navigation (touch)
```js
(function () {
    let sx = 0, ex = 0;
    const grid = document.getElementById('calendar-grid');
    grid.addEventListener('touchstart', function (e) { sx = e.changedTouches[0].screenX; }, { passive: true });
    grid.addEventListener('touchend', function (e) {
        ex = e.changedTouches[0].screenX;
        const dx = ex - sx;
        if (Math.abs(dx) > 60) {
            periodOffset += dx < 0 ? 1 : -1;   // swipe left → next period, right → previous
            renderCalendar();
        }
    }, { passive: true });
})();
```

### 8.10 Export JSON
```js
const data = {
    anchorDate: savedAnchorDate || '',
    missedDays: missedDays,
    shiftSegments: shiftSegments,
    theme: isDarkMode() ? 'dark' : 'light',
    exportedAt: new Date().toISOString()
};
// blob 'application/json', pretty-printed (2-space indent),
// filename: `voucher-data-YYYY-MM-DD.json` (date = today)
// download via temporary <a> + URL.createObjectURL + click + revokeObjectURL
```

### 8.11 Export CSV
- Guard: `if (!savedAnchorDate) { alert('No data to export. Set a cycle start first.'); return; }`.
- Iterate the currently-viewed period, skip days after today.
- Header line: `Date,Day,Shift,Status`.
- Per day: `fullDateString`, weekday short name (`en-US`, e.g. `Mon`), shift label; status = `MISSED` if in missedDays, `PRESENT` if a work day, else the OFF label; if no shift info → `--,--` for shift/status columns.
- Filename: `voucher-attendance-YYYY-MM-DD.csv`.

### 8.12 Import (validation & restore)
- Read file as text, `JSON.parse`.
- Validation failures → `alert(...)` and abort:
  - missing `anchorDate` or `missedDays` → `'Invalid file format. Missing required fields.'`
  - anchorDate not empty and not matching `/^\d{4}-\d{2}-\d{2}$/` → `'Invalid date format in import file.'`
  - missedDays not an array → `'Invalid missedDays format in import file.'`
  - JSON parse error → `'Invalid JSON file.'`
- Restore:
  - If `data.shiftSegments` is a non-empty array: keep only entries with a valid `startDate` string and a non-empty `pattern` array; rebuild each pattern with `makeShift(p.label)`; sort by startDate.
  - Else: migrate to `[{ startDate: savedAnchorDate, pattern: pattern222() }]` (or `[]` if no anchor).
  - `savedAnchorDate = shiftSegments[0].startDate` when segments exist.
  - Persist all three keys to localStorage.
  - If `data.theme` exists: set it and `applyTheme`.
  - Reset `#set-cycle-btn` text to `'Change Cycle Start'` if anchor else `'Set Cycle Start'`, remove pulse classes, `isSettingCycle = false`, `periodOffset = 0`, `renderCalendar()`, `alert('Data imported successfully!')`.

### 8.13 Reset
- `confirm('Are you sure you want to reset ALL data? This cannot be undone.')`.
- Remove `anchorDate`, `missedDays`, `shiftSegments` from localStorage; null/empty the variables; `periodOffset = 0`; `isSettingCycle = false`; button text `'Set Cycle Start'`, pulse classes removed; `renderCalendar()`.

### 8.14 Period summary tooltip (`#period-label` click)
- Guard: no anchor → return silently.
- Iterate the viewed period up to today; count each shift label into a map (`labelCounts[label]++`); count `miss` (in missedDays) and `pres` (work days not missed).
- Build `parts = [label:count for each label]` then append `Present:${pres}` and `Missed:${miss}`.
- Create a fixed tooltip div: `fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap`, `innerHTML = parts.join(' &middot; ')`, positioned below the label and clamped horizontally: `left = clamp(rect.left + rect.width/2 - 120, 8, innerWidth - 240 - 8)`, `top = rect.bottom + 6`. Remove after 3000 ms.

---

## 9. SHIFT PATTERN EDITOR (full behavior)

```js
function openPatternEditor() {
    if (!shiftSegments.length) {
        showPopup(document.getElementById('pattern-btn'), 'SET CYCLE START FIRST', 'anchor-popup');
        return;
    }
    patternEditorPattern = shiftSegments[shiftSegments.length - 1].pattern.map(s => s.label);  // prefill from current pattern
    document.getElementById('pattern-start-date').value = <today as YYYY-MM-DD>;
    renderPatternEditor();
    document.getElementById('pattern-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}
function closePatternEditor() {
    document.getElementById('pattern-modal').classList.add('hidden');
    document.body.style.overflow = '';
}
```
- **Wiring:** `#pattern-btn` → open; `#pattern-close`, `#pattern-cancel`, `#pattern-backdrop` → close.

### 9.1 `renderPatternEditor()`
1. **Chips**: clear `#pattern-chips`; for each label in `patternEditorPattern` create a `<button type="button">` with classes `${CHIP_CLS[label]} border-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm transition hover:opacity-80`, text = label, `title = 'Tap to remove'`, click → remove that chip (`splice(i, 1)`) and re-render. If the array is empty, show a placeholder span: `'Build your pattern by tapping + M, + N, + OFF below'` with classes `text-xs text-gray-400 italic`.
2. **Presets**: clear `#pattern-presets`; for each preset in `PATTERN_PRESETS` create a button `text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition`, text = `p.name`, `title = p.pattern.join(' ')` (e.g. `M M N N OFF OFF`), click → `patternEditorPattern = [...p.pattern]` and re-render.
3. Call `renderPatternPreview()`.

### 9.2 `renderPatternPreview()`
- Read `#pattern-start-date` value; if empty show `'Pick a start date above to preview'` (italic gray).
- Render **14 chips**: for `i = 0..13`, day = start + i days; `idx = i % len` (len = pattern length, minimum 1); label = `patternEditorPattern[idx] || 'OFF'`; chip = `<span>` with classes `px-2 py-1 rounded-lg text-[0.6rem] font-bold border ${SHIFT_COLORS[makeShift(label).color].light}` (always the LIGHT variant), text = `` `${d.getDate()} ${label}` ``, `title = d.toDateString()`.
- `#pattern-start-date` `change` → re-run `renderPatternPreview()`.

### 9.3 Chip controls
- `#chip-add-m` → `push('M')`; `#chip-add-n` → `push('N')`; `#chip-add-off` → `push('OFF')`; `#chip-delete` → `pop()`; `#chip-clear` → `= []`. Each then re-renders.

### 9.4 Save (`#pattern-save`)
Validation (each shows a popup on the save button and aborts):
1. No start date → `showPopup(saveBtn, 'PICK A DATE', 'missed-popup')`.
2. Empty pattern → `showPopup(saveBtn, 'PATTERN IS EMPTY', 'missed-popup')`.
3. `sd < shiftSegments[0].startDate` (before anchor) → `showPopup(saveBtn, 'TOO EARLY', 'missed-popup')`.
Then:
- If `sd === shiftSegments[shiftSegments.length - 1].startDate` → **replace** the last segment's pattern.
- Else → `shiftSegments.push({ startDate: sd, pattern: patternEditorPattern.map(makeShift) })` and **sort** by startDate (ascending).
- `localStorage.setItem('shiftSegments', JSON.stringify(shiftSegments))`.
- `savedAnchorDate = shiftSegments[0].startDate`; `localStorage.setItem('anchorDate', savedAnchorDate)`.
- `closePatternEditor()`; `renderCalendar()`; `showPopup(document.getElementById('pattern-btn'), 'PATTERN SAVED ✓', 'anchor-popup')`.

---

## 10. HELP MODAL — FULL CONTENT (verbatim text)

Sections are `<div>`s separated by `<hr class="border-gray-100">`. Headings use `class="font-bold text-indigo-600 text-base mb-1"`. Body text is `text-gray-600` where noted; lists are `list-disc list-inside space-y-1 text-gray-600`.

**Intro paragraph:**
> This app helps you track your work attendance on a **shift pattern** &mdash; by default the classic **2-2-2** (2 morning shifts, 2 night shifts, then 2 days off, repeating every 6 days). You can keep that, or build any pattern you like (see section 8). Mark when you miss a day, track your streak, view attendance percentage, navigate with swipe gestures, export data as JSON or CSV, and manage everything offline in your browser.

**1. Set Your Start Date**
> Before anything else, you need to tell the app **when your cycle begins**.
> - Tap the **"Set Cycle Start"** button above the calendar.
> - The button will change to **"Select Day Below..."**.
> - Now tap any day on the calendar &mdash; that day becomes your **anchor date**.
> - The calendar will instantly color-code every day based on your shift pattern.
> *You can change your start date anytime by tapping "Change Cycle Start." You can also switch to a different shift pattern anytime &mdash; see section 8.*

**2. Understand the Colors** (each with a swatch: `inline-block w-10 h-10 rounded-lg` + matching classes)
- `bg-amber-200 border-2 border-amber-400 shadow-sm` → **M (Morning)** — You work the morning shift
- `bg-indigo-200 border-2 border-indigo-400 shadow-sm` → **N (Night)** — You work the night shift
- `bg-gray-100 border-2 border-gray-300` → **OFF** — You are off duty
- `bg-red-500 border-2 border-red-600 ring-2 ring-red-300` → **MISSED** — You marked yourself absent

**3. Mark Missed Days**
> If you missed a morning or night shift, you can mark it on the calendar:
> - **Tap** any M (Morning) or N (Night) day to mark it as **Missed**.
> - The day will turn **bold red** so you can see it clearly.
> - Tap it **again** to remove the missed mark.
> - You **cannot** mark OFF days as missed &mdash; days off are already rest days.

**4. Read Your Stats**
> The top of the app shows your attendance numbers for the current period:
> - **Total Days Present** &mdash; how many shifts you worked (not marked missed).
> - **Attendance %** &mdash; shown below the total as a percentage of present vs. total working days.
> - **Streak** &mdash; your consecutive present-day streak (backward from today), shown with a fire icon.
> - **Missed** &mdash; how many shifts you missed (shown in red).
> - **Days Off** &mdash; how many OFF days are in this period.
> *You can also tap the period label to see a quick summary of M / N / OFF / Present / Missed counts for the current period.*

**5. Navigate Between Periods**
> Each voucher period runs from the 20th of one month to the 19th of the next. To move between periods:
> - Tap the **left arrow (&larr;)** to go to the **previous** period.
> - Tap the **right arrow (&rarr;)** to go to the **next** period.
> - **Swipe left/right** on the calendar grid to quickly change periods on mobile.
> - Tap the **period label** (e.g. "Current Period") to see a popup summary of shift counts.

**6. Backup or Restore Your Data**
> At the bottom of the app, you will find four buttons:
> - **Export JSON** &mdash; downloads a JSON backup file with all your attendance records.
> - **Export CSV** &mdash; downloads a spreadsheet-friendly CSV of every day&rsquo;s shift and status.
> - **Import Data** &mdash; lets you restore your data from a JSON backup file you exported earlier.
> - **Reset All** &mdash; clears everything and starts fresh. Use this only if you are sure.
> *Your data stays on your device. Nothing is sent to any server.*

**7. Interactive & Handy Features**
> - **Copy a date** &mdash; double-tap any day button to copy its date (YYYY-MM-DD) to your clipboard.
> - **Missed popup** &mdash; when you mark a day missed, a "MISSED" animation flashes on that day.
> - **Un-missed popup** &mdash; tap a missed day again to clear it; a "UNMISSED ✓" animation appears.
> - **Anchor flash** &mdash; when you set or change your cycle start, an "ANCHOR ✓" animation confirms it.
> - **Period tooltip** &mdash; tap the period label to see a quick breakdown of all shift types.
> - **Future days** &mdash; are shown muted and cannot be tapped.

**8. Use Your Own Shift Pattern**
> Don&rsquo;t work a 2-2-2? No problem &mdash; the app works with **any** repeating pattern. Tap **"Shift Pattern"** above the calendar to open the pattern editor.
> - **Pick a preset** &mdash; e.g. 3M / 4OFF, 5M / 2OFF, 1-1-1, or 4M / 2OFF.
> - Or **build your own** pattern chip by chip using the + M, + N and + OFF buttons. Tap a chip to remove it.
> - Choose **when the pattern starts** &mdash; today, or any future date (e.g. your next roster change).
> - Watch the **live preview** to make sure the first day lands on the right shift.
> - Tap **Save Pattern** &mdash; days before the start date keep their old pattern, so your history is never rewritten.
> *You can switch patterns as many times as you like. Changing your schedule mid-period is fully supported &mdash; the app treats each switch like a new timetable that starts on the date you chose.*

**9. Switch Between Light and Dark Mode**
> Tap the **sun/moon toggle** at the top-left corner of the app to switch between light and dark themes. Your choice is saved automatically.

**10. Where Is My Data Saved?**
> Everything you enter stays **on your phone or computer** in what is called "local storage." No internet connection is needed, and no data is sent anywhere. If you clear your browser data or use a different device, your information will not be there &mdash; so make sure to **export a backup** if you need to switch devices.

---

## 11. HELP / PATTERN MODAL & ATTENTION BEHAVIOR

- `openHelp()`: unhide `#help-modal`, lock body scroll, call `stopHelpAttention()`, set `localStorage.setItem('helpIntroSeen', '1')`.
- `closeHelp()`: hide + unlock scroll.
- `#help-btn`, `#help-close`, `#help-got-it`, `#help-backdrop` → open/close as appropriate.
- **First visit:** if `helpIntroSeen` is not set, on load add class `help-attention` to `#help-btn` and unhide `#help-tooltip` (it has a built-in 7.5s fade-out via CSS; also JS-remove it after 8000 ms). `stopHelpAttention()` removes the class and removes the tooltip element (if still in the DOM).

---

## 12. BUTTON/TOGGLE BEHAVIOR DETAILS

- **`#set-cycle-btn`** (anchor flow):
  - Initial text `Set Cycle Start`; if an anchor exists on load, text is `Change Cycle Start`.
  - Click → `isSettingCycle = true`, text `Select Day Below...`, add classes `animate-pulse bg-red-100 text-red-600`; also remove `#friendly-banner` if present (it disappears as soon as cycle-setting starts).
  - After a day is picked (§8.7), text returns to `Change Cycle Start` and pulse classes are removed.
- **Period arrows** → `periodOffset ± 1` + `renderCalendar()`.
- **`#export-btn`** → `exportData`; **`#export-csv-btn`** → `exportCSV`; **`#import-btn`** → trigger click on hidden `#import-file-input`; `#import-file-input` `change` → `importData(file)` then reset input value; **`#reset-btn`** → `resetData`.
- **`#pattern-btn`** → `openPatternEditor`.

---

## 13. EDGE CASES & RULES (must all hold)

1. Future days: rendered with muted styles and **not clickable** (guard `dt > today`).
2. OFF days can never be marked missed.
3. No anchor + no cycle-setting mode → friendly banner AND plain day buttons both visible.
4. Clicking "Set Cycle Start" hides the banner immediately (removes it) but does NOT re-render.
5. Days before the anchor date still get shift labels (the pattern wraps backward around the first segment).
6. Changing the anchor resets to a single segment reusing the current pattern — previous segments are dropped (history before the new anchor is recomputed from the new anchor).
7. Saving a pattern with the same start date as the last segment replaces that segment's pattern instead of adding a duplicate.
8. A new pattern start date before the anchor is rejected with a `TOO EARLY` popup.
9. Missed marks persist even across pattern changes.
10. The streak skips OFF days and breaks at the first missed day.
11. Period boundaries never change; `periodOffset` only shifts which period is displayed.
12. Attendance % = round(present / (present + missed) × 100); when total is 0 → `0% attendance`.
13. The period tooltip and CSV only cover dates up to and including today.
14. Theme persists; a saved theme overrides the OS preference.
15. Import validates every field before applying anything, and resets `periodOffset` to 0.

---

## 14. INIT SEQUENCE (at the end of the script)

1. `#copyright-year` = current year; `#app-version` = `'v' + APP_VERSION`.
2. If anchor exists → `#set-cycle-btn` text = `Change Cycle Start`.
3. `renderCalendar()`.
4. First-visit help attention (§11) is set up earlier in the script, before init.

---

## 15. ACCEPTANCE CRITERIA — verify ALL of these

1. **Fresh start:** open the app with empty localStorage → friendly banner + `--` counters; all day buttons present and plain.
2. **Set anchor:** click "Set Cycle Start" → button pulses and says "Select Day Below..."; banner disappears; tap a past day → calendar colors fill in (2-2-2), `ANCHOR ✓` popup, button now says "Change Cycle Start", heading shows "Month Year · Attendance".
3. **Colors:** verify M = amber, N = indigo, OFF = gray, MISSED = red; check the exact 6-day repeat and that the day BEFORE the anchor follows the pattern's last day.
4. **Mark missed:** tap an M/N day → red + `MISSED` popup + missed count++; tap again → restored + `UNMISSED ✓` popup. Tapping an OFF day does nothing.
5. **Stats:** counters match the grid; attendance % correct; streak shows 🔥 when ≥1.
6. **Navigation:** arrows + swipe change period; date range and label update; tooltip on label click shows `M:N:OFF:Present:Missed` counts (only to today).
7. **Copy:** double-tap a day → toast "Copied YYYY-MM-DD"; clipboard has the date.
8. **Pattern editor:** opens with current pattern prefilled; presets replace chips; + M/N/OFF append; chip click removes; Delete last / Clear work; preview shows 14 chips starting at the chosen date; changing the date re-previews.
9. **Save pattern:** today as start → calendar updates from today (old days unchanged); future start → future days show the new labels; `PATTERN SAVED ✓` popup. Validate: no date → `PICK A DATE`; empty → `PATTERN IS EMPTY`; date before anchor → `TOO EARLY`; no anchor → `SET CYCLE START FIRST` popup on the Shift Pattern button.
10. **Export JSON:** file contains anchorDate, missedDays, shiftSegments, theme, exportedAt.
11. **Export CSV:** header `Date,Day,Shift,Status`; PRESENT/MISSED/OFF values; `--` only if no anchor (blocked by the guard alert).
12. **Import:** restore a backup → identical state; malformed file → `alert`; theme restored.
13. **Reset:** confirm dialog; everything clears; button back to "Set Cycle Start".
14. **Dark mode:** toggle flips `data-theme`, knob slides 28px, icon ☀️/🌙; all overrides in §4 apply (card, stats row, buttons, help modal, footer).
15. **Persistence:** reload the page → anchor, missed marks, patterns, theme all retained.
16. **Accessibility:** every interactive element has a meaningful `aria-label` or `title`; modals have `role="dialog"`/`aria-modal`; grid has `role="grid"`.

---

## 16. DELIVERY NOTES

- Output exactly **one file**: `index.html`. Do not create a README, CSS, or JS file.
- Keep the exact element IDs listed here — the JavaScript depends on them.
- Reproduce the WhatsApp icon with the standard WhatsApp brand SVG path (chat bubble glyph), `viewBox="0 0 24 24"`, `fill="currentColor"`, rendered at `w-3.5 h-3.5`.
- The app must be a faithful clone of **v1.4.0** of the original. Do not add features beyond this spec, do not remove any.
