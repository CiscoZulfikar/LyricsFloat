# 🎵 LyricsFloat

<div align="center">

<img src="build/icon.png" width="128" height="128" alt="LyricsFloat Logo" style="border-radius: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />

### Sleek Floating Synced Karaoke Lyrics & Spotify Miniplayer for Windows

**Real-time synchronized lyrics, automatic Romaji & Pinyin pronunciation, and multi-language translation wrapped in a native Windows 11 frosted acrylic floating glass window.**

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/CiscoZulfikar/LyricsFloat)
[![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33.4.11-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://electronjs.org)
[![Author](https://img.shields.io/badge/Made%20by-ciszu-38bdf8?style=for-the-badge)](https://github.com/CiscoZulfikar)

</div>

---

## ✨ Features

- **🪟 Native Windows 11 DWM Hardware Rounding & Acrylic Blur:** Clean anti-aliased rounded corners and real-time frosted glass backdrop powered directly by Windows DWM. Zero black border or region clipping artifacts.
- **🎨 Dynamic Album Art Fluid Ambient Glow:** Subtly illuminates your desktop with soft ambient lighting sampled directly from the playing album cover.
- **🎤 Multi-Layered Synced Karaoke Viewport:**
  - **Dominant Original Lyrics:** High-contrast, clean typography with smooth edge feather masking.
  - **Pronunciation Sub-Text (Romaji / Pinyin / Hangul):** Instant Hepburn Romaji for Japanese (via Kuromoji), Hangul Romanization for Korean, and Tone Pinyin for Chinese.
  - **Contextual Translation Sub-Text:** Automated neural translation for foreign songs into your chosen target language.
- **🛡️ Intelligent Duplicate & Language Suppression:**
  - Songs already in your target language (e.g. English songs with English target) will never display redundant duplicate text underneath.
  - Multilingual and bilingual songs only display translations for foreign lines.
- **⏱️ Fluid Physics-Based Momentum Scrolling:** High-refresh-rate camera interpolator that glides seamlessly with the song's timing.
- **🎧 Zero-Config Spotify Sync:** Hooks directly into Windows Global System Media Transport Controls (GSMTC). Detects play, pause, track changes, and scrubber seeks automatically.
- **🎛️ Complete Customization (Settings ⚙️):**
  - **5 Color Themes:** Nordic Frost (Default), Neon Violet, Cyberpunk Cyan, Crimson Sunset, Emerald Glass.
  - **Window Opacity:** Smooth slider from `80%` to `100%`.
  - **Custom Font Sizes:** Independent sliders for Original lyrics and Sub-Text.
  - **Languages Checklist:** Choose exactly which languages you want to translate with one-click toggles and colorful vector flag badges.
  - **Window Flexibility:** Freely resizable with support for ultra-compact floating mode (down to `280px × 320px`).

---

## 📥 How to Install Using the Installer

### Option A: Download Pre-built Release (Recommended)

1. Go to the [**Releases Page**](https://github.com/CiscoZulfikar/LyricsFloat/releases).
2. Download the latest installer:
   - **`LyricsFloat Setup 1.1.3.exe`** (Standard Windows Installer Wizard)
   - *or* **`LyricsFloat-1.1.3-Portable.exe`** (Standalone zero-install executable)
3. Double-click **`LyricsFloat Setup 1.1.3.exe`** to launch the Setup Wizard.

> [!NOTE]
> **Windows SmartScreen Notice:**
> Because LyricsFloat is an open-source indie application without an expensive commercial code-signing certificate, Windows Defender SmartScreen might display a blue dialog stating *"Windows protected your PC"*.
> 
> Simply click **"More info"** and then click **"Run anyway"** to proceed with installation.

4. Follow the setup steps:
   - Choose your destination folder.
   - Choose whether to create a Desktop Shortcut and Start Menu entry.
   - Click **Install**.
5. Once installation finishes, check **"Launch LyricsFloat"** and click **Finish**!
6. **Open Spotify**, play any track, and watch your floating lyrics sync up immediately!

---

## 🛠️ Building the Installer Yourself from Source

If you prefer building the project and installer from source, you can do so in just a few commands:

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or v20+ recommended)
- Git for Windows
- Windows 10 or 11

### 2. Clone the Repository
```powershell
git clone https://github.com/CiscoZulfikar/LyricsFloat.git
cd LyricsFloat
```

### 3. Install Dependencies
```powershell
npm install
```

### 4. Run in Development Mode
```powershell
npm start
```

### 5. Build the Standalone Windows Installer
To package the application into a production NSIS installer executable:
```powershell
# Build both the Setup Wizard Installer and Portable EXE
npm run dist:all
```
*Or build only the NSIS setup wizard:*
```powershell
npm run dist
```

Once the packaging finishes, your installer will be ready in the `dist/` directory:
- 📦 `dist/LyricsFloat-Setup-1.0.0.exe` (Full NSIS Installer)
- 🚀 `dist/LyricsFloat-1.0.0-Portable.exe` (Portable Single-file EXE)

---

## 🌍 Supported Translation Languages

You can selectively enable or disable translations for any of the 13 supported languages in the Settings (`⚙️`) menu:

| Flag | Language | Romaji / Pronunciation | Translation |
| :---: | :--- | :---: | :---: |
| 🇸🇦 | **Arabic** | — | ✅ |
| 🇨🇳 | **Chinese** | ✅ Pinyin | ✅ |
| 🇫🇷 | **French** | — | ✅ |
| 🇩🇪 | **German** | — | ✅ |
| 🇬🇷 | **Greek** | — | ✅ |
| 🇮🇳 | **Hindi** | — | ✅ |
| 🇮🇩 | **Indonesian** | — | ✅ |
| 🇮🇹 | **Italian** | — | ✅ |
| 🇯🇵 | **Japanese** | ✅ Hepburn Romaji | ✅ |
| 🇰🇷 | **Korean** | ✅ Hangul Romanization | ✅ |
| 🇵🇹 | **Portuguese** | — | ✅ |
| 🇷🇺 | **Russian** | — | ✅ |
| 🇪🇸 | **Spanish** | — | ✅ |

---

## ⌨️ Controls & Shortcuts

| Control | Description |
| :--- | :--- |
| **Drag Window** | Click and drag the top header bar |
| **Resize Window** | Drag any of the window corners or edges (down to 280×320) |
| **`📌` Pin** | Toggle Always-on-Top mode |
| **`あ→a`** | Quick-toggle pronunciation / Romaji sub-text |
| **`文A`** | Quick-toggle translation sub-text |
| **`⚙️` Settings** | Open theme selector, font size sliders, opacity, and language checklist |
| **`✕` Close** | Closes the floating lyrics window |

---

## 👤 Author

**Cisco Zulfikar (ciszu)**
- GitHub: [@CiscoZulfikar](https://github.com/CiscoZulfikar)

---

## 📄 License

This project is open-source and licensed under the [MIT License](LICENSE).
