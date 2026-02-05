"use client"

import { useNews } from "@/lib/hooks/useNews"
import { CardWithHeader } from "@/components/cards/CardWithHeader"
import { Calendar } from "lucide-react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

export function News() {
  const { data: announcements, isLoading } = useNews()

  const formatDate = (date: Date | null) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      weekday: "long",
    })
  }

  const currentDate = formatDate(new Date())

  const getAnnouncementTypeClass = (type: string | null) => {
    switch (type) {
      case "anniversary":
        return "bg-gradient-to-r from-pink-500 to-rose-500"
      case "birthday":
        return "bg-gradient-to-r from-blue-500 to-cyan-500"
      case "christmas":
        return "bg-gradient-to-r from-green-500 to-emerald-500"
      case "event":
        return "bg-gradient-to-r from-purple-500 to-indigo-500"
      case "fireworks":
        return "bg-gradient-to-r from-yellow-500 to-orange-500"
      default:
        return "bg-gradient-to-r from-gray-500 to-gray-600"
    }
  }

  return (
    <CardWithHeader
      title={currentDate}
      icon={<Calendar className="w-6 h-6" />}
      iconColor="#8db7ff"
      className="mb-4"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <p>Loading announcements...</p>
        </div>
      ) : !announcements || announcements.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-gray-500">No announcements</p>
        </div>
      ) : (
        <Carousel className="w-full">
          <CarouselContent>
            {announcements.map((announcement, index) => (
              <CarouselItem key={announcement.an_id}>
                <div
                  className={`rounded-lg p-6 text-white min-h-[200px] flex flex-col justify-center ${getAnnouncementTypeClass(
                    announcement.an_type || null
                  )}`}
                >
                  <h1 className="text-2xl font-bold mb-2">
                    {announcement.an_headline || "Announcement"}
                  </h1>
                  <p className="text-lg">{announcement.an_message || ""}</p>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {announcements.length > 1 && (
            <>
              <CarouselPrevious />
              <CarouselNext />
            </>
          )}
        </Carousel>
      )}
    </CardWithHeader>
  )
}
