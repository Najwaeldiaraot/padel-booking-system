import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

export const cinematicEase = [0.22, 1, 0.36, 1] as const

interface CinematicRevealProps {
  children: ReactNode
  delay?: number
}

export function CinematicReveal({ children, delay = 0 }: CinematicRevealProps) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{
        duration: reducedMotion ? 0 : 0.35,
        ease: cinematicEase,
        delay: reducedMotion ? 0 : delay,
      }}
    >
      {children}
    </motion.div>
  )
}
