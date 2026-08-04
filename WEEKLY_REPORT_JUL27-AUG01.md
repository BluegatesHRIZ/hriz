# Weekly Progress Report

## Payroll System — Build Week

**27 July – 1 August 2026**

---

## What this week was about

The company's payroll has been running on an old system for years. That system works, but **nobody documented how it calculates anything** — no specification, no formulas written down, no notes. The only record of how pay is worked out is the old system itself and the payslips it has already produced.

This week was about building a **new payroll system from scratch** that produces exactly the same numbers as the old one — so it can be safely replaced without a single employee's pay changing by a centavo.

### The finished result this week

| Delivered | What it does |
|---|---|
| A complete payroll calculator | Salary, overtime, leave, government deductions, tax, net pay |
| A full screen interface | Create a payroll run, review it, approve it, or reverse it |
| An automatic checking tool | Re-calculates 12 real past payrolls and proves the numbers match |
| 95 automated tests | Run in seconds, catch mistakes before anyone sees them |
| 2 serious bugs caught | Found *before* going live — details below |

---

# Monday 27 July

## Working out what the old system actually does

Before writing a single line, we had to answer one question: **what are the correct numbers supposed to be?**

The only reliable source was the payroll history in the database. But that history is messy.

There were **47 payroll runs** stored. We went through all of them and sorted out which could be trusted.

| Runs | Status | Verdict |
|---|---|---|
| **12** | Properly finalised and approved | ✅ **Trustworthy — use these** |
| 10 | Half-finished drafts | ❌ Ignore |
| 25 | Cancelled / voided | ❌ Ignore |

This mattered a lot. The drafts and cancelled runs contain **contradictory figures** — the same employee appears with a monthly salary of ₱16,515 in one run and ₱8,257.50 in another.

If we'd treated all 47 as correct, we would have spent the week trying to match numbers from somebody's abandoned experiments years ago, and the new system would have been wrong.

### The pay component list

We also mapped the company's master list of everything that can appear on a payslip — salary, overtime, allowances, loans, and so on.

Each item carries a flag saying whether it counts toward taxable income. It turned out this flag is set on **deductions as well as earnings**, which was confusing at first — until it became clear it doesn't mean *"is this an earning"*, it means *"does this affect the tax calculation."*

**Counts toward tax:** Salary · Overtime · Allowance · De Minimis · Absences · Late · Undertime · SSS · PhilHealth · Pag-IBIG

**Does not:** Reimbursements · Commission · COLA · Telco Allowance · Co-op · Charges · Personal Loans

So a loan repayment doesn't reduce your taxable pay, but an absence does. That's a sensible rule — and someone has clearly been maintaining it deliberately, because COLA and Telco Allowance were specifically marked tax-exempt.

---

# Tuesday 28 July

## Settling the daily rate question

Everything in payroll depends on one number: **an employee's daily rate.** Absences, late deductions, overtime and undertime are all priced off it.

The client's own sample spreadsheet offered **three different ways** of calculating it, and they didn't agree with each other. They all boiled down to a single question:

> **How many working days are there in a year — 313 or 312?**

We didn't guess. We took a real, already-approved payslip and worked backwards from it.

**Employee 000010 — payslip PR052025104**

```
Annual salary ÷ 313 days   =   ₱633.16 per day
```

That employee's payslip shows a deduction of ₱1,187.18.

```
₱1,187.18 ÷ ₱633.16   =   1.875 days
```

**Exactly 1.875 days.** A clean, sensible number — one and seven-eighths days of absence.

We tried the alternatives — 312, 314, 365 and 26. **Every single one produced a messy, meaningless result.**

So the answer is **313**, which makes sense: 365 days minus the 52 Sundays. A six-day working week.

Importantly, the new system **reads this number from the company's settings** rather than having it typed permanently into the code. If the company ever moves to a five-day week, that's a settings change, not a developer job.

One further decision made here matters more than it sounds: the system now **rounds only once, right at the end.** The old spreadsheet rounded at every step, and those tiny roundings pile up into visible centavo differences. Rounding once keeps the new figures matching the old ones perfectly.

---

# Wednesday 29 July

## Catching a serious problem before it went live

This was the most valuable day of the week.

### The bug: unpaid leave was going to get paid

The system that processes attendance credits leave onto an employee's timesheet as **hours worked**, so they aren't marked absent.

But it does this **without ever checking whether that leave is paid or unpaid.** It doesn't look at the paid/unpaid field at all.

Which means if the new payroll system had simply trusted the attendance records — the obvious, natural thing to do — then:

> **Every unpaid leave day in the company would have been paid out.**

Depending on how much unpaid leave staff take, that is a real and recurring overpayment, every single payroll, quietly and invisibly.

**Fixed.** Payroll now goes back to the leave records themselves to check paid versus unpaid, and only pays what should be paid. This is the one deliberate exception to how the system otherwise reads attendance, and it's documented in the code so nobody undoes it later.

### The second problem: impossible data already in the system

While fixing the above, we found leave records that are **mathematically impossible:**

```
Paid days:  -11        Unpaid days:  13
...on a leave application covering only 2 days.
```

A **negative** number of paid days. This appears to be how the old system recorded someone over-drawing their leave credits — it let the balance go negative instead of stopping at zero.

Left unhandled, records like this would have made the payroll calculation produce nonsense.

**Fixed.** The new system treats any negative paid-leave balance as zero and treats the whole application as unpaid. That's the **safe direction** — it will never accidentally over-pay someone because of a bad record.

### Overtime and premium pay

The attendance system tracks **31 different categories** of premium hours — overtime, night shift, rest day, regular holiday, special holiday, and all the combinations. Each has its own multiplier.

We found the multiplier table mixes two different kinds of number, which looked like an error but isn't:

| Type | Example | Meaning |
|---|---|---|
| Full replacement | Overtime `1.25` | The hour is paid at **125% of normal** |
| Top-up only | Night differential `0.10` | Adds **10% on top** of pay already received |

Both are now handled correctly.

### Speed improvements

Added **9 database indexes** — the technical equivalent of adding an index to the back of a reference book. Payroll and attendance reports touch a very large number of records, and without these the system has to scan everything every time. Reports and payroll runs are noticeably faster as a result.

---

# Thursday 30 July

## Government deductions — matched to the exact centavo

This is the highest-risk part of any Philippine payroll: **SSS, PhilHealth, Pag-IBIG and withholding tax.** Get these wrong and it isn't just an unhappy employee, it's a compliance problem.

There was **no documentation** for how the old system calculated any of them. Every formula was reverse-engineered from approved payslips, then verified against real employees.

**Employee 000008 — monthly ₱30,000**

| Deduction | Employee | Employer | Result |
|---|---|---|---|
| SSS | ₱1,500.00 | ₱3,030.00 | ✅ Exact match |
| PhilHealth | ₱750.00 | ₱750.00 | ✅ Exact match |
| Pag-IBIG | ₱200.00 | ₱200.00 | ✅ Exact match |
| Withholding Tax | ₱319.95 | — | ✅ Exact match |

**Employee 000009 — monthly ₱31,000**

| Deduction | Employee | Employer | Result |
|---|---|---|---|
| SSS | ₱1,550.00 | ₱3,130.00 | ✅ Exact match |
| PhilHealth | ₱775.00 | — | ✅ Exact match |
| Pag-IBIG | ₱200.00 | — | ✅ Exact match |
| Withholding Tax | ₱383.70 | — | ✅ Exact match |

> **Every figure matches the live system exactly. Not "close" — identical.**

One complication worth noting: some government contribution tables in the database have **misleading column names** — fields labelled one thing that actually contain something else entirely. We identified which fields hold real money and which are unreliable, and the system now only trusts the verified ones.

The contribution rate tables are also **read from the database, not built into the code.** When the government updates SSS or PhilHealth rates — which happens regularly — that becomes a data update rather than a software release.

**30 automated tests** were written for this area alone, so any future change that breaks a government calculation is caught immediately.

---

# Friday 31 July

## Assembling the full payroll run

With every individual calculation proven, Friday was about wiring them into a single process that turns a pay period into finished payslips.

### The order of calculation

Worked out from real approved payroll, not chosen for convenience:

```
1.  Basic pay             from the employee's salary record
2.  Time deductions       absences, late, undertime
                          (paid leave cancels absences,
                           unpaid leave does not)
3.  Premium pay           overtime, night, holidays, rest days
4.  Government deductions SSS, PhilHealth, Pag-IBIG
5.  Loans & advances      instalments, then adjustments
6.  Payslip lines         each marked taxable or non-taxable
7.  Withholding tax       calculated from the taxable lines
8.  Net pay               what actually lands in the bank
```

That order isn't arbitrary. Tax has to be calculated *after* the payslip lines are built, because the taxable amount is derived from them. Getting the sequence wrong produces wrong tax.

### One deliberate improvement over the old system

The old system **ignored the taxable/non-taxable flags entirely** and applied a flat rule to everything. The new system respects them properly.

This is a small change in money — a few pesos per payslip — but it is a **correctness fix**, and it's flagged here because it's the one place where the new system intentionally differs from the old.

The old behaviour can still be switched back on with a single setting, which is exactly how the checking tool is still able to reproduce historical payroll perfectly.

### Approving and reversing runs

The full lifecycle is now in place.

| Stage | What it means | Reversible? |
|---|---|---|
| **Draft** | Calculated, awaiting review | ✅ Recalculate as often as you like |
| **Posted** | Approved and finalised | ⚠️ Requires an explicit un-post |
| **Un-posted** | Approval reversed | Rolls back loan balances and YTD totals |

Approving a run also advances loan balances and updates year-to-date figures. Reversing it **properly undoes all of that** — it isn't a status flag being flipped, it's a genuine reversal.

Crucially, the new system writes into **the same tables the old one used.** The existing payslip viewer, and anything else built on top of payroll data, keeps working with no changes at all.

---

# Saturday 1 August

## The screens — and the proof

### What people will actually use

| Screen | Purpose |
|---|---|
| **Payroll Run Manager** | See all runs, their status, create new ones |
| **Run Payroll** | Set up a period, choose employees, calculate |
| **Payroll Register** | Full company-wide view of a run before approving |
| **Payslip Detail** | Line-by-line breakdown for one employee |
| **Pay Components** | Manage the master list of pay items |

### The checking tool

This is what makes the whole week defensible.

We built an automated tool that:

1. Pulls **12 real, already-approved payroll runs** from the live database
2. Re-calculates every one of them from scratch using the new engine
3. Compares the results **line by line, employee by employee**
4. Reports any difference, however small

> **It is read-only. It cannot modify, delete or write anything to the live database.**

This was a deliberate safety requirement — the live database is shared and in active use, so the tool was built so that it is *incapable* of causing damage even if run by mistake.

It can be run at any time, by anyone, with a single command. It isn't a one-off test that happened in a meeting once — it's **permanent, repeatable evidence** that the new system agrees with the old one.

---

## The design decision behind all of this

The payroll calculations were built to be **completely separate from the database.**

In practice this means the maths can be run two entirely different ways: through the live web application, and through the independent checking tool — using different underlying technology in each case.

**Both paths run identical calculations.**

Without this, "the new system matches the old one" would be a *claim*. With it, it's something anyone can verify by running one command.

---

## Week totals

| Measure | Result |
|---|---|
| Automated tests written | **95** |
| Past payroll runs verified against | **12** |
| Accuracy vs. live system | **Exact — to the centavo** |
| Serious bugs caught before go-live | **2** |
| New screens | 5 |
| Database speed improvements | 9 indexes |
| Total code written | ~6,500 lines |

---

## Two things that need a decision

### 1. Overtime rules need client confirmation

Everything else this week was verified against real approved payroll. **Overtime is the exception — and not through any lack of effort.**

None of the 12 approved payroll runs contain any calculated overtime. The only overtime figure anywhere in the database is a flat amount typed in manually on a run that was later **cancelled**. The client's own sample timesheet week also contains no overtime at all.

**There is simply nothing in the history to check overtime against.**

The calculations are built to the plain reading of the company's own overtime rate table, and they are correct on that basis. But before the first live payroll that includes overtime, **the client should confirm the multipliers are being interpreted as intended.** This is a five-minute conversation and worth having.

### 2. The work isn't backed up yet

All ~6,500 lines currently exist only on the development machine — they haven't been committed to version control.

**This should be done immediately.** Until it is, a single mistake loses the entire week.

---

*Report generated 4 August 2026*
