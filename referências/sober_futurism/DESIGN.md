---
name: Sober Futurism
colors:
  surface: '#141314'
  surface-dim: '#141314'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353435'
  on-surface: '#e5e2e2'
  on-surface-variant: '#c6c6cb'
  inverse-surface: '#e5e2e2'
  inverse-on-surface: '#313030'
  outline: '#909095'
  outline-variant: '#45474b'
  surface-tint: '#c6c6cc'
  primary: '#c6c6cc'
  on-primary: '#2f3035'
  primary-container: '#0a0c10'
  on-primary-container: '#797a7f'
  inverse-primary: '#5d5e63'
  secondary: '#ffb59a'
  on-secondary: '#5a1b00'
  secondary-container: '#ff5e07'
  on-secondary-container: '#531900'
  tertiary: '#2ae500'
  on-tertiary: '#053900'
  tertiary-container: '#011000'
  on-tertiary-container: '#178e00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e8'
  primary-fixed-dim: '#c6c6cc'
  on-primary-fixed: '#1a1c20'
  on-primary-fixed-variant: '#45474b'
  secondary-fixed: '#ffdbce'
  secondary-fixed-dim: '#ffb59a'
  on-secondary-fixed: '#370e00'
  on-secondary-fixed-variant: '#802a00'
  tertiary-fixed: '#79ff5b'
  tertiary-fixed-dim: '#2ae500'
  on-tertiary-fixed: '#022100'
  on-tertiary-fixed-variant: '#095300'
  background: '#141314'
  on-background: '#e5e2e2'
  surface-variant: '#353435'
typography:
  headline-lg:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Sora
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Sora
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Sora
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 8px
  container-padding-desktop: 40px
  container-padding-mobile: 20px
  gutter: 24px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style

The design system is anchored in a philosophy of **Sober Futurism**. It aims to evoke a sense of precision, quiet authority, and cutting-edge sophistication. The target audience consists of high-end professionals and tech-forward users who value clarity over clutter and substance over spectacle.

The aesthetic combines **Minimalism** with a restrained, professional execution of **Glassmorphism**. Surfaces are deep and immersive, utilizing high-quality translucent layers that suggest depth without sacrificing legibility. The emotional response is one of calm confidence—a digital environment that feels like a precision instrument.

## Colors

The palette is strictly dark-mode by default, emphasizing a "Graphite-Blue" core.

*   **Surface (Primary):** A deep, almost-black graphite with subtle blue undertones. This serves as the infinite canvas, providing a stable foundation for high-contrast elements.
*   **Accents (Functional):** Electric Orange is used for primary actions and urgent status indicators. Vibrant Green is reserved for success states, growth metrics, and secondary highlights.
*   **Neutrals:** Pure White is the primary choice for typography to ensure maximum accessibility. Grays are used for structural borders and secondary text to create visual hierarchy.

## Typography

The design system utilizes **Sora** exclusively. This typeface was chosen for its geometric clarity and technical DNA, which reinforces the futuristic aesthetic.

Typography should be treated with extreme contrast. Large headlines use a heavier weight and tighter letter spacing to create a sense of impact, while body text remains airy and legible. Use the `label-sm` style for metadata or micro-copy, always in uppercase with increased letter spacing to maintain a technical, "instrument-panel" feel.

## Layout & Spacing

This design system follows a **Fixed-Fluid Hybrid** grid. On desktop, content is contained within a 1280px max-width 12-column grid. On mobile, it transitions to a fluid single-column layout.

Spacing is governed by an 8px base unit. To maintain the minimalist aesthetic, use generous "Stack" spacing between major sections to allow the glass elements room to breathe. Gutters are kept consistent at 24px to provide a structured, professional rhythm. Elements should align strictly to the grid edges to emphasize the "sober" and "ordered" nature of the design.

## Elevation & Depth

Depth is conveyed through **Restrained Glassmorphism**. Instead of heavy shadows, layers are distinguished by their transparency and sub-pixel borders.

1.  **Base Layer:** The Graphite-Blue solid background.
2.  **Surface Layer:** Semi-transparent (15-20% opacity) with a backdrop blur of 20px-30px.
3.  **Active/Hover Layer:** Increased opacity or a very subtle inner glow using the accent color (Orange or Green) at 5% opacity.
4.  **Borders:** All glass elements must have a 1px solid border at low opacity (10%) in Pure White. This "hairline" border creates the illusion of a glass edge.

Shadows, if used, should be "Ambient Shadows"—extremely diffused, large radius, and zero offset, acting more like a subtle dark glow than a traditional drop shadow.

## Shapes

The shape language is defined by **Full Roundedness**. Every interactive element, container, and card uses pill-shaped or extremely soft corners. This softens the technical "coldness" of the dark palette and futuristic font, making the interface feel approachable and premium.

Containers should maintain a consistent corner radius of `rounded-xl` (1.5rem / 24px) to ensure a cohesive visual language across the entire ecosystem.

## Components

*   **Buttons:** Primary buttons are pill-shaped, solid Electric Orange with Pure White text. Secondary buttons use the "Ghost Glass" style—fully transparent with a 1px white border and backdrop blur.
*   **Cards:** Glassmorphic containers with a 1px hairline border. No heavy drop shadows; depth is achieved via the backdrop blur filter.
*   **Inputs:** Minimalist fields with only a bottom border in gray, which transitions to a full pill-shaped glass container on focus, highlighted by a subtle Electric Orange stroke.
*   **Chips:** Small, fully rounded (pill) elements. For status, use the Vibrant Green for "Active" and a muted Gray for "Inactive."
*   **Lists:** Items are separated by subtle 1px gray lines. On hover, the entire row should adopt a faint glass tint (5% white overlay).
*   **Progress Bars:** Thin, 4px height lines. The "track" is the deep background color, while the "indicator" is a glowing Vibrant Green gradient.