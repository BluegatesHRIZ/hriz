"use client"

import { useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex items-start relative">
      {/* Mobile Sidebar Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden fixed top-4 left-4 z-50 bg-bgc-dark-blue text-white"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Sidebar */}
      <div
        className={`
          fixed lg:static
          top-0 left-0 z-40
          h-screen
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <Sidebar />
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="overflow-y-auto h-screen flex justify-center w-full lg:ml-0">
        {children}
      </div>
    </div>
  )
}
