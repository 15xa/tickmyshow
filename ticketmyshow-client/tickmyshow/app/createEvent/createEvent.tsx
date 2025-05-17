"use client";
import React, { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAnchorProgram, getEventPDA } from "../anchor/setup";
import { BN } from "@coral-xyz/anchor";
import CreatePopup from "./createPopu";

export default function CreateEvent() {
  const [createdEvent, setCreatedEvent] = useState("");
  const { program, wallet } = useAnchorProgram();
  const publicKey = wallet.publicKey;
  const [loading, setLoading] = useState(false);
  const [event_pda, setpda] = useState("");

  const handleCreate = async (name: string, ts: number, capacity: number) => {
    if (!program || !publicKey) {
      alert("Please connect your wallet first!");
      return;
    }
    setLoading(true);
    try {
      const [eventPDA] = getEventPDA(name, ts);
      const tx = await program.methods
        .initEvent(name, new BN(ts), capacity)
        .accounts({
          event: eventPDA,
          creator: publicKey,
          systemProgram: PublicKey.default,
        })
        .rpc();

      alert(`✅ Event created!\nTx: ${tx}\nPDA: ${eventPDA.toBase58()}`);
      setpda(eventPDA.toBase58());
      setCreatedEvent(tx);
      
    } catch (err: any) {
      let msg = err.message || "Unknown error";
      if (err.logs) msg += "\nProgram Logs:\n" + err.logs.join("\n");
      alert("❌ Error: " + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {(wallet.connected && !createdEvent) ? (
        <CreatePopup onSubmit={handleCreate} loading={loading} />
      ) : (
        <div className="text-center py-10">
          <p className="text-xl text-black-700">Please connect your wallet to create an event.</p>
        </div>
      )}

      {event_pda && <div className="flex m-4">{event_pda}</div> }
    </div>
  );
}
