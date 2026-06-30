// Motion presets — the zoom/fade choreography that makes moving between layers
// feel like zooming into a digital world. Used with motion/react.
import type { Variants, Transition } from 'motion/react'

export const EASE_ZOOM: Transition['ease'] = [0.22, 1, 0.36, 1]

// Whole-layer enter: zoom-in from slightly small + blurred → crisp.
export const zoomIn: Variants = {
  initial: { opacity: 0, scale: 0.92, filter: 'blur(6px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0.55, ease: EASE_ZOOM } },
  exit: { opacity: 0, scale: 1.04, filter: 'blur(4px)', transition: { duration: 0.3, ease: EASE_ZOOM } },
}

// Generic fade-up for cards / sections.
export const fadeUp: Variants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_ZOOM } },
}

// Staggered container for lists / grids.
export const stagger: Variants = {
  animate: { transition: { staggerChildren: 0.04 } },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: EASE_ZOOM } },
}
