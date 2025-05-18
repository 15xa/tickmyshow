'use client';

import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="w-full bg-white shadow-md px-8 py-4 flex items-center justify-between">
      <Link href="/">
      <h1 className="text-2xl font-bold text-gray-900">TickMyShow</h1>
      </Link>

      
      <div className="flex gap-4">
        <Link href="/minttickets">
          <button className="bg-green-400 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg">
            Buy Tickets
          </button>
        </Link>
        <Link href="/createEvent">
          <button className="bg-green-400 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg">
            Create Event
          </button>
        </Link>
      </div>
    </nav>
  );
}
