"use client";
import React, { useState, useEffect } from "react";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { WalletButtonClient } from "../components/walletbutton";
import { useAnchorProgram, Tickmyshow, PROGRAM_ID } from "../anchor/setup";
import { Program } from "@coral-xyz/anchor";

const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

type FetchProps = {
  program: Program<Tickmyshow> | null;
  eventAccount: any;
  eventPda: PublicKey | null;
  setEventAccount: (evt: any) => void;
  setEventPda: (pda: PublicKey | null) => void;
};

const FetchPdakey = ({ program, eventAccount, eventPda, setEventAccount, setEventPda }: FetchProps) => {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEvent = async (): Promise<void> => {
    if (!program) {
      setError("Program not ready. Please connect your wallet.");
      return;
    }
    if (!input.trim()) {
      setError("Please enter an Event PDA.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const pubkey = new PublicKey(input);
      const account = await (program as any).account.event.fetch(pubkey);
      setEventPda(pubkey);
      setEventAccount(account);
    } catch (e) {
      setError("Invalid PDA or event not found.");
      setEventAccount(null);
      setEventPda(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border border-gray-700 rounded-lg bg-gray-800 shadow-xl">
      <div><WalletButtonClient /></div>
      <h2 className="text-xl font-semibold text-white">Find Event</h2>
      <input
        className="w-full p-3 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        placeholder="Enter Event PDA"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={isLoading}
      />
      <button
        onClick={fetchEvent}
        className={`w-full px-4 py-3 font-medium rounded-md transition-all duration-300 ease-in-out
                    ${isLoading ? 'bg-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50'}`}
        disabled={isLoading}
      >
        {isLoading ? "Loading..." : "Load Event Details"}
      </button>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      {eventAccount && eventPda && (
        <div className="mt-4 p-4 bg-gray-700 text-white rounded-md shadow">
          <h3 className="text-lg font-semibold mb-2">Event Details:</h3>
          <p><strong>Name:</strong> {eventAccount.name}</p>
          <p><strong>Date:</strong> {new Date(eventAccount.date.toNumber() * 1000).toLocaleString()}</p>
          <p><strong>Issued / Capacity:</strong> {eventAccount.issued?.toString() || 'N/A'} / {eventAccount.capacity?.toString() || 'N/A'}</p>
        </div>
      )}
    </div>
  );
};

export default function MintTicketsPage() {
  const { program, provider, wallet } = useAnchorProgram();
  const connection = provider?.connection;
  const publicKey = wallet.publicKey;
  const signTransaction = wallet.signTransaction;
  const signAllTransactions = wallet.signAllTransactions;
  const connected = wallet.connected;

  const [eventAccount, setEventAccount] = useState<any>(null);
  const [eventPda, setEventPda] = useState<PublicKey | null>(null);
  const [mintedNftAddress, setMintedNftAddress] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintSuccessMessage, setMintSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setMintError(null);
    setMintSuccessMessage(null);
    setMintedNftAddress(null);
  }, [eventPda]);

  const handleMint = async (): Promise<void> => {
    if (!program || !publicKey || !signTransaction || !connection) {
      setMintError("Wallet not connected or program not initialized.");
      return;
    }
    if (!eventPda || !eventAccount) {
      setMintError("Please load an event first.");
      return;
    }

    setIsMinting(true);
    setMintError(null);
    setMintSuccessMessage(null);

    try {
      const lamports = await connection.getBalance(publicKey);
      const solBalance = lamports / LAMPORTS_PER_SOL;
      const minSolBalance = 0.03;

      if (solBalance < minSolBalance) {
        setMintError(`Insufficient SOL. Need ~${minSolBalance} SOL. Your balance: ${solBalance.toFixed(4)} SOL.`);
        setIsMinting(false);
        return;
      }

      const nftMintKeypair = Keypair.generate();
      const userNftAta = getAssociatedTokenAddressSync(nftMintKeypair.publicKey, publicKey);

      const [metadataPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(), nftMintKeypair.publicKey.toBuffer()],
        MPL_TOKEN_METADATA_PROGRAM_ID
      );
      const [masterEditionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(), nftMintKeypair.publicKey.toBuffer(), Buffer.from("edition")],
        MPL_TOKEN_METADATA_PROGRAM_ID
      );
      const [ticketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("ticket"), eventPda.toBuffer(), nftMintKeypair.publicKey.toBuffer()],
        PROGRAM_ID
      );

      const existingTicket = await (program as any).account.ticket.fetchNullable(ticketPda);
      if (existingTicket && existingTicket.nftMint) {
        setMintError("You already have an NFT ticket for this event.");
        setMintedNftAddress(existingTicket.nftMint.toBase58());
        setIsMinting(false);
        return;
      }

      const txSig = await (program.methods as any)
        .mintNftTicket("uri", "title", "symbol")
        .accounts({
          event: eventPda,
          ticket: ticketPda,
          nftMint: nftMintKeypair.publicKey,
          nftAccount: userNftAta,
          metadata: metadataPda,
          masterEdition: masterEditionPda,
          payer: publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([nftMintKeypair])
        .rpc();

      setMintSuccessMessage("NFT Ticket minted successfully!");
      setMintedNftAddress(nftMintKeypair.publicKey.toBase58());
      const updatedEvt = await (program as any).account.event.fetch(eventPda);
      setEventAccount(updatedEvt);
    } catch (err: any) {
      setMintError(`NFT Minting failed: ${err.message || err.toString()}`);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            Mint Event NFT Ticket
          </h1>
          <WalletMultiButton />
        </div>
        {!connected ? (
          <div className="p-6 bg-gray-800 rounded-lg shadow-xl text-center">
            <p className="text-lg text-yellow-400">Please connect your wallet to mint tickets.</p>
          </div>
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
              <div className="mt-6 p-4 bg-gray-800 rounded-lg shadow-xl text-center space-y-4">
                <button
                  onClick={handleMint}
                  className={`px-6 py-3 font-semibold rounded-lg transition-all
                    ${isMinting ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                  disabled={isMinting}
                >
                  {isMinting ? "Minting..." : "Mint My Ticket"}
                </button>
                {mintError && <p className="text-red-400 text-sm">{mintError}</p>}
                {mintSuccessMessage && mintedNftAddress && (
                  <div className="text-green-400">
                    <p>{mintSuccessMessage}</p>
                    <p className="break-all">NFT Mint Address: {mintedNftAddress}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
