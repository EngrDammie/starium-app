# Carton Waste Tracking — Test Plan for Non-Technical Testers

> **How to use this plan:**
> - Find the section you want to test.
> - Follow every step in order, exactly as written.
> - After each step, check the "You should see" column. If you don't see it, that's a bug.
> - ❌ = this test must pass before going to production.
> - ⚠️ = this test is important but not blocking.

---

## Before You Start

1. Open Google Chrome.
2. Go to the Starium website (ask your manager for the web address).
3. Log in with your username and password.
4. You should see the main menu on the left side of the screen.

---

## Section 1: Can You Find the Carton Waste Page?

### Test 1.1 — Finding Carton Waste Tracking
| Step | What to do | You should see |
|---|---|---|
| 1 | Look at the menu on the LEFT side of the screen. | A list of categories: Factory Overview, Quality Control, Production, Human Resources, Administration |
| 2 | Click on **"Production"** to expand it. | A list of items drops down below "Production" |
| 3 | Look at the first item in the list. | The words **"Carton Waste Tracking"** with a 📦 icon next to it |
| 4 | Click **"Carton Waste Tracking"**. | A new page opens with the title "Carton Waste Tracking" at the top |

⚠️ **If you don't see "Carton Waste Tracking" at all**, tell your manager — your account may not have the right permissions.

### Test 1.2 — Finding Carton Waste Report
| Step | What to do | You should see |
|---|---|---|
| 1 | Look at the menu on the LEFT side of the screen. | The "Production" section should still be expanded |
| 2 | Look at the second item in the Production list. | The words **"Carton Waste Report"** with a 📊 icon |
| 3 | Click **"Carton Waste Report"**. | A new page opens with the title "Carton Waste Report" at the top |

⚠️ **If you don't see "Carton Waste Report"**, your account might not have permission to view reports. That's OK if you're a Production Staff member — only managers can see reports.

---

## Section 2: The Data Entry Page — Entering Carton Waste

### 2.1 — Opening the Page and Looking Around
| Step | What to do | You should see |
|---|---|---|
| 1 | Click **"Carton Waste Tracking"** in the left menu. | A page with the title "Carton Waste Tracking" |
| 2 | Look at the top of the page. | A bar showing: Shift (DAY or NIGHT), Date (like "Saturday, 18 Jun 2026"), a Team dropdown, and your User name |
| 3 | Look at the **Team** dropdown. | A box where you can pick your team |
| 4 | Click the **Team** dropdown and select **"Team A"**. | The dropdown now shows "Team A" |
| 5 | Look below the header. | A row of colored circles with labels: Green "Checked", Red "High Waste", Gray "Unchecked" |
| 6 | Look at the grid of buttons below that. | Several rows of buttons labeled "M1", "M2", "M3" etc. Each button is gray |
| 7 | Look at the top right. | A badge shows how many machines haven't been checked at all yet, like "6 unchecked" |

❌ **If the grid doesn't show machine buttons**, something is wrong.

### 2.2 — First Time Checking a Machine (Happy Path)

**Background:** This is the FIRST time anyone checks Machine M1 today. No one has looked at it yet.

| Step | What to do | You should see |
|---|---|---|
| 1 | Find the button labeled **M1** in the grid. | A gray button with the text "M1" on it |
| 2 | **Click the M1 button.** | A white pop-up window (modal) appears |
| 3 | Look at the top of the pop-up. | "Machine M1 — Line 1A (125g)" |
| 4 | Look below the title. | A yellow warning box with the message: **"First check of the shift. Are there cartons carried over from the previous shift? Enter them as Allocated."** |
| 5 | Find the first input box labeled **"Cartons Allocated"**. | An empty white box below the label "Cartons Allocated (new since last check)" |
| 6 | **Click inside the box** and type **200**. | The number 200 appears in the box |
| 7 | Find the second input box labeled **"Cartons Remaining"**. | An empty box below "Cartons Remaining (current physical count)" |
| 8 | **Click inside the box** and type **180**. | The number 180 appears |
| 9 | Find the third input box labeled **"Cartons Wasted"**. | An empty box below "Cartons Wasted (new since last check)" |
| 10 | **Click inside the box** and type **1**. | The number 1 appears |

✅ **Check the Auto-Calculated section now appears below the inputs:**
```
Cartons Used: 0 + 200 - 180 = 20
Waste % (this check): 1 / (20 + 1) = 4.76%
```

| 11 | Look at the **Running Totals** section below that. | Shows: Allocated: 200 | Used: 20 | Wasted: 1 | Waste %: 4.76% |
|---|---|---|---|---|---|
| 12 | Find the **Remarks** box at the bottom. | An empty text box labeled "Remarks" |
| 13 | **Type** "Test check, all normal" in the Remarks box. | The text appears |
| 14 | Look at the three buttons at the very bottom. | "Cancel", "Save & Next Machine", "Save & Close" |
| 15 | **Click the "Save & Close" button.** | The pop-up closes. You're back at the main page |

❌ **If you get a red error message instead of saving**, check:
- Did you select a Team from the dropdown at the top? (It should say "Team A")
- Did you type numbers, not letters?

| 16 | Look at the **M1 button** now. | It's **green** and shows "Alloc:200" and "Waste:4.8%" |

❌ **If M1 is still gray**, the save didn't work.

### 2.3 — Second Check on the Same Machine

**Background:** Now someone needs to check M1 again. The last person left 180 cartons at M1.

| Step | What to do | You should see |
|---|---|---|
| 1 | **Click the green M1 button** again. | A pop-up opens again |
| 2 | Look at the box titled **"Previous Check"**. | It shows: "Previous Check (**Round 1** by [your name])" with "Round 1" in a **cyan/blue** color. Below: Allocated: 200, Remaining: 180, Wasted: 1, Used: 20, Waste: 4.76% |
| 3 | Notice there is **NO yellow warning box** this time. | (Good — this means the system knows it's not the first check anymore) |
| 4 | Look at the **"New Check — Round 2"** label. | Shows "**Round 2**" in an **amber/orange** color (not white like the rest of the text) |
| 5 | In the **Cartons Allocated** box, type **150**. | 150 appears |
| 6 | In the **Cartons Remaining** box, type **120**. | 120 appears |
| 7 | In the **Cartons Wasted** box, type **3**. | 3 appears |

✅ **Check the Auto-Calculated section:**
```
Cartons Used: 180 + 150 - 120 = 210
Waste % (this check): 3 / (210 + 3) = 1.41%
```

✅ **Running Totals section shows:**
```
Allocated: 350 | Used: 230 | Wasted: 4 | Waste %: 1.71%
```
(200 from first check + 150 from second check = 350 total allocated so far)

| 8 | **Click "Save & Close".** | Pop-up closes, M1 stays green |

---

## Section 3: Testing Validation Rules (Error Messages)

> **Important:** These tests use machines you haven't touched yet (like M3 or M4). They should still be **gray**. If you already checked them earlier, pick any other gray machine instead.

### 3.1 — Trying to Enter Too Many Remaining Cartons

**Background:** For a machine you haven't checked yet, the previous remaining is 0. So if you bring 0 new cartons, the maximum you can have is 0. If you type 500 remaining, the system should stop you.

| Step | What to do | You should see |
|---|---|---|
| 1 | Find a **gray** machine you haven't checked yet (e.g. **M3**). | A gray button |
| 2 | **Click that machine** (e.g. M3). | A pop-up opens with the yellow "First check of the shift" warning |
| 3 | Type **0** in **Cartons Allocated**. | 0 appears |
| 4 | Type **500** in **Cartons Remaining**. | 500 appears |
| 5 | Type **0** in **Cartons Wasted**. | 0 appears |
| 6 | **Click "Save & Close".** | ❌ **RED error message:** "Remaining (500) exceeds available cartons (0). Check your counts." |
| 7 | **Click "Cancel"** to close the pop-up without saving. | Pop-up closes |

### 3.2 — Trying to Waste More Cartons Than You Have

**Background:** For an unchecked machine, previous remaining is 0. If you bring 100 new cartons, the most you can have (or waste) is 100. Typing 300 wasted should be blocked.

| Step | What to do | You should see |
|---|---|---|
| 1 | Find another **gray** machine you haven't checked (e.g. **M4**). | Gray button |
| 2 | **Click that machine.** | Pop-up opens with "First check" warning |
| 3 | Type **100** in **Cartons Allocated**. | 100 appears |
| 4 | Type **50** in **Cartons Remaining**. | 50 appears |
| 5 | Type **300** in **Cartons Wasted**. | 300 appears |
| 6 | **Click "Save & Close".** | ❌ **RED error:** "Wasted (300) exceeds available cartons (100)." |
| 7 | **Click "Cancel"** to close. | Pop-up closes |

### 3.3 — Trying to Enter Negative Numbers

| Step | What to do | You should see |
|---|---|---|
| 1 | Find a **gray** machine (e.g. **M5**). | Gray button |
| 2 | **Click it.** | Pop-up opens |
| 3 | Type **-5** in **Cartons Allocated**. | -5 appears |
| 4 | **Click "Save & Close".** | ❌ **RED error:** "Enter valid allocated cartons" |
| 5 | **Click "Cancel"** to close. | Pop-up closes |

### 3.4 — Forgetting to Select a Team

| Step | What to do | You should see |
|---|---|---|
| 1 | Go to the **Team** dropdown at the top of the page. | Currently shows "Team A" (or whatever you picked) |
| 2 | Click the Team dropdown and select the **blank/empty option** at the very top. | Dropdown shows nothing (no team selected) |
| 3 | Find a **gray** machine (e.g. **M6**) and click it. | Pop-up opens with "First check" warning |
| 4 | Type **10** in Allocated, **10** in Remaining, **0** in Wasted. | Numbers appear |
| 5 | **Click "Save & Close".** | ❌ **RED error:** "Select your team" |
| 6 | **Click "Cancel"** to close. | Pop-up closes |
| 7 | **IMPORTANT:** Set your Team back to **"Team A"** (or your correct team) before continuing. | Dropdown shows "Team A" |

---

## Section 4: Machine Colors

### 4.1 — Machine Turns Red for High Waste

**Background:** We need to check a machine and make a LOT of waste, so it turns red.

| Step | What to do | You should see |
|---|---|---|
| 1 | Find **M2** in the grid (it should be gray since we haven't checked it). | Gray button |
| 2 | **Click M2.** | Pop-up opens with "First check" warning |
| 3 | Type **100** in Allocated, **50** in Remaining, **40** in Wasted. | Waste% auto-calc shows 44.44% |
| 4 | **Click "Save & Close".** | Pop-up closes |
| 5 | Look at **M2** button now. | It is **RED** (because 44.44% waste is higher than the 5% target) |

❌ **If M2 is green instead of red**, the system isn't flagging high waste correctly.

### 4.2 — Unchecked Machine Stays Gray

| Step | What to do | You should see |
|---|---|---|
| 1 | Find a machine you haven't clicked yet (e.g. M3, M4, etc.). | The button is **gray** |

---

## Section 5: Save & Next Machine

### 5.1 — Using "Save & Next Machine" to Move Through Machines Quickly

**How it works:** "Save & Next Machine" always opens the **next machine in numbered order** (e.g., M3 → M4 → M5), regardless of round or whether it's already been checked. It closes when you reach the last machine.

| Step | What to do | You should see |
|---|---|---|
| 1 | Find the machine buttons in the grid. Some are green (already checked), some gray (never checked). | Mixed colors |
| 2 | **Click any machine** — for example, click the **first green machine** (M3). | Pop-up opens showing its previous check |
| 3 | Type **100** in Allocated, **95** in Remaining, **2** in Wasted. | Numbers appear |
| 4 | **Click "Save & Next Machine"** (the middle button). | Pop-up closes briefly, then a NEW pop-up opens for the **next machine in order** (M4) |
| 5 | You don't need to enter data. Just **click "Cancel"** to close. | Pop-up closes, you're back at the grid |
| 6 | Now **click the very last machine** in the grid (highest number, e.g. M19). | Pop-up opens |
| 7 | Type **50** in Allocated, **50** in Remaining, **0** in Wasted. | Numbers appear |
| 8 | **Click "Save & Next Machine"**. | The check saves, then the pop-up **just closes** (because M19 is the last machine — no more to advance to) |
| 9 | Look at the unchecked badge at the top right. | Shows the count of machines not yet touched this shift |

---

## Section 6: The Report Page

### 6.1 — Opening the Report and Seeing Summary Numbers

| Step | What to do | You should see |
|---|---|---|
| 1 | Click **"Carton Waste Report"** in the left menu. | Report page opens with filters at the top |
| 2 | Look at the **Date** box. | It should show today's date |
| 3 | Look at the **Shift** dropdown. | It should match the current shift (DAY or NIGHT) |
| 4 | Click **"Generate Report"**. | Below the filters, data appears |

❌ **If you see "No records found"** but you just entered data, check that the Date and Shift match your current shift.

| 5 | Look at the **four gray boxes** at the top. | They show: Total Allocated, Total Used, Total Wasted, Waste % |
|---|---|---|
| 6 | Check that the numbers make sense. | Total Allocated should be the sum of all the "Allocated" numbers you entered. Waste % is calculated from all the data |

⚠️ **If Waste % is shown in red**, it means overall waste is above 5% (the target).

### 6.2 — The Waste % by Machine Chart

| Step | What to do | You should see |
|---|---|---|
| 1 | Look below the summary boxes. | A **horizontal bar chart** titled "Waste % by Machine" |
| 2 | Read the labels on the left side. | Machine names like M1, M2, M3, etc. |
| 3 | Look at the bar colors. | Green bars = good (under 5%), Orange bars = warning (5-7.5%), Red bars = bad (over 7.5%) |
| 4 | **Hover your mouse** over any bar. | A small box pops up showing the exact waste percentage, total used, and total wasted |

### 6.3 — The Waste Trend Chart

| Step | What to do | You should see |
|---|---|---|
| 1 | Find the chart titled **"Waste Trend Over Rounds"**. | A line chart with colored lines |
| 2 | Read the legend at the top or side. | Each colored line represents a different machine |
| 3 | Look at the bottom (X-axis). | Labels: R1, R2, R3... (each round number) |
| 4 | Look at the left side (Y-axis). | Waste percentage from 0% to 100% |

### 6.4 — Cross-Shift Comparison

| Step | What to do | You should see |
|---|---|---|
| 1 | Find the chart titled **"Cross-Shift Comparison"**. | A bar chart with up to 14 bars |
| 2 | Look at the labels below each bar. | Shows shift and date like "DAY 6/16", "DAY 6/17" |
| 3 | Find the bar for the current shift. | It has a **gold border** around it |
| 4 | Look at the text next to the chart title. | Shows "↓ Improving", "↑ Worsening", or "→ Stable" |

### 6.5 — Shift Comparison Table

| Step | What to do | You should see |
|---|---|---|
| 1 | Find the table titled **"Shift Comparison"**. | A table with columns: Shift, Allocated, Used, Wasted, Waste %, vs Prev |
| 2 | Look at the **"vs Prev"** column. | Each row shows a number like "-0.85% ↓" (improvement) or "+1.20% ↑" (worsening) |
| 3 | Find the row for today's shift. | It has a blue highlight and a "←" mark |
| 4 | Look at the very first row's "vs Prev". | If there's no previous data, it shows "—" |

### 6.6 — Per-Machine Breakdown Table

| Step | What to do | You should see |
|---|---|---|
| 1 | Find the table titled **"Per-Machine Breakdown"**. | Table with: Machine, Line, Checks, Allocated, Used, Wasted, Waste % |
| 2 | Check that each machine you checked has a row. | Machine names in the left column |
| 3 | Look at the **last row**. | A bold "Total" row with all numbers added up |

### 6.7 — Round-by-Round Detail Table

| Step | What to do | You should see |
|---|---|---|
| 1 | Find the table titled **"Round-by-Round Details"**. | A table with every single check you made, one per row |
| 2 | Check that your first check appears. | Shows date, shift, your team, machine, round 1, allocated=200, etc. |
| 3 | Check that your second check on M1 appears. | Shows round 2, allocated=150, etc. |

### 6.8 — Exporting to CSV

| Step | What to do | You should see |
|---|---|---|
| 1 | Look at the top right of the report area. | Two buttons: "Print" and "Export CSV" |
| 2 | **Click "Export CSV"**. | A file downloads to your computer |
| 3 | Open the downloaded file in **Notepad** or **Excel**. | It has columns: Date, Shift, Team, Machine, Line, Round, Allocated, Used, Wasted, Waste %, CheckedBy, CheckedAt |
| 4 | Count the number of rows (not counting the header row). | Should match the number of checks you did |

### 6.9 — Printing

| Step | What to do | You should see |
|---|---|---|
| 1 | **Click "Print"**. | Your browser's print dialog box opens |
| 2 | Look at the **Layout** option in print settings. | Should say "Landscape" (wider than tall) |
| 3 | **Do NOT actually print.** Click **Cancel** to close the dialog. | Print dialog closes |

---

## Section 7: Offline Mode (No Internet)

### 7.1 — Saving a Check While Offline

| Step | What to do | You should see |
|---|---|---|
| 1 | **Disconnect from the internet.** You can: Turn off Wi-Fi, or unplug the ethernet cable. | The page may show a banner or indicator that you're offline |
| 2 | Go to **Carton Waste Tracking** page. | |
| 3 | Click a machine that's still gray/not checked. | Pop-up opens |
| 4 | Type **50** in Allocated, **45** in Remaining, **2** in Wasted. | Numbers appear |
| 5 | **Click "Save & Close".** | The check saves. You may see a message "Saved Offline!" |
| 6 | Look at the machine button. | It turns green (local update) |

### 7.2 — Reconnecting and Syncing

| Step | What to do | You should see |
|---|---|---|
| 1 | **Reconnect to the internet** (turn Wi-Fi back on). | Wait a few seconds |
| 2 | Go to **Carton Waste Report** page. | |
| 3 | Click **"Generate Report"**. | |
| 4 | Find the check you saved while offline in the Round-by-Round table. | It should appear in the list along with all other checks |

❌ **If the offline check doesn't appear**, the sync didn't work.

---

## Section 8: System Configuration (Settings)

### 8.1 — Finding Carton Waste Settings

| Step | What to do | You should see |
|---|---|---|
| 1 | Click **"System Config"** in the left menu (under Administration). | System Configuration page opens |
| 2 | Look at the row of tabs near the top. | Tabs for Machines, Lines, Gram Specs, Roles, Settings, **📦 Carton Waste**, Import / Export |
| 3 | **Click "📦 Carton Waste"**. | One box: "Waste Thresholds". Team settings are now in **Global Settings** tab. |

### 8.2 — Changing the Target Waste Percentage

| Step | What to do | You should see |
|---|---|---|
| 1 | Find the box labeled **"Target Waste %"** under Waste Thresholds. | Shows a number (default is 5) |
| 2 | **Change the number** to **10**. | Box now shows 10 |
| 3 | **Click "Save Carton Waste Settings"**. | A green success message appears: "Carton waste settings saved!" |
| 4 | Go back to **Carton Waste Tracking** page. | |
| 5 | Look at the machine you checked earlier that had high waste (M2 with 44.44%). | It was red before — it might still be red because 44.44% > 10% too |

### 8.3 — Changing Team Names (Now in Global Settings)

| Step | What to do | You should see |
|---|---|---|
| 1 | Go to **System Config → ⚙️ Global Settings**. | |
| 2 | Scroll to **"Packaging Teams"** card. | Shows Team Labels and Default Team inputs |
| 3 | Find the **"Team Labels"** text box. | Shows "A, B, C" |
| 4 | Change it to **"Alpha, Bravo, Charlie"**. | Box shows "Alpha, Bravo, Charlie" |
| 5 | Find the **"Default Team"** box. | Shows "A" |
| 6 | Change it to **"Alpha"**. | Box shows "Alpha" |
| 7 | **Click "Save All Settings"**. | Green success message |
| 8 | Go to **Carton Waste Tracking** page. | |
| 9 | Click the **Team dropdown**. | Shows "Alpha", "Bravo", "Charlie" instead of "A", "B", "C" |
| 10 | **IMPORTANT:** Set the team back to **"Alpha"** (or whatever makes sense). | |

---

## Section 9: Math Verification (For Testers Who Like Numbers)

### 9.1 — Checking the Formula by Hand

**Instructions:** For this test, you'll need a calculator. Do the following checks and verify the numbers match.

| Step | What to do | Expected Math |
|---|---|---|
| 1 | Check a machine. Enter: Allocated=100, Remaining=80, Wasted=5 | **Used = 0 + 100 - 80 = 20** (because no previous check, so previous remaining = 0). **Waste% = 5 ÷ (20+5) × 100 = 20.00%** |
| 2 | Check the SAME machine again. Previous check had Remaining=80. Enter: Allocated=50, Remaining=40, Wasted=2 | **Used = 80 + 50 - 40 = 90**. **Running Used = 20 + 90 = 110**. **Running Waste% = (5+2) ÷ (110+7) × 100 = 6.09%** |

### 9.2 — Running Totals Over Multiple Rounds

| Step | What to do | Expected Accumulated Numbers |
|---|---|---|
| 1 | Machine M5: Round 1 — Alloc=200, Remain=180, Waste=5 | RunningAlloc=200, RunningUsed=20, RunningWaste=5, RunningWaste%=20.00% |
| 2 | Round 2 — Alloc=150, Remain=120, Waste=3 | RunningAlloc=350, RunningUsed=230, RunningWaste=8, RunningWaste%=3.36% |
| 3 | Round 3 — Alloc=100, Remain=60, Waste=2 | RunningAlloc=450, RunningUsed=400, RunningWaste=10, RunningWaste%=2.44% |

---

## Section 10: Edge Cases (Unusual Situations)

### 10.1 — Night Shift After Midnight

**Note:** This test needs the computer clock to be set to 2:00 AM. Ask IT to help.

| Step | What to do | You should see |
|---|---|---|
| 1 | Have someone set the computer's clock to **2:00 AM**. | |
| 2 | Go to **Carton Waste Tracking** page. | |
| 3 | Look at the header. | Shift shows **"NIGHT"** and the date shows **yesterday's date** |

### 10.2 — Zero Everything (Machine Never Ran)

| Step | What to do | You should see |
|---|---|---|
| 1 | Click a new/gray machine. | Pop-up opens with "First check" warning |
| 2 | Type **0** in Allocated, **0** in Remaining, **0** in Wasted. | Auto-calc shows: Used = 0, Waste% = 0.00% |
| 3 | **Click "Save & Close".** | Saves normally, machine turns green |

### 10.3 — Two People Checking the Same Machine

**Note:** You need TWO people logged in on TWO different computers/phones.

| Step | Person A | Person B | Expected |
|---|---|---|---|
| 1 | Open M1's pop-up (but don't save yet) | Open M1's pop-up (but don't save yet) | Both see Previous Check data |
| 2 | Enter Alloc=100, Remain=80, Waste=2 | (waiting) | |
| 3 | Click **"Save & Close"** | | Saves as Round N+1 |
| 4 | | Enter Alloc=50, Remain=40, Waste=1 | Person B's Previous Check now shows Person A's data (if they refresh/reopen) |
| 5 | | Click **"Save & Close"** | Saves as Round N+2 |

✅ **Expected:** Both checks saved. M1 has two new rounds.

---

## Section 11: Regression Tests (Making Sure Nothing Else Broke)

### 11.1 — Powder Density Still Works

| Step | What to do | You should see |
|---|---|---|
| 1 | Click **"Powder Density Tests"** in the left menu (under Quality Control). | Page loads normally |
| 2 | Click a machine, enter a test, save it. | Saves normally, grid updates |

### 11.2 — Empty Silos Still Works

| Step | What to do | You should see |
|---|---|---|
| 1 | Click **"Report Empty Silos"** in the left menu. | Page loads, machines visible |
| 2 | Click a machine, mark it empty. | Machine turns red |

### 11.3 — QC Reports Still Works

| Step | What to do | You should see |
|---|---|---|
| 1 | Click **"QC Reports"** in the left menu. | Page loads, generate a report, data shows |

### 11.4 — Navigation (All Other Menu Items)

| Step | What to do | You should see |
|---|---|---|
| 1 | Click each item in the left menu, one by one. | Every page loads without errors |

---

## Summary of What to Tell Your Manager

| If this happens... | It means... | Tell your manager... |
|---|---|---|
| "Carton Waste Tracking" doesn't appear in menu | Your account doesn't have the right role | "I need prod_staff role to access Carton Waste" |
| Machine button stays gray after saving | Save failed (check for errors) | "Machine M[X] won't save" |
| Red error message appears when saving | Validation caught a mistake | (Just fix the numbers and retry) |
| Offline check didn't appear after reconnecting | Sync failed | "Offline carton check didn't sync" |
| Report shows wrong numbers | Math error in calculation | "Carton Waste Report totals don't add up" |
| Chart looks empty or weird | No data or rendering issue | "Carton Waste chart is blank" |
| Any error message pops up | Something went wrong | Screenshot it and send to manager |

---

## Quick Reference: What the Buttons Do

| Button | What happens |
|---|---|
| **Cancel** | Closes the pop-up WITHOUT saving anything you typed |
| **Save & Next Machine** | Saves the current machine check, then OPENS the next machine in numbered order (closes on the last machine) |
| **Save & Close** | Saves the current machine check, then closes the pop-up |
| **Generate Report** | Fetches and shows all data for the selected date/shift/filters |
| **Export CSV** | Downloads a file you can open in Excel |
| **Print** | Opens your browser's print dialog |
