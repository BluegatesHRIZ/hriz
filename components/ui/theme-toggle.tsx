"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { flushSync } from "react-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()

  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = resolvedTheme === "dark" ? "light" : "dark"
    // Going light: circle expands out from the click. Going dark: circle contracts in.
    const expanding = next === "light"

    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> }
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (!doc.startViewTransition || reduce) {
      setTheme(next)
      return
    }

    const root = document.documentElement
    const x = e.clientX
    const y = e.clientY
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )

    // Feed the click point + radius to the CSS keyframes, then pick a direction.
    root.style.setProperty("--vt-x", `${x}px`)
    root.style.setProperty("--vt-y", `${y}px`)
    root.style.setProperty("--vt-r", `${endRadius}px`)
    root.classList.add(expanding ? "vt-expand" : "vt-contract")

    const transition = doc.startViewTransition(() => {
      flushSync(() => setTheme(next))
    })

    transition.finished.finally(() => {
      root.classList.remove("vt-expand", "vt-contract")
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={cn(className)}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
