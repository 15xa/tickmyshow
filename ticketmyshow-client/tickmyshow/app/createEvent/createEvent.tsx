"use client";
import React, { useState, useMemo } from "react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import idl from "../anchor/idl.json";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import CreatePopup from "./createPopu";

export default function CreateEvent() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [eventPda, setEventPda] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const program = useMemo(() => {
    if (!wallet || !wallet.publicKey) return null;
    const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
    const programId = new PublicKey(idl.address);
    return new Program(idl as any, provider);

  }, [connection, wallet]);

  if (!wallet || !wallet.publicKey || !program) {
    return (
      <div className="text-center py-10">
        <p className="text-xl">Please connect your wallet to create an event.</p>
      </div>
    );
  }

  const handleCreate = async (name: string, ts: number, capacity: number) => {
    setLoading(true);
    try {
      const dateBn = new BN(ts);
      const dateBuf = dateBn.toArrayLike(Buffer, "le", 8);
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("event"), Buffer.from(name), dateBuf],
        program.programId
      );

      const signature = await program.methods
        .initEvent(name, dateBn, capacity)
        .accounts({
          event: pda,
          creator: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxSignature(signature);
      setEventPda(pda.toBase58());
    } catch (err: any) {
      const logs = err.logs ? err.logs.join("\n") : "";
      console.log(`❌ Error: ${err.message}\n${logs}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8  h-full">
      {!txSignature ? (
        <CreatePopup onSubmit={handleCreate} loading={loading} />
      ) : (
        <div className="flex flex-col items-center text-center py-10 gap-2 border border-2 border-green-400 bg-white rounded-xl shadow shadow-4 shadow-green-100">
          <p className="text-lg p-2 font-bold text-green-400 border border-gray-300 rounded-lg">Event created!</p>
          <p className="mt-2 font-bold text-green-600 my-4"> Your event PDA:<br></br> <code className="bg-green-200 rounded-xl p-2 text-xl">{eventPda}</code></p>
          <p className="mt-1 font-light text-black text-sm ">Transaction: <br></br><code>{txSignature}</code></p>
        </div>
      )}
    </div>
  );
}
