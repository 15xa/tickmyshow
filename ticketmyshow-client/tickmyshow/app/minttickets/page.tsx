"use client";

import React, { useState, useEffect } from "react";
import { PublicKey, SystemProgram, Keypair, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { useAnchorProgram } from "../anchor/setup"; 
import { WalletButtonClient } from "../components/walletbutton";
import { BN } from "@coral-xyz/anchor";

type TickmyshowProgram = any; // Replace with your actual program type e.g. Program<Tickmyshow>

interface EventAccountData {
  creator: PublicKey;
  name: string;
  date: BN;
  bump: number;
  capacity: number;
  issuedNfts: number;
}

const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const getTicketPDA = (
  eventKey: PublicKey,
  nftMintKey: PublicKey,
  programId: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("ticket"),
      eventKey.toBuffer(),
      nftMintKey.toBuffer(),
    ],
    programId
  );
};

// Helper function to get Metaplex Metadata PDA
const getMetadataPDA = (nftMintKey: PublicKey): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      nftMintKey.toBuffer(),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );
};

// Helper function to get Metaplex Master Edition PDA
const getMasterEditionPDA = (nftMintKey: PublicKey): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      nftMintKey.toBuffer(),
      Buffer.from("edition"),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );
};


export default function MintTicketPage() {
  const { program, wallet } = useAnchorProgram(); 
  const publicKey = wallet?.publicKey;

  const [eventPdaInput, setEventPdaInput] = useState<string>("");
  const [eventPublicKey, setEventPublicKey] = useState<PublicKey | null>(null);
  const [eventData, setEventData] = useState<EventAccountData | null>(null);
  const [nftUri, setNftUri] = useState<string>("");
  const [nftTitle, setNftTitle] = useState<string>("");
  const [nftSymbol, setNftSymbol] = useState<string>("");
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (eventData) {
      setNftTitle(`${eventData.name} Ticket`);
      setNftSymbol(`EVT${eventData.name.slice(0,3).toUpperCase()}`);
      // Suggest a URI or leave it for user input
      setNftUri(`https://api.example.com/nft/metadata/event/${eventPublicKey?.toBase58()}/ticket`);
    }
  }, [eventData, eventPublicKey]);

  const handleFetchEvent = async () => {
    if (!program) {
      setMessage("Program not loaded. Connect wallet.");
      return;
    }
    if (!eventPdaInput) {
      setMessage("Please enter an Event PDA.");
      return;
    }
    setLoading(true);
    setMessage("");
    setEventData(null);
    setEventPublicKey(null);

    try {
      const pda = new PublicKey(eventPdaInput);
      // Adjust based on how your IDL types are structured (e.g., program.account.event.fetch)
      const fetchedEvent = await (program as TickmyshowProgram).account.event.fetch(pda);
      
      // The fetchedEvent might have fields like issued_nfts. Map to camelCase if needed by EventAccountData
      setEventData({
        creator: fetchedEvent.creator,
        name: fetchedEvent.name,
        date: fetchedEvent.date, // This will be a BN
        bump: fetchedEvent.bump,
        capacity: fetchedEvent.capacity,
        issuedNfts: fetchedEvent.issuedNfts // Use directly from fetched data
      });
      setEventPublicKey(pda);
      setMessage(`Event "${fetchedEvent.name}" loaded successfully.`);
    } catch (err: any) {
      console.error("Error fetching event:", err);
      let msg = err.message || "Failed to fetch event. Make sure the PDA is correct and the event exists.";
      if (err.logs) msg += "\nProgram Logs:\n" + err.logs.join("\n");
      setMessage("❌ Error: " + msg);
      setEventData(null);
      setEventPublicKey(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMintTicket = async () => {
    if (!program || !publicKey || !eventPublicKey || !eventData) {
      setMessage("Wallet not connected, or event not loaded.");
      return;
    }

    if (eventData.issuedNfts >= eventData.capacity) {
      setMessage("❌ Error: Event is sold out!");
      return;
    }

    if (!nftUri || !nftTitle || !nftSymbol) {
      setMessage("❌ Error: Please fill in NFT URI, Title, and Symbol.");
      return;
    }

    setLoading(true);
    setMessage("Minting NFT ticket...");

    try {
      const nftMintKeypair = Keypair.generate();
      const nftMintPublicKey = nftMintKeypair.publicKey;

      const buyerAta = await getAssociatedTokenAddress(nftMintPublicKey, publicKey);
      const [metadataPDA] = getMetadataPDA(nftMintPublicKey);
      const [masterEditionPDA] = getMasterEditionPDA(nftMintPublicKey);
      const [ticketPDA] = getTicketPDA(eventPublicKey, nftMintPublicKey, program.programId);

      const tx = await (program as TickmyshowProgram).methods
        .mintNftTicket(nftUri, nftTitle, nftSymbol)
        .accounts({
          payer: publicKey,
          event: eventPublicKey,
          nftMint: nftMintPublicKey,
          nftAccount: buyerAta,
          metadata: metadataPDA,
          masterEdition: masterEditionPDA,
          ticket: ticketPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([nftMintKeypair]) // nft_mint is an init account, so its keypair must sign
        .rpc();

      setMessage(`✅ NFT Ticket minted successfully!\nTx: ${tx}\nNFT Mint: ${nftMintPublicKey.toBase58()}\nTicket PDA: ${ticketPDA.toBase58()}`);
      
      // Optionally, re-fetch event data to update issuedNfts count
      handleFetchEvent(); 

    } catch (err: any) {
      console.error("Error minting NFT ticket:", err);
      let msg = err.message || "Unknown error during minting.";
      if (err.logs) msg += "\nProgram Logs:\n" + err.logs.join("\n");
      setMessage("❌ Error: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const canMint = eventData && eventData.issuedNfts < eventData.capacity;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Mint NFT Ticket</h1>

      {!wallet || !wallet.connected ? (
        <div className="text-center py-10">
          <WalletButtonClient/>
          <p className="text-xl text-gray-700">Please connect your wallet to mint a ticket.</p>
        </div>
      ) : (
        <>
          <div className="mb-8 p-6 bg-white shadow-lg rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">1. Load Event</h2>
            <div className="mb-4">
              <label htmlFor="eventPda" className="block text-sm font-medium text-gray-700 mb-1">
                Event PDA:
              </label>
              <input
                type="text"
                id="eventPda"
                value={eventPdaInput}
                onChange={(e) => setEventPdaInput(e.target.value)}
                placeholder="Enter Event PDA (e.g., Bx...)"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                disabled={loading}
              />
            </div>
            <button
              onClick={handleFetchEvent}
              disabled={loading || !eventPdaInput}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline disabled:opacity-50"
            >
              {loading && !eventData ? "Loading Event..." : "Load Event Details"}
            </button>
          </div>

          {eventData && eventPublicKey && (
            <div className="mb-8 p-6 bg-white shadow-lg rounded-lg">
              <h2 className="text-2xl font-semibold mb-4">Event Details</h2>
              <p><strong>Name:</strong> {eventData.name}</p>
              <p><strong>Date:</strong> {new Date(eventData.date.toNumber() * 1000).toLocaleString()}</p> {/* Assuming date is Unix timestamp in seconds */}
              <p><strong>Capacity:</strong> {eventData.capacity}</p>
              <p><strong>Tickets Issued:</strong> {eventData.issuedNfts}</p>
              <p><strong>Creator:</strong> {eventData.creator.toBase58()}</p>
              <p><strong>Event PDA:</strong> {eventPublicKey.toBase58()}</p>
              {eventData.issuedNfts >= eventData.capacity && (
                <p className="text-red-500 font-bold mt-2">This event is SOLD OUT!</p>
              )}
            </div>
          )}

          {eventData && canMint && (
            <div className="p-6 bg-white shadow-lg rounded-lg">
              <h2 className="text-2xl font-semibold mb-4">2. Configure NFT Ticket</h2>
              <div className="mb-4">
                <label htmlFor="nftTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  NFT Title:
                </label>
                <input
                  type="text"
                  id="nftTitle"
                  value={nftTitle}
                  onChange={(e) => setNftTitle(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  disabled={loading}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="nftSymbol" className="block text-sm font-medium text-gray-700 mb-1">
                  NFT Symbol:
                </label>
                <input
                  type="text"
                  id="nftSymbol"
                  value={nftSymbol}
                  onChange={(e) => setNftSymbol(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  disabled={loading}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="nftUri" className="block text-sm font-medium text-gray-700 mb-1">
                  NFT Metadata URI:
                </label>
                <input
                  type="text"
                  id="nftUri"
                  value={nftUri}
                  onChange={(e) => setNftUri(e.target.value)}
                  placeholder="https://example.com/metadata.json"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  This URI should point to a JSON file following Metaplex NFT metadata standards.
                  For production, host this on Arweave/IPFS.
                </p>
              </div>
              <button
                onClick={handleMintTicket}
                disabled={loading || !canMint || !nftUri || !nftTitle || !nftSymbol}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline disabled:opacity-50"
              >
                {loading ? "Minting..." : "Mint Ticket"}
              </button>
            </div>
          )}
        </>
      )}

      {message && (
        <div className={`mt-6 p-4 rounded-md ${message.startsWith("❌") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          <p className="whitespace-pre-wrap">{message}</p>
        </div>
      )}
    </div>
  );
}