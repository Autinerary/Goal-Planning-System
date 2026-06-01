import { ResourceCardSkeleton } from '@/components/ui/Skeleton'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <main id="main-content" className="flex-1" role="main">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Hero Section Skeleton */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16 px-4 sm:px-6 lg:px-8 mb-12 rounded-lg animate-pulse">
            <div className="max-w-7xl mx-auto">
              <div className="h-12 bg-blue-500 rounded w-3/4 mx-auto mb-4"></div>
              <div className="h-6 bg-blue-400 rounded w-1/2 mx-auto mb-8"></div>
              <div className="h-12 bg-white/20 rounded max-w-2xl mx-auto"></div>
            </div>
          </div>

          {/* Content Skeleton */}
          <div className="space-y-12">
            {/* Section 1 */}
            <section>
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6 animate-pulse"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <ResourceCardSkeleton key={i} />
                ))}
              </div>
            </section>

            {/* Section 2 */}
            <section>
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6 animate-pulse"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <ResourceCardSkeleton key={i} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}