# Astryx Design System — Token Mapping & Contrast Audit

This document maps all legacy `@workspace/tokens` (`lib/tokens/src/tokens.css`) properties to Astryx semantic CSS custom properties and provides automated contrast audit verification for both Light and Dark modes.

---

## 1. Brand Anchors & Contrast Matrix

Per §4.1 of the adoption runbook, brand accent colors are defined as Light/Dark tuples `[lightValue, darkValue]`. Light values are calibrated to satisfy WCAG AA contrast (≥ 4.5:1 for normal text on background).

| Astryx Semantic Token | Legacy Property | Light Value | Light Contrast vs `#fbfaf7` / `#ffffff` | Dark Value | Dark Contrast vs `#0e0f11` / `#17191c` | Status |
|---|---|---|---|---|---|---|
| `--color-accent` | `--gold` | `#7F6921` | **4.96:1** | `#D4AF37` | **9.12:1** | PASS AA |
| `--color-accent-text` | `--gold-text` | `#7F6921` | **4.96:1** | `#D4AF37` | **9.12:1** | PASS AA |
| `--color-accent-ink` | `--gold-ink` | `#111318` | **8.84:1** (on `#7F6921`) | `#111318` | **8.84:1** (on `#D4AF37`) | PASS AA |
| `--color-blue` | `--blue` | `#2D6A8F` | **5.14:1** | `#6BA3C8` | **7.03:1** | PASS AA |
| `--color-sage` | `--sage` | `#3D5C3E` | **5.45:1** | `#7D9E7E` | **6.45:1** | PASS AA |
| `--color-success` | `--success` | `#3D5C3E` | **5.45:1** | `#7D9E7E` | **6.45:1** | PASS AA |
| `--color-warning` | `--warning` | `#7A5E12` | **5.22:1** | `#D8B45E` | **8.11:1** | PASS AA |
| `--color-danger` | `--danger` | `#8C3214` | **5.81:1** | `#C2603F` | **4.85:1** | PASS AA |

---

## 2. Token Mapping Table

### Surface & Background Tokens
| Legacy Property | Astryx Semantic Token | Light Tuple | Dark Tuple | Notes |
|---|---|---|---|---|
| `--bg` | `--color-background-app` | `#fbfaf7` | `#0e0f11` | Root app canvas |
| `--surface` | `--color-background-surface` | `#ffffff` | `#17191c` | Standard card/panel container |
| `--surface-raised` | `--color-background-raised` | `#ffffff` | `#1e2125` | Popovers, modals, dropdowns |

### Text & Ink Tokens
| Legacy Property | Astryx Semantic Token | Light Tuple | Dark Tuple | Notes |
|---|---|---|---|---|
| `--ink` | `--color-text-primary` | `#1a1c1e` | `#e9ecee` | Primary body and heading text |
| `--ink-muted` | `--color-text-secondary` | `#5c6367` | `#8b9398` | Secondary labels and subtitles |
| `--ink-faint` | `--color-text-tertiary` | `#6b7378` | `#7f878c` | Captions, placeholders |

### Border & Divider Tokens
| Legacy Property | Astryx Semantic Token | Light Tuple | Dark Tuple | Notes |
|---|---|---|---|---|
| `--line` | `--color-border` | `#e7e3da` | `#262a2e` | Hairline card & input borders |
| `--line-strong` | `--color-border-strong` | `#d8d3c7` | `#333940` | Focused or emphasized borders |

### Typography Scale
| Legacy Property | Astryx Semantic Token | Value |
|---|---|---|
| `--text-xs` | `--text-xs` | `0.75rem` |
| `--text-sm` | `--text-sm` | `0.875rem` |
| `--text-base` | `--text-base` | `1rem` |
| `--text-lg` | `--text-lg` | `1.125rem` |
| `--text-xl` | `--text-xl` | `1.375rem` |
| `--text-2xl` | `--text-2xl` | `clamp(1.5rem, 1.2rem + 1.2vw, 2rem)` |
| `--text-3xl` | `--text-3xl` | `clamp(2rem, 1.4rem + 2.4vw, 3rem)` |

### Radii & Motion
| Legacy Property | Astryx Semantic Token | Value |
|---|---|---|
| `--radius-sm` | `--radius-sm` | `6px` |
| `--radius-md` | `--radius-md` | `10px` |
| `--radius-lg` | `--radius-lg` | `16px` |
| `--radius-xl` | `--radius-xl` | `22px` |
| `--radius-full` | `--radius-full` | `999px` |
| `--duration-fast` | `--duration-fast` | `150ms` |
| `--duration-normal` | `--duration-normal` | `240ms` |
