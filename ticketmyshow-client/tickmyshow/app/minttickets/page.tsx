"use client";
import React, { useState, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { IDL, PROGRAM_ID, Tickmyshow } from "../anchor/setup";
import WalletMultiButton from "../components/walletbutton";

type FetchProps = {
  program: Program<Tickmyshow> | null;
  event: any;
  onSetEvent: (evt: any) => void;
  onMint: (eventData: any) => Promise<void>;
  pdaInput: any;
  setEventPda: any;
  setEventAccount: any; 
};

const FetchPdakey = ({ program, event, onSetEvent, onMint, pdaInput, setEventPda, setEventAccount }: FetchProps) => {
  const [pda, setPda] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function fetchEvent() {
    try {
      if (!program) return setError("Program not ready");
      const pubkey = new PublicKey(pda);
      const fetchedEvent = await (program as any).account.event.fetch(pubkey);
      async function fetchEvent() {
        const pubkey = new PublicKey(pdaInput);
        const acc = await (program as any).account.event.fetch(pubkey);
        setEventPda(pubkey);
        setEventAccount(acc);
      }
      onSetEvent(fetchedEvent);
      setError(null);
    } catch {
      setError("Event not found or invalid PDA");
      onSetEvent(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 justify-center items-center p-4 ">
      <div>🎟️ Mint your Tickets for an Event</div>
      <label>Enter Event PDA</label>
      <input
        type="text"
        value={pda}
        onChange={(e) => setPda(e.target.value)}
        className="w-80 p-2 border rounded"
      />
      <button
        onClick={fetchEvent}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Find Event
      </button>
      {error && <p className="text-red-500">{error}</p>}
      {event && (
        <div className="mt-4 p-4 bg-white rounded shadow w-80">
          <p><strong>Name:</strong> {event.name}</p>
          <p><strong>Date:</strong> {new Date(event.date.toNumber() * 1000).toLocaleString()}</p>
          <p><strong>Capacity:</strong> {event.capacity.toString()}</p>
          <button
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded"
            onClick={() => onMint(event)}
          >
            Get Tickets
          </button>
        </div>
      )}
    </div>
  );
};

export default function MintTicketsPage() {
    const [eventAccount, setEventAccount] = useState<any>(null);
    const [eventPda, setEventPda] = useState<PublicKey | null>(null);
  const [event, setEvent] = useState<any>(null);
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet();

  const wallet = publicKey && signTransaction && signAllTransactions
    ? { publicKey, signTransaction, signAllTransactions }
    : null;

  const provider = useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program<Tickmyshow>(IDL,  provider);
  }, [provider]);

  const handleMint = async (eventData: any) => {
    if (!program || !publicKey) {
      alert("Please connect your wallet first!");
      return;
    }
    try {
      const eventPDA = eventData.publicKey;
      const [ticketPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("ticket"), eventPda.toBuffer(), publicKey.toBuffer()],
        PROGRAM_ID
      );

      const tx = await program.methods
        .mintTicket()
        .accounts({
          ticket: ticketPDA,
          owner: publicKey,
          event: eventPDA,
          systemProgram: PublicKey.default,
        })
        .rpc();

      alert(`Minted! TX: ${tx}`);
      const updated = await (program as any).account.event.fetch(eventPDA);
      setEvent(updated);
    } catch (err: any) {
      console.error(err);
      alert("Mint failed: " + (err.message || err.toString()));
    }
  };

  return (
    <div className="p-6">
      <WalletMultiButton />
      {!connected ? (
        <p className="mt-4 text-gray-700">Please connect your wallet to proceed.</p>
      ) : (
        <FetchPdakey
          program={program}
          event={event}
          onSetEvent={setEvent}
          onMint={handleMint}
          setEventAccount
          setEventPda
          pdaInput
        />
      )}
    </div>
  );
}
