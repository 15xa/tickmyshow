"use client";

import React, { useState, useEffect } from "react";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";

import { useAnchorProgram, mintAndFreeze } from "../anchor/setup";
import { WalletButtonClient } from "../components/walletbutton";
import MintTicketForm from "./mintform";

type TickmyshowProgram = any; 

interface EventAccountData {
  creator: PublicKey;
  name: string;
  date: BN;
  bump: number;
  capacity: number;
  issued_nfts: number;
}

const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

function getTicketPDA(
  eventKey: PublicKey,
  nftMintKey: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("ticket"), eventKey.toBuffer(), nftMintKey.toBuffer()],
    programId
  );
}

function getMetadataPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );
}

function getMasterEditionPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from("edition"),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );
}

export default function MintTicketPage() {
  const { program, wallet } = useAnchorProgram();
  const publicKey = wallet.publicKey || null;

  const [eventPdaInput, setEventPdaInput] = useState<string>("");
  const [eventPk, setEventPk] = useState<PublicKey | null>(null);
  const [eventData, setEventData] = useState<EventAccountData | null>(null);

  const [uri, setUri] = useState("");
  const [title, setTitle] = useState("");
  const [symbol, setSymbol] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  // Auto‐fill title/symbol once event is loaded
  useEffect(() => {
    if (eventData && eventPk) {
      setTitle(`${eventData.name} Ticket`);
      setSymbol(`EVT${eventData.name.slice(0, 3).toUpperCase()}`);
      setUri(`https://api.example.com/metadata/${eventPk.toBase58()}.json`);
    }
  }, [eventData, eventPk]);

  async function loadEvent() {
    if (!program) return setMessage("Connect wallet & program first");
    if (!eventPdaInput) return setMessage("Enter Event PDA");
    setLoading(true);
    try {
      const pk = new PublicKey(eventPdaInput);
      const ev: any = await (program as TickmyshowProgram).account.event.fetch(pk);
      setEventData(ev);
      setEventPk(pk);
      setMessage(`Loaded event: ${ev.name}`);
    } catch (err: any) {
      setMessage("❌ Failed to load event: " + err.message);
      setEventData(null);
      setEventPk(null);
    } finally {
      setLoading(false);
    }
  }

  async function mintAndLock() {
    if (!program || !publicKey || !eventPk || !eventData) {
      return setMessage("Wallet/event not ready");
    }
   
    if (!uri || !title || !symbol) {
      return setMessage("Fill URI, title, symbol");
    }

    setLoading(true);
    setMessage("⏳ Minting NFT…");
    try {
      const mintKeypair = Keypair.generate();
      const mintPk = mintKeypair.publicKey;
      const ata = await getAssociatedTokenAddress(mintPk, publicKey);
      const [metaPda] = getMetadataPDA(mintPk);
      const [editionPda] = getMasterEditionPDA(mintPk);
      const [ticketPda] = getTicketPDA(eventPk, mintPk, program.programId);
      const mintPubkey = mintKeypair.publicKey;

      const buyerAta = await getAssociatedTokenAddress(
        mintPubkey,
        publicKey,
        /* allowOwnerOffCurve = */ false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      // 1) Mint + Metadata + Master Edition + Ticket PDA
      const tx = await mintAndFreeze(
        program!,
        wallet.publicKey!,
        mintKeypair,
        buyerAta,
        eventPk
      );
      setMessage(`Mint+freeze successful: ${tx}`);

      // refresh issued_nfts
      await loadEvent();
    } catch (err: any) {
      setMessage("❌ Error: " + (err.message || err.toString()));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-6">
      <WalletButtonClient />
      {!wallet.connected ? (
        <div className="max-w-lg mx-auto mt-10 p-6 sm:p-8 bg-white rounded-xl shadow-lg border border-gray-200 text-center">
          <h2 className="text-3xl font-bold mb-6 text-gray-800">Mint & Lock NFT Ticket</h2>
          <p className="text-gray-600 mb-6">Connect your wallet to continue</p>
        </div>
      ) : (
        <MintTicketForm 
          eventPdaInput={eventPdaInput}
          setEventPdaInput={setEventPdaInput}
          eventData={eventData}
          uri={uri}
          setUri={setUri}
          title={title}
          setTitle={setTitle}
          symbol={symbol}
          setSymbol={setSymbol}
          loading={loading}
          message={message}
          onLoadEvent={loadEvent}
          onMintAndLock={mintAndLock}
        />
      )}
    </div>
  );
}