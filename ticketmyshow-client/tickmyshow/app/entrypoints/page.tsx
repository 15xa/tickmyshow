// components/AssignEntrypointPopup.tsx
"use client";

import React, { useState } from "react";

interface AssignEntrypointPopupProps {
  onSubmit: (entrypointId: string, authority: string) => Promise<void>;
  loading: boolean;
}

export default function AssignEntrypointPopup({
  onSubmit,
  loading,
}: AssignEntrypointPopupProps) {
  const [entrypointId, setEntrypointId] = useState("");
  const [authority, setAuthority] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!entrypointId.trim() || !authority.trim()) {
      setError("Both EntryPoint ID and Authority are required.");
      return;
    }

    try {
      await onSubmit(entrypointId.trim(), authority.trim());
      setEntrypointId("");
      setAuthority("");
    } catch (e: any) {
      setError(e.message || "Assignment failed");
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 text-center">
        Assign Entrypoint
      </h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="entrypointId"
            className="block text-sm font-medium text-gray-800 mb-1"
          >
            Entrypoint ID
          </label>
          <input
            id="entrypointId"
            type="text"
            value={entrypointId}
            onChange={(e) => setEntrypointId(e.target.value)}
            className="w-full mt-1 p-3 text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            placeholder="e.g. gate01"
            disabled={loading}
            required
          />
        </div>

        <div>
          <label
            htmlFor="authority"
            className="block text-sm font-medium text-gray-800 mb-1"
          >
            Authority PublicKey
          </label>
          <input
            id="authority"
            type="text"
            value={authority}
            onChange={(e) => setAuthority(e.target.value)}
            className="w-full mt-1 p-3 text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            placeholder="Your wallet address or delegate"
            disabled={loading}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full bg-indigo-600 text-white py-3 rounded-md font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {loading ? "Assigning..." : "Assign Entrypoint"}
        </button>
      </form>
    </div>
  );
}
