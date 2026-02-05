"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push("/dashboard")
      } else {
        router.push("/login")
      }
    }
  }, [isAuthenticated, isLoading, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Loading...</p>
    </div>
  )
}
