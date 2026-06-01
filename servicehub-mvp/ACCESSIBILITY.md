# Accessibility & Mobile Responsiveness Guide

This document outlines the accessibility and mobile responsiveness features implemented in ServiceHub.

## Mobile Optimization

### Touch Targets
- All interactive elements (buttons, links, inputs) have a minimum size of 44×44px
- CSS rule ensures: `button, a, input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"] { min-height: 44px; min-width: 44px; }`

### Mobile Navigation
- Hamburger menu on mobile devices (< 768px)
- Slide-out navigation panel with focus trap
- Touch-friendly navigation with large tap targets
- Automatic close on route change

### Mobile Forms
- All text inputs use `font-size: 16px` on mobile (prevents iOS zoom)
- Large, touch-friendly form controls
- Proper keyboard types (email, tel, url) for mobile keyboards

### Responsive Design
- Tested on viewports: 375px (iPhone SE), 414px (iPhone Plus), 768px (tablet), 1024px+ (desktop)
- All pages use responsive grid layouts
- Images scale appropriately for mobile screens

## Accessibility Features

### Keyboard Navigation
- Skip to main content link (hidden until focused)
- All interactive elements are keyboard accessible
- Focus trap in mobile navigation menu
- Tab order follows logical reading order

### ARIA Labels & Roles
- All interactive elements have descriptive `aria-label` attributes
- Semantic HTML elements (`<nav>`, `<main>`, `<section>`, `<header>`, `<footer>`)
- `role="main"` on main content areas
- `aria-live` regions for dynamic content announcements

### Focus Indicators
- Visible focus rings on all focusable elements: `outline: 2px solid #2563eb; outline-offset: 2px;`
- Focus indicators meet WCAG contrast requirements
- Custom focus styles that are clearly visible

### Screen Reader Support
- Descriptive alt text on all images
- Form labels properly associated with inputs
- Error messages are announced to screen readers
- Heading hierarchy (h1 → h2 → h3) is maintained

### Color Contrast
- All text meets WCAG AA contrast standards (4.5:1 for normal text, 3:1 for large text)
- High contrast mode available in accessibility settings
- Color is not the only means of conveying information

### Reduced Motion
- Respects `prefers-reduced-motion` system preference
- Accessibility setting to enable reduced motion manually
- Animations and transitions disabled when reduced motion is enabled

## Accessibility Settings

Accessible at `/settings/accessibility`:

1. **Font Size**: Small (14px), Medium (16px), Large (18px)
2. **High Contrast Mode**: Increases color contrast throughout the app
3. **Reduced Motion**: Disables animations and transitions
4. **Screen Reader Optimization**: Optimizes interface for screen readers

Settings are saved to localStorage and persist across sessions.

## Testing Checklist

### Desktop Testing
- [x] Chrome (latest)
- [x] Firefox (latest)
- [x] Safari (latest)
- [x] Edge (latest)

### Mobile Testing
- [x] iOS Safari (iPhone)
- [x] Android Chrome
- [ ] iPad Safari

### Screen Reader Testing
- [ ] NVDA (Windows)
- [ ] VoiceOver (macOS/iOS)
- [ ] JAWS (Windows)

### Keyboard Navigation
- [x] Tab through all interactive elements
- [x] Enter/Space to activate buttons and links
- [x] Escape to close modals and menus
- [x] Arrow keys for navigation in dropdowns

### Lighthouse Audit Targets
- Performance: 90+
- Accessibility: 90+
- Best Practices: 90+
- SEO: 90+

## Known Issues & Future Improvements

1. **Images**: Some images use `<img>` tags instead of Next.js `Image` component - consider optimizing
2. **Lazy Loading**: Images could be lazy-loaded for better performance
3. **Service Worker**: Consider adding PWA support for offline functionality
4. **Testing**: Need actual screen reader testing with NVDA/VoiceOver

## Implementation Details

### CSS Classes
- `.skip-link`: Skip to main content link
- `.high-contrast`: High contrast mode class
- `.reduced-motion`: Reduced motion class
- `.screen-reader-optimized`: Screen reader optimization class

### Components
- `MobileNav`: Mobile navigation component with focus trap
- `AccessibilitySettingsClient`: Accessibility settings page
- `SkipLink`: Skip to main content link component

### Global Styles
See `app/globals.css` for:
- Focus indicator styles
- High contrast mode styles
- Reduced motion styles
- Touch target size requirements
- Mobile input font size fixes

## Compliance

ServiceHub aims for WCAG 2.1 Level AA compliance:
- ✅ Perceivable (text alternatives, captions, color contrast)
- ✅ Operable (keyboard accessible, no seizures, navigable)
- ✅ Understandable (readable, predictable, input assistance)
- ✅ Robust (compatible with assistive technologies)