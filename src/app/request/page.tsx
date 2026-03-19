export const metadata = {
  title: 'Book a Service — Butler Garage',
  description: 'Schedule your motorcycle service at Butler Garage, Bangkok',
}

export default function RequestPage() {
  return (
    <div className="min-h-screen bg-gray-950 p-4 flex items-center justify-center">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Butler Garage</h1>
        <p className="text-gray-400 mb-8">สแกนเพื่อจอง / Scan to book</p>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          <p className="text-gray-400">
            Customer intake form (6 steps, bilingual) — coming in Phase E
          </p>
        </div>
      </div>
    </div>
  )
}
