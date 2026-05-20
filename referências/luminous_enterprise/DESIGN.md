---
name: Luminous Enterprise
colors:
  surface: '#14140d'
  surface-dim: '#14140d'
  surface-bright: '#3a3a32'
  surface-container-lowest: '#0e0f08'
  surface-container-low: '#1c1c15'
  surface-container: '#202019'
  surface-container-high: '#2a2a23'
  surface-container-highest: '#35352d'
  on-surface: '#e5e3d7'
  on-surface-variant: '#c7c5d1'
  inverse-surface: '#e5e3d7'
  inverse-on-surface: '#313129'
  outline: '#918f9a'
  outline-variant: '#46464f'
  surface-tint: '#bfc1ff'
  primary: '#bfc1ff'
  on-primary: '#272a62'
  primary-container: '#01003f'
  on-primary-container: '#7275b2'
  inverse-primary: '#565994'
  secondary: '#ffb77b'
  on-secondary: '#4c2700'
  secondary-container: '#e07d01'
  on-secondary-container: '#4a2500'
  tertiary: '#31e287'
  on-tertiary: '#00391d'
  tertiary-container: '#000f05'
  on-tertiary-container: '#008c4f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#bfc1ff'
  on-primary-fixed: '#11134d'
  on-primary-fixed-variant: '#3e417a'
  secondary-fixed: '#ffdcc2'
  secondary-fixed-dim: '#ffb77b'
  on-secondary-fixed: '#2e1500'
  on-secondary-fixed-variant: '#6d3a00'
  tertiary-fixed: '#5affa1'
  tertiary-fixed-dim: '#31e287'
  on-tertiary-fixed: '#00210e'
  on-tertiary-fixed-variant: '#00522c'
  background: '#14140d'
  on-background: '#e5e3d7'
  surface-variant: '#35352d'
typography:
  display-lg:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  unit: 8px
  container-padding-mobile: 1.5rem
  container-padding-desktop: 3rem
  gutter: 1.5rem
  section-gap: 4rem
---

## Brand & Style

This design system embodies a "2026 Ultra-Dark" aesthetic, merging high-performance enterprise utility with a luxury futuristic atmosphere. The brand personality is authoritative, precise, and hyper-modern, designed to evoke a sense of "command and control" for elite project teams.

The visual style is a refined evolution of **Glassmorphism**, characterized by deep backdrop blurs, multi-layered translucency, and "light-leak" accents. It utilizes a high-contrast dark interface to reduce eye strain during deep-work sessions while using vibrant neon glows to guide the user's focus toward critical actions and data points. The mood is high-value, cinematic, and engineered for speed.

## Colors

The palette is anchored by a deep midnight and graphite base, providing a "void" onto which light and data are projected.

- **Primary Accent (Deep Midnight):** A foundational, heavy-duty blue used for core grounding elements and deep-layered containers.
- **Secondary Accent (Solar Flare):** A high-energy orange used for warning states, tactical alerts, and high-priority interactions, providing a warm contrast to the cool dark environment.
- **Tertiary Accent (Cyber Emerald):** A high-visibility green used for AI features, growth indicators, and success states. It represents "intelligence and vitality."
- **Glass Surfaces:** Panels are not solid; they are translucent layers. Use a subtle 1px white border at low opacity (12%) to define edges against the dark background.
- **Functional Colors:** Cyber Emerald, Solar Flare, and Rose are used strictly for status communication, maintaining high saturation to remain legible against the dark backdrop.

## Typography

Typography in this design system is architectural and technical. 

- **Sora** is used for headlines to provide a geometric, futuristic personality.
- **Geist** serves as the workhorse for UI and body text, offering exceptional legibility and a clean, developer-centric feel.
- **JetBrains Mono** is utilized for labels, metadata, and KPI values to emphasize the "data-driven" nature of the platform.

Maintain high contrast by using the Neutral Bone White (`#FFFCF0`) for primary text and a muted variant for secondary descriptions. Use "Optical Sizing" where available to ensure crispness at small scales.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a strict 8px spatial rhythm. 

- **Desktop:** 12-column grid with generous 48px margins to allow the glass panels to "float" within the viewport. 
- **Tablet:** 8-column grid with 32px margins.
- **Mobile:** 4-column grid with 24px margins.

Components should utilize "Stack" patterns (Vertical and Horizontal) with consistent gaps of 8px, 16px, or 24px. High-density widgets should prioritize information density, reducing internal padding to 12px while maintaining external margins of 24px to prevent visual clutter.

## Elevation & Depth

Depth is the core of this design system. We do not use traditional drop shadows to signify elevation; instead, we use **Z-Axis Refraction**:

1.  **Level 0 (Base):** The deep midnight background.
2.  **Level 1 (Panels):** Glass panels with `backdrop-filter: blur(20px)` and a subtle inner glow.
3.  **Level 2 (Modals/Popovers):** Deeper blur `(40px)` and a secondary "rim light" (a 1px semi-transparent stroke) that catches light from the top-left.
4.  **Floating Accents:** Use soft, blurred radial gradients behind panels (Cyber Emerald or Solar Flare at 5-10% opacity) to create the illusion of a light source beneath the glass.

Active elements should feature an "outer glow" using the tertiary Cyber Emerald color to simulate a neon emission effect.

## Shapes

The design system uses an ultra-rounded shape language to contrast the technical, "sharp" nature of the data. 

- **Standard Components:** Buttons, inputs, and small cards use a **1rem (16px)** radius.
- **Large Containers:** Main dashboard panels and modal wrappers use a **2rem (32px)** or **3rem (48px)** radius.
- **Interactive States:** Use a "pill" shape (max radius) for tags and badges to distinguish them from larger structural elements.

## Components

### Buttons
- **Primary:** Deep Midnight background, Bone White text, and a soft Emerald outer glow on hover. High corner radius.
- **Action/Warning:** Solar Flare orange for high-urgency interactions.
- **Ghost/Glass:** Transparent background with the 1px glass border. On hover, the border opacity increases.

### Input Fields
- Glass-morphic fields with `backdrop-filter: blur(10px)`.
- Bottom-only border or full border that glows Cyber Emerald or Solar Flare when focused.
- Placeholder text in low-opacity bone white.

### KPI Widgets
- High-density layout.
- Large numerical values in **JetBrains Mono**.
- Micro-sparklines in Cyber Emerald or Solar Flare using a 2px stroke width.

### Cards & Panels
- Translucent background (`rgba(255,255,255,0.04)`).
- Subtle top-down linear gradient stroke to simulate light hitting the edge of a glass sheet.

### Data Tables
- Header rows with a darker glass tint and uppercase **JetBrains Mono** labels.
- Row separators using low-opacity lines (`#FFFFFF05`).
- Hover states that subtly brighten the entire row's glass background.