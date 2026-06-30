"use client"

import { useState, useCallback, useEffect } from "react"
import useEmblaCarousel from "embla-carousel-react"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { useNews } from "@/lib/hooks/useNews"
import { CardWithHeader } from "@/components/cards/CardWithHeader"

const TYPE_GRADIENT: Record<string, string> = {
  anniversary: "from-pink-600 to-rose-500",
  birthday: "from-blue-600 to-cyan-500",
  christmas: "from-green-600 to-emerald-500",
  event: "from-purple-600 to-indigo-500",
  fireworks: "from-yellow-500 to-orange-500",
  urgent: "from-red-600 to-rose-500",
  announcement: "from-indigo-600 to-blue-500",
  regular: "from-slate-600 to-slate-700",
  default: "from-slate-600 to-slate-700",
}

function getGradient(type: string | null) {
  return TYPE_GRADIENT[type?.toLowerCase() ?? ""] ?? "from-slate-600 to-slate-700"
}

export function News() {
  const { data: announcements, isLoading } = useNews()
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true })
  const [selectedIndex, setSelectedIndex] = useState(0)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on("select", onSelect)
    return () => { emblaApi.off("select", onSelect) }
  }, [emblaApi, onSelect])

  useEffect(() => {
    if (!emblaApi || !announcements || announcements.length <= 1) return
    const id = setInterval(() => emblaApi.scrollNext(), 5000)
    return () => clearInterval(id)
  }, [emblaApi, announcements])

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  })

  return (
    <CardWithHeader
      title={currentDate}
      icon={<Calendar className="w-6 h-6" />}
      iconColor="hsl(var(--primary))"
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-[180px]">
          <p className="text-muted-foreground text-sm">Loading announcements...</p>
        </div>
      ) : !announcements || announcements.length === 0 ? (
        <div className="flex items-center justify-center h-[180px]">
          <p className="text-muted-foreground text-sm">No announcements for today</p>
        </div>
      ) : (
        <div className="relative">
          <div ref={emblaRef} className="overflow-hidden rounded-xl">
            <div className="flex">
              {announcements.map((a) => (
                <div key={a.an_id} className="flex-none w-full">
                  <div
                    className={`bg-gradient-to-br ${getGradient(a.an_type)} px-8 py-10 text-white min-h-[180px] flex flex-col justify-center`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-2">
                      {a.an_type ?? "Announcement"}
                    </p>
                    <h2 className="text-2xl font-bold leading-tight mb-2">
                      {a.an_headline}
                    </h2>
                    <p className="text-sm opacity-85 leading-relaxed">
                      {a.an_message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {announcements.length > 1 && (
            <>
              <button
                onClick={() => emblaApi?.scrollPrev()}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/35 text-white rounded-full p-1.5 transition-colors backdrop-blur-sm"
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => emblaApi?.scrollNext()}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/35 text-white rounded-full p-1.5 transition-colors backdrop-blur-sm"
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="flex justify-center gap-1.5 mt-3">
                {announcements.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => emblaApi?.scrollTo(i)}
                    className={`rounded-full transition-all duration-300 ${
                      i === selectedIndex
                        ? "w-4 h-2 bg-foreground"
                        : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </CardWithHeader>
  )
}
