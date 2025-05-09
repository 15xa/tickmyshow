"use client";
import React, { useState, useMemo } from "react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { IDL, PROGRAM_ID, Tickmyshow } from "../anchor/setup";
import WalletMultiButton from "../components/walletbutton";

type FetchProps = {
  program: Program<Tickmyshow> | null;
  eventAccount: any;
  eventPda: PublicKey | null;
  setEventAccount: (evt: any) => void;
  setEventPda: (pda: PublicKey) => void;
};

const FetchPdakey = ({
  program,
  eventAccount,
  eventPda,
  setEventAccount,
  setEventPda,
}: FetchProps) => {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = async () => {
    if (!program) {
      setError("Program not ready");
      return;
    }
    try {
      const pubkey = new PublicKey(input);
      const account = await (program as any).account.event.fetch(pubkey);
      setEventPda(pubkey);
      setEventAccount(account);
      setError(null);
    } catch {
      setError("Invalid PDA or event not found");
      setEventAccount(null);
      setEventPda(null as any);
    }
  };

  return (
    <div className="space-y-4 p-4  rounded">
      <h2 className="text-lg font-medium">Find Event</h2>
      <input
        className="w-full p-2 border rounded"
        placeholder="Enter Event PDA"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <button
        onClick={fetchEvent}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded"
      >
        Load Event
      </button>
      {error && <p className="text-red-500">{error}</p>}

      {eventAccount && eventPda && (
        <div className="p-4 bg-white text-black rounded shadow">
          <p><strong>Name:</strong> {eventAccount.name}</p>
          <p><strong>Date:</strong> {new Date(eventAccount.date.toNumber() * 1000).toLocaleString()}</p>
          <p><strong>Issued / Capacity:</strong> {eventAccount.issued.toString()} / {eventAccount.capacity.toString()}</p>
        </div>
      )}
    </div>
  );
};

export default function MintTicketsPage() {
  const [eventAccount, setEventAccount] = useState<any>(null);
  const [eventPda, setEventPda] = useState<PublicKey | null>(null);
  const [quantity, setQty] =  useState(0);

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
    return new Program<Tickmyshow>(IDL, provider);
  }, [provider]);

  const handleMint = async () => {
    if (!program || !publicKey) {
      alert("Connect wallet first");
      return;
    }
    if (!eventPda) {
      alert("Load an event first");
      return;
    }
    try {

        const lamports = await connection.getBalance(publicKey);
        const sol = lamports / LAMPORTS_PER_SOL;
        
        if (sol < 0.01) {
        
            return (<div> Insufficient Balance for this transaction!!! </div>);
          }

      const [ticketPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("ticket"), eventPda.toBuffer(), publicKey.toBuffer()],
        PROGRAM_ID
      );
      const existing = await (program as any).account.ticket.fetchNullable(ticketPDA);
      if (existing) {
        alert("You already have a ticket for this event!");
        return;
      }
      const tx = await program.methods
        .mintTicket()
        .accounts({
          ticket: ticketPDA,
          owner: publicKey,
          event: eventPda,
          systemProgram: PublicKey.default,
        })
        .rpc();

      alert(`Ticket minted!\nTX: ${tx}`);
      const updated = await (program as any).account.event.fetch(eventPda);
      setEventAccount(updated);
      console.log("tickets minted: ",tx)
      
    } catch (err: any) {
      console.error(err);
      alert("Mint failed: " + (err.message || err.toString()));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <WalletMultiButton />
      {!connected ? (
        <p>Please connect your wallet to proceed.</p>
      ) : (
        <>
          <FetchPdakey
            program={program}
            eventAccount={eventAccount}
            eventPda={eventPda}
            setEventAccount={setEventAccount}
            setEventPda={setEventPda}
          />
          {eventAccount && eventPda && (
            <>
          
            <button
              onClick={handleMint}
              className="w-full px-4 py-2 bg-green-600 text-white rounded"
            >
              Mint Ticket (Max 1)
            </button>
            </>
          )}
          {tx && <><div>your Ticket: </div> tx </>}
        </>
      )}
    </div>
  );
}
