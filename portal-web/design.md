# Design System: Minimalismo Funcional B2B

## 1. Definição do Estilo

- **Nome:** Minimalismo Funcional B2B
- **Tipo:** Clean, Professional, Minimalist
- **Keywords:** B2B, software, project management, clean, minimalist, efficient, professional, intuitive, data-driven, modern
- **Era:** 2026+ Produtividade Digital
- **Light/Dark:** ✓ Full / ✗ No

## 2. Paleta de Cores

- **Primárias:** Branco #FFFFFF, Cinza Claro #F8F8F8, Azul Corporativo #007BFF, Preto #212529
- **Secundárias:** Verde Suave #28A745, Amarelo Mostarda #FFC107, Vermelho Suave #DC3545, Cinza Médio #6C757D

## 3. Efeitos Visuais

Espaço em branco abundante, tipografia sans-serif limpa, ícones minimalistas, micro-interações sutis, sombras suaves, transições fluidas, foco na legibilidade e clareza.

## 4. AI Prompt Keywords

Design a clean and professional minimalist landing page for a B2B project management platform. Use: abundant white space, clean sans-serif typography, minimalist icons, subtle micro-interactions, soft shadows, fluid transitions, corporate blue accents, focus on readability and clarity.

## 5. CSS Technical

```css
background: #FFFFFF, color: #212529, box-shadow: 0 2px 4px rgba(0,0,0,0.05), border-radius: 4px, font-family: "Inter, sans-serif", transition: all 0.3s ease-in-out, .section-spacing, .icon-minimal, .card-shadow.
```

## 6. Design System Variables

```css
--white-bg: #FFFFFF, --light-grey-bg: #F8F8F8, --corporate-blue: #007BFF, --dark-text: #212529, --border-radius-sm: 4px, --font-main: "Inter, sans-serif", --shadow-subtle: 0 2px 4px rgba(0,0,0,0.05).
```

## 7. Checklist de Implementação

- ☐ Espaço em branco abundante
- ☐ Tipografia sans-serif limpa
- ☐ Ícones minimalistas
- ☐ Micro-interações sutis
- ☐ Sombras suaves
- ☐ Foco na legibilidade.

## 8. Visual Theme & Atmosphere

Minimalismo Funcional B2B — Design minimalism com b2b, software, project management. Template e prompt pronto para IA. Estilo Minimalismo Funcional B2B representa uma tendência moderna em design UI/UX web com foco em minimalism.

- Density: 3/10 — Airy
- Variance: 2/10 — Structured
- Motion: 4/10 — Subtle

## 9. Color Palette & Roles

- **Branco** (#FFFFFF) — Light surface, card backgrounds
- **Cinza Claro** (#F8F8F8) — Secondary text, borders, muted elements
- **Azul Corporativo** (#007BFF) — Accent highlight, links and focus states
- **Preto** (#212529) — Dark surface, primary background
- **Verde Suave** (#28A745) — Success states, positive indicators
- **Amarelo Mostarda** (#FFC107) — Warning states, attention indicators
- **Vermelho Suave** (#DC3545) — Error states, destructive actions
- **Cinza Médio** (#6C757D) — Secondary text, borders, muted elements

## 10. Typography Rules

- **Display / Hero:** Inter — Weight 700, tight tracking, used for headline impact
- **Body:** Inter — Weight 400, 16px/1.6 line-height, max 72ch per line
- **UI Labels / Captions:** Inter — 0.875rem, weight 500, slight letter-spacing
- **Monospace:** JetBrains Mono — Used for code, metadata, and technical values

Scale:
- Hero: clamp(2.5rem, 5vw, 4rem)
- H1: 2.25rem
- H2: 1.5rem
- Body: 1rem / 1.6
- Small: 0.875rem

## 11. Component Stylings

- **Primary Button:** Rounded (4px) shape. Accent color fill. Hover: 8% darken + subtle lift shadow. Active: -1px translate tactile press. Font weight 600. No outer glows.
- **Secondary / Ghost Button:** Outline variant. 1.5px border in muted color. Text in primary color. Hover: subtle background fill.
- **Cards:** Rounded (4px) corners. Surface background. Subtle shadow (0 2px 12px rgba(0,0,0,0.06)). 1px border stroke.
- **Inputs:** Label above input. 1px border stroke. Focus ring: 2px accent color offset 2px. Error text below in semantic red. No floating labels.
- **Navigation:** Primary surface background. Active item: accent color indicator. Font weight 500 when active.
- **Skeletons:** Shimmer animation matching component dimensions. No circular spinners.
- **Empty States:** Icon-based composition with descriptive text and action button.

## 12. Layout Principles

- **Grid:** CSS Grid primary. Max-width containment: 1280px centered with 1.5rem side padding.
- **Spacing rhythm:** Balanced. Base unit: 0.5rem (8px).
- **Section vertical gaps:** clamp(4rem, 8vw, 8rem).
- **Hero layout:** Split-screen (text left, visual right).
- **Feature sections:** Zig-zag alternating text+image rows. No 3-equal-columns.
- **Mobile collapse:** All multi-column layouts collapse below 768px. No horizontal overflow.
- **z-index contract:** base (0) / sticky-nav (100) / overlay (200) / modal (300) / toast (500).

## 13. Motion & Interaction

- **Physics:** Ease-out curves, 200-300ms duration. Smooth and predictable.
- **Entry animations:** Fade + translate-Y (16px → 0) over 420ms ease-out. Staggered cascades for lists: 80ms between items.
- **Hover states:** Subtle color shift + shadow adjustment over 200ms.
- **Page transitions:** Fade only (200ms).
- **Performance:** Only transform and opacity animated. No layout-triggering properties.

## 14. Anti-Patterns (Banned)

- No emojis in UI — use icon system only (Lucide, Heroicons)
- No decorative gradients — flat color only
- No shadows heavier than 0 2px 8px rgba(0,0,0,0.08)
- No pure black (#000000) — use off-black or charcoal variants
- No oversaturated accent colors (saturation cap: 80%)
- No 3-column equal-width feature layouts — use zig-zag or asymmetric grid
- No `h-screen` — use `min-h-[100dvh]`
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen"
- No broken external image links — use picsum.photos or inline SVG
- No generic lorem ipsum in demos

## Contexto Histórico

Estilo Minimalismo Funcional B2B representa uma tendência moderna em design UI/UX web com foco em minimalism.

## Caso de Uso

Landing pages, Websites modernas