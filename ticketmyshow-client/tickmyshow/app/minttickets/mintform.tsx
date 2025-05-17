"use client";

import React from "react";
import { PublicKey } from "@solana/web3.js";

interface EventAccountData {
  creator: PublicKey;
  name: string;
  date: { toNumber: () => number };
  bump: number;
  capacity: number;
  issued_nfts: number;
}

interface MintTicketFormProps {
  eventPdaInput: string;
  setEventPdaInput: (value: string) => void;
  eventData: EventAccountData | null;
  uri: string;
  setUri: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  symbol: string;
  setSymbol: (value: string) => void;
  loading: boolean;
  message: string;
  onLoadEvent: () => void;
  onMintAndLock: () => Promise<void>;
}

export default function MintTicketForm({
  eventPdaInput,
  setEventPdaInput,
  eventData,
  uri,
  setUri,
  title,
  setTitle,
  symbol,
  setSymbol,
  loading,
  message,
  onLoadEvent,
  onMintAndLock
}: MintTicketFormProps) {
  return (
    <div className="max-w-lg mx-auto mt-10 p-6 sm:p-8 bg-white rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">Mint NFT Ticket</h2>
      
      <div className="space-y-6">
        <div>
          <label htmlFor="eventPda" className="block text-sm font-medium text-gray-700 mb-1">
            Event PDA
          </label>
          <div className="flex gap-3">
            <input
              id="eventPda"
              type="text"
              value={eventPdaInput}
              onChange={(e) => setEventPdaInput(e.target.value)}
              placeholder="Paste Event PDA here"
              className="flex-grow mt-1 p-3 text-black border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              disabled={loading}
            />
            <button
              onClick={onLoadEvent}
              disabled={loading}
              className="mt-1 bg-indigo-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition"
            >
              {loading ? "Loading..." : "Load"}
            </button>
          </div>
        </div>

        {eventData && (
          <div className="p-4 rounded-md bg-gray-50 border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">Event Details</h3>
            <div className="text-sm text-gray-700">
              <p><span className="font-medium">Name:</span> {eventData.name}</p>
              <p><span className="font-medium">Date:</span> {new Date(eventData.date.toNumber() * 1000).toLocaleString()}</p>
              <p><span className="font-medium">Availability:</span> {eventData.issued_nfts} / {eventData.capacity} tickets issued</p>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full" 
                  style={{ width: `${(eventData.issued_nfts / eventData.capacity) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {eventData && (
          <>
            <div>
              <label htmlFor="metadataUri" className="block text-sm font-medium text-gray-700 mb-1">
                Metadata URI
              </label>
              <input
                id="metadataUri"
                type="text"
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                placeholder="https://example.com/metadata.json"
                className="w-full mt-1 p-3 text-black border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="nftTitle" className="block text-sm font-medium text-gray-700 mb-1">
                NFT Title
              </label>
              <input
                id="nftTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Event Ticket"
                className="w-full mt-1 p-3 text-black border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="nftSymbol" className="block text-sm font-medium text-gray-700 mb-1">
                NFT Symbol
              </label>
              <input
                id="nftSymbol"
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="TICKET"
                className="w-full mt-1 p-3 text-black border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                disabled={loading}
              />
            </div>

            <button
              onClick={onMintAndLock}
              disabled={loading || eventData.issued_nfts >= eventData.capacity || !uri || !title || !symbol}
              className={`w-full bg-indigo-600 text-white py-3 px-4 rounded-md font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition ease-in-out duration-150 ${loading || eventData.issued_nfts >= eventData.capacity || !uri || !title || !symbol ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Processing...' : 'Mint & Lock Ticket'}
            </button>
          </>
        )}

        {message && (
          <div
            className={`p-4 rounded-md mt-4 ${
              message.startsWith("❌") 
                ? "bg-red-50 text-red-700 border border-red-200" 
                : message.includes("⏳") 
                  ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                  : "bg-green-50 text-green-700 border border-green-200"
            }`}
          >
            <p className="whitespace-pre-line">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}