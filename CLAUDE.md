---
description: 
alwaysApply: true
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a collection of standalone HTML-based educational applications for Arabic-speaking classrooms and cultural competitions. The project name is "السلطان" (Sultan) / "Mosabagat Thgafiah" (Cultural Competitions).

## Technology Stack

- Pure HTML5, CSS3, and vanilla JavaScript (ES6+)
- No build system, bundlers, or package managers
- All applications are self-contained single HTML files
- External CDN dependencies (only in Schedule_Arrangment.html): html2canvas v1.4.1, jsPDF v2.5.1
- Arabic RTL layout (`lang="ar" dir="rtl"`) throughout

## Running the Applications

Open any `.html` file directly in a web browser. No build step required.

## Applications

| File | Arabic Name | Purpose |
|------|-------------|---------|
| million-game.html | لعبة الأسر | Family/team competition game with wallet and bank point systems |
| mzadat.html | البرنامج التحفيزي | Student motivation system with auction mechanics and image uploads |
| 7rof.html | مسابقة الألغام | Grid-based competitive game (Minesweeper-style) for groups |
| Schedule_Arrangment.html | منصة تخطيط الأسبوع | Weekly schedule planning with PDF/image export |

## Architecture Notes

**State Management:** Each application uses global JavaScript objects/arrays for in-memory state (e.g., `students`, `families`, `S`). Data is not persisted - it is lost on page refresh.

**UI Patterns:**
- Card-based component layouts
- Sidebar + main content structure (7rof.html)
- Modal dialogs for confirmations
- CSS variables for theming (e.g., `--cell`, `--gap`, `--accent`)

**Common JavaScript Patterns:**
- Inline event handlers on elements
- DOM manipulation via `getElementById()`, `createElement()`, `appendChild()`
- Array methods: `filter()`, `reduce()`, `find()`, `forEach()`
- ES6 template literals for HTML string building

**Styling:** Embedded CSS in `<style>` tags with CSS Grid and Flexbox layouts. Dark and light theme variants exist across applications.

## Key Functions by Application

**million-game.html:**
- `addFamily()`, `createAutoFamilies()` - family management
- `addToWallet()`, `doubleWallet()`, `quadrupleWallet()` - point operations
- `zeroWallet()`, `zeroAll()` - reset operations

**mzadat.html:**
- `addStudent()`, `removeStudent()`, `resetStudent()` - student management
- `deductPoints()` - auction bidding simulation
- `updateImage()` - FileReader API for student photos (Base64 storage)

**7rof.html:**
- `buildBoards()` - game board construction
- State object `S` manages game configuration and state
- Timer system with sudden death mode

**Schedule_Arrangment.html:**
- PDF/image export using html2canvas and jsPDF
