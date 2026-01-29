# Simple CherryTimeline

Simple CherryTimeline is a Visual Studio Code extension to create, visualize, and restore **snapshots of files** through an interactive, Git-style timeline.  
It provides a visual graph to navigate file history quickly and restore specific states without manual file selection.

---

## Features

- **Create snapshots** of the currently active file.
- **Visual timeline view** inspired by Git graphs:
  - Nodes connected by branches.
  - Zoom and pan like a canvas editor (Figma/Godot-style).
- **Snapshot details panel**:
  - Name
  - Timestamp
  - Comment
  - File content preview
- **Restore snapshots** automatically linked to their original file.
- **Delete individual snapshots** (not the entire history).
- **Keyboard shortcuts** for fast workflow.

> The timeline opens in its own editor tab, just like a normal file.

---

## Keyboard Shortcuts

| Action | Shortcut |
|------|---------|
| Create snapshot | `Ctrl + Shift + S` |
| Open timeline | `Ctrl + T`, then `Ctrl + L` |

---

## Requirements

No external dependencies.  
Works out of the box on VS Code.

---

## Extension Settings

This extension does not add custom settings yet.

---

## Known Issues

- Large files may cause slower snapshot rendering.
- Very large snapshot histories can impact timeline performance.

---

## Release Notes

### 1.0.0

- Initial release
- Snapshot creation and restoration
- Visual timeline with graph layout
- Zoom, pan, and interactive node selection

---

## Concept

CherryTimeline is designed as a **visual snapshot manager**, not a Git replacement.  
It focuses on fast iteration, experimentation, and recovery during development.

---

Enjoy Simple CherryTimeline 🍒
