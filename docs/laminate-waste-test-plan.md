# 🗑️ Laminate Waste Tracking — Test Plan

> **For everyone**: This is a step-by-step guide to test the Laminate Waste system.  
> Each step tells you what to do and what should happen.  
> If something doesn't match, write it down and tell the developer.

---

## ✅ Test 1: The Laminate Waste Page Loads

| Step | Action | Expected Result |
|---|---|---|
| 1 | Log in to the app | You see the Command Center |
| 2 | Click the hamburger menu (☰ top-left) | Sidebar slides open |
| 3 | Click **"Laminate Waste"** under **Production** | Page opens with title "Laminate Waste Tracking" |
| 4 | Look at the top bar | Shows: Shift (DAY or NIGHT), today's date, your name, and a Team dropdown |
| 5 | Look at the machine grid | You see machines organized in columns by production line |

**Pass / Fail** (circle one)

---

## ✅ Test 2: Understanding the Machine Colors

| Step | Action | Expected Result |
|---|---|---|
| 1 | Look at the colored dots below the header | Green = Checked, Red = High Waste, Gray = Unchecked |
| 2 | Look at the machine buttons | Most machines should be gray (Unchecked) — we haven't entered anything yet |
| 3 | Check the "X unchecked" badge | Shows a number matching how many gray machines you see |

**Pass / Fail** (circle one)

---

## ✅ Test 3: Open the Entry Modal for a Machine

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click any **gray** machine button | A dark modal pops up with the machine name, line, and gram |
| 2 | Look at the top of the modal | It says "Machine M{number}" with Line and gram in gray |
| 3 | Look for the round indicator | Shows "New Check — Round 1" in amber/orange text |
| 4 | Look for the yellow banner | Shows "First check of the shift" with info about total laminate used |

**Pass / Fail** (circle one)

---

## ✅ Test 4: Enter Laminate Waste Data

| Step | Action | Expected Result |
|---|---|---|
| 1 | Find the **Sac Type** dropdown | Shows two options: "Small Sac (80g)" and "Large Sac (160g)" |
| 2 | Select "Small Sac (80g)" | Dropdown shows your selection |
| 3 | Find the **Gross Weight (kg)** field | Empty text box ready for input |
| 4 | Type `1.500` into Gross Weight | A blue "Auto-Calculated" box appears below |
| 5 | Look at the Auto-Calculated box | Shows: Sac Weight = 0.080 kg, Waste Collected = 1.420 kg, Total Laminate Used, Running totals |
| 6 | Type `0.050` into Gross Weight instead | Try a very small number — see what happens |

**Pass / Fail** (circle one)

---

## ✅ Test 5: Validation — Wrong Inputs

| Step | Action | Expected Result |
|---|---|---|
| 1 | Set Gross Weight to `0.010` (less than sac weight of 0.080) | Click **Save & Close** — you should see a **red error message**: "Gross weight cannot be less than sac weight" |
| 2 | Click **Cancel** to close | Modal closes, no data saved |

**Pass / Fail** (circle one)

---

## ✅ Test 6: Save Laminate Waste Data

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click a gray machine to open modal | Modal opens |
| 2 | Select **Small Sac (80g)** | Sac Type is set |
| 3 | Type `2.500` into Gross Weight | Auto-calc shows Waste = 2.420 kg |
| 4 | Click **Save & Close** | Modal closes. The machine button turns **green** and shows "Waste: 2.420kg" and the waste % |

**Pass / Fail** (circle one)

---

## ✅ Test 7: Saving Another Round for the Same Machine

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click the **same machine** again | Modal opens |
| 2 | Look at the **Previous Check** banner | Shows Round 1 data: Sac, Gross, Waste, Running Waste, Waste % |
| 3 | Look at the round indicator | Now shows "New Check — Round 2" |
| 4 | Sac Type is pre-filled | Should show the same sac type you used before |
| 5 | Type `3.200` into Gross Weight | Auto-calc shows running waste totals |
| 6 | Click **Save & Close** | Modal closes. Machine stays green |

**Pass / Fail** (circle one)

---

## ✅ Test 8: Save & Next Machine

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click an unchecked machine | Modal opens |
| 2 | Select **Large Sac (160g)** | Sac Type is set |
| 3 | Type `5.000` into Gross Weight | Auto-calc shows Waste = 4.840 kg |
| 4 | Click **Save & Next Machine** | Modal closes, then automatically opens the **next machine** in numeric order |
| 5 | Fill in data for this machine | Enter any Gross Weight |
| 6 | Click **Save & Next Machine** again | Keeps advancing through machines |
| 7 | On the **last machine**, click **Save & Next Machine** | Modal closes. No next machine opens (you're done with the cycle) |

**Pass / Fail** (circle one)

---

## ✅ Test 9: Offline Mode

| Step | Action | Expected Result |
|---|---|---|
| 1 | Turn off your Wi-Fi or disconnect internet | The SyncBadge (top-left) turns red and says "Offline" |
| 2 | Open a machine modal and enter data | Works normally — no errors |
| 3 | Click **Save & Close** | Data saves. An info broadcast may appear: "Laminate check saved offline for M..." |
| 4 | Turn Wi-Fi back on | SyncBadge turns green "Online". After a moment, the pending badge disappears as data syncs |

**Pass / Fail** (circle one)

---

## ✅ Test 10: High Waste Alert

| Step | Action | Expected Result |
|---|---|---|
| 1 | Open a machine that has data | Modal opens |
| 2 | Set Gross Weight very high (e.g., `50.000` kg for a sac of 0.080 kg) | Waste % will be very high |
| 3 | Click **Save & Close** | A red/orange alert banner should appear: "⚠️ High laminate waste on M{X}: {Y}% (by your name)" |

**Pass / Fail** (circle one)

---

## ✅ Test 11: Grid Colors Update Correctly

| Step | Action | Expected Result |
|---|---|---|
| 1 | After saving some machines with normal waste % | Those machines are **green** |
| 2 | After saving a machine with very high waste % | That machine turns **red** |
| 3 | Machines with no data yet | Stay **gray** |
| 4 | The unchecked count number | Matches the number of gray machines |

**Pass / Fail** (circle one)

---

## ✅ Test 12: View Report Page

| Step | Action | Expected Result |
|---|---|---|
| 1 | On the Laminate Waste page, click **View Report →** (top-right) | Takes you to `/laminate-waste-report` |
| 2 | Look at the filter panel at the top | Shows Date, Shift, Team, Machine filters |
| 3 | Look at the **4 summary cards** | Total Laminate Used (kg), Total Waste Collected (kg), Waste %, Machines with Data |
| 4 | Scroll down to see the **Waste % by Machine** chart | Horizontal bar chart showing each machine |
| 5 | Scroll to **Waste Trend Over Rounds (Top 5)** | Line chart for the 5 highest-waste machines |
| 6 | Scroll to **Cross-Shift Comparison** | Bar chart comparing past shifts |
| 7 | Scroll to **Per-Machine Breakdown** table | Each machine with checks count, laminate used, waste collected, waste % |
| 8 | Scroll to **Round-by-Round Details** table | Every individual check with sac type, weights, waste, checked-by |

**Pass / Fail** (circle one)

---

## ✅ Test 13: Report Filters

| Step | Action | Expected Result |
|---|---|---|
| 1 | On the report page, change **Team** to a specific team | Data filters to only show that team's checks |
| 2 | Click **Generate Report** | Page reloads with filtered data |
| 3 | Change **Machine** to a specific machine | Only shows data for that machine |
| 4 | Click **Generate Report** again | Data refreshes |

**Pass / Fail** (circle one)

---

## ✅ Test 14: Export CSV

| Step | Action | Expected Result |
|---|---|---|
| 1 | On the report page, click **Export CSV** | A CSV file downloads automatically named `laminate_waste_{SHIFT}_{DATE}.csv` |
| 2 | Open the CSV file in Excel or Notepad | Columns: Date, Shift, Team, Machine, Line, Round, Sac Type, Sac Wt, Gross Wt, Waste Collected, Laminate Used, Waste %, CheckedBy, CheckedAt |

**Pass / Fail** (circle one)

---

## ✅ Test 15: Print Report

| Step | Action | Expected Result |
|---|---|---|
| 1 | On the report page, click **Print** | Browser print dialog opens in landscape mode |
| 2 | Preview the print | All tables and charts have white backgrounds. Headers show "Laminate Waste Report" with shift/date info |

**Pass / Fail** (circle one)

---

## ✅ Test 16: System Config — Laminate Waste Settings

| Step | Action | Expected Result |
|---|---|---|
| 1 | Go to **System Config** (Admin sidebar) | Config page loads |
| 2 | Click the **🗑️ Laminate Waste** tab | Settings page shows 3 sections |
| 3 | Find **Waste Thresholds** | Target Waste % (default 5) and Alert Threshold % (default 10) |
| 4 | Find **Packaging Teams** (not here — moved to Global Settings tab) | Team labels are now configured under **⚙️ Global Settings → Packaging Teams** |
| 5 | Find **Roll Settings** | Rolls per Shift (default 3) and a table of roll weights for each gram (22g→51.32, 45g→54.40, etc.) |
| 6 | Find **Sac Types** | Small Sac Weight (80g) and Large Sac Weight (160g) |
| 7 | Change Target Waste % to `8` and click **Save Laminate Waste Settings** | Green toast: "Laminate waste settings saved!" |
| 8 | Go back to Laminate Waste page | The threshold should now be 8% |

**Pass / Fail** (circle one)

---

## ✅ Test 17: Dashboard Shows Laminate Waste

| Step | Action | Expected Result |
|---|---|---|
| 1 | Go to the **Command Center** (click 🏢 Factory Overview → Command Center) | Dashboard loads |
| 2 | Find the **Laminate Waste** card (🗑️ icon) | Shows total waste collected (kg) and waste % — color-coded green/red |
| 3 | Click the Laminate Waste card | Takes you to `/laminate-waste-report` |
| 4 | Scroll to **Quick Actions** | Find "🗑️ Laminate Waste Tracking" and "🗑️ Laminate Waste Report" links |
| 5 | Click "Laminate Waste Tracking" | Goes to `/laminate-waste` page |
| 6 | Click "Laminate Waste Report" | Goes to `/laminate-waste-report` page |

**Pass / Fail** (circle one)

---

## ✅ Test 18: Navigation

| Step | Action | Expected Result |
|---|---|---|
| 1 | Open sidebar | Under **Production**, you see "🗑️ Laminate Waste" |
| 2 | Open sidebar, look under **Reports** | You see "🗑️ Laminate Waste Report" |
| 3 | Click "Laminate Waste" | Goes to `/laminate-waste` |
| 4 | Click "Laminate Waste Report" | Goes to `/laminate-waste-report` |

**Pass / Fail** (circle one)

---

## ✅ Test 19: Active Users Shows Laminate Pages

| Step | Action | Expected Result |
|---|---|---|
| 1 | Go to `/laminate-waste` | You're on the data entry page |
| 2 | Open **Active Users** (Admin sidebar) in another tab | Find your session — it should show "Laminate Waste Tracking" as your current page |
| 3 | Go to `/laminate-waste-report` | Page changes |
| 4 | Refresh Active Users | Your page should now show "Laminate Waste Report" |

**Pass / Fail** (circle one)

---

## ✅ Test 20: Edge Cases

| Step | Action | Expected Result |
|---|---|---|
| 1 | Enter Gross Weight of `0` | Error or auto-calc shows negative waste collected (since sac weight is > 0) — validation should catch it |
| 2 | Leave Gross Weight empty and click Save | Error: "Enter a valid gross weight" |
| 3 | Don't select a Team and click Save | Error: "Select your team" |
| 4 | Enter a Gross Weight of `99999` | Very high waste % — should trigger high waste alert |

**Pass / Fail** (circle one)

---

## Summary

| Test # | Test Name | Pass/Fail | Notes |
|---|---|---|---|
| 1 | Page Loads | | |
| 2 | Machine Colors | | |
| 3 | Open Modal | | |
| 4 | Enter Data | | |
| 5 | Validation | | |
| 6 | Save Data | | |
| 7 | Another Round | | |
| 8 | Save & Next Machine | | |
| 9 | Offline Mode | | |
| 10 | High Waste Alert | | |
| 11 | Grid Colors | | |
| 12 | Report Page | | |
| 13 | Report Filters | | |
| 14 | Export CSV | | |
| 15 | Print Report | | |
| 16 | System Config | | |
| 17 | Dashboard | | |
| 18 | Navigation | | |
| 19 | Active Users | | |
| 20 | Edge Cases | | |
