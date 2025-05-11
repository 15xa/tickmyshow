"use client";
import React, { useState, useMemo, useEffect } from "react";
import { 
  PublicKey, 
  LAMPORTS_PER_SOL, 
  SystemProgram, 
  Keypair, 
  SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, web3 } from "@coral-xyz/anchor";
import { IDL, PROGRAM_ID as TICKMYSHOW_PROGRAM_ID, Tickmyshow } from "../anchor/setup"; 
import WalletMultiButton from "../components/walletbutton";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

// Metaplex Token Metadata Program ID (constant)
const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);


type FetchProps = {
  program: Program<Tickmyshow> | null;
  eventAccount: any; // Consider defining a stricter type for your event account
  eventPda: PublicKey | null;
  setEventAccount: (evt: any) => void;
  setEventPda: (pda: PublicKey | null) => void; // Allow setting to null
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
  const [isLoading, setIsLoading] = useState(false);

  const fetchEvent = async () => {
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
      console.error("Fetch event error:", e);
      setError("Invalid PDA or event not found.");
      setEventAccount(null);
      setEventPda(null); // Clear PDA if fetch fails
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border border-gray-700 rounded-lg bg-gray-800 shadow-xl">
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
  const [eventAccount, setEventAccount] = useState<any>(null);
  const [eventPda, setEventPda] = useState<PublicKey | null>(null);
  const [mintedNftAddress, setMintedNftAddress] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintSuccessMessage, setMintSuccessMessage] = useState<string | null>(null);

  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet();
  
  const wallet = useMemo(() => {
    if (!publicKey || !signTransaction || !signAllTransactions || !connection) return null;
    return { 
        publicKey, 
        signTransaction, 
        signAllTransactions, 

        sendTransaction: async (transaction: web3.Transaction, conn: web3.Connection) => {

            const currentConnection = conn || connection;
            const { blockhash, lastValidBlockHeight } = await currentConnection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;
            const signed = await signTransaction(transaction);
            const signature = await currentConnection.sendRawTransaction(signed.serialize());
            await currentConnection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
            return signature;
    }};
  }, [publicKey, signTransaction, signAllTransactions, connection]); 
  const provider = useMemo(() => {
    if (!wallet || !connection) return null;
    return new AnchorProvider(connection, wallet as any, AnchorProvider.defaultOptions());
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program<Tickmyshow>(IDL, provider);
  }, [provider]);

  useEffect(() => {
    setMintError(null);
    setMintSuccessMessage(null);
    setMintedNftAddress(null);
  }, [eventPda]);

  const handleMint = async () => {
    if (!program || !publicKey || !wallet) {
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
      const minSolBalance = 0.03; 
      const lamports = await connection.getBalance(publicKey);
      const solBalance = lamports / LAMPORTS_PER_SOL;

      if (solBalance < minSolBalance) {
        setMintError(`Insufficient SOL. Need ~${minSolBalance} SOL for minting. Your balance: ${solBalance.toFixed(4)} SOL.`);
        setIsMinting(false);
        return;
      }

      const nftMintKeypair = Keypair.generate();

      // 2- User's ATA for this 
      const userNftAta = getAssociatedTokenAddressSync(
        nftMintKeypair.publicKey,
        publicKey
      );

      // 3- Metaplex Metadata PDA for the NFT
      const [metadataPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          nftMintKeypair.publicKey.toBuffer(),
        ],
        MPL_TOKEN_METADATA_PROGRAM_ID
      );
      const [masterEditionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          nftMintKeypair.publicKey.toBuffer(),
          Buffer.from("edition"),
        ],
        MPL_TOKEN_METADATA_PROGRAM_ID
      );
      
      const [ticketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("ticket"), eventPda.toBuffer(), publicKey.toBuffer()],
        TICKMYSHOW_PROGRAM_ID 
      );

      
      const existingTicketAccount = await (program as any).account.ticket.fetchNullable(ticketPda);
      if (existingTicketAccount && existingTicketAccount.nftMint) {
        setMintError("You already have an NFT ticket for this event.");
          setMintedNftAddress(existingTicketAccount.nftMint.toBase58());
          setIsMinting(false);
          return;
      }
      

      const txSignature = await program.methods
        .mintNftTicket() 
        .accounts({
          event: eventPda,
          ticket: ticketPda, 
          
          nftMint: nftMintKeypair.publicKey,
          nftTokenAccount: userNftAta,
          metadataAccount: metadataPda,
          masterEditionAccount: masterEditionPda,

          payer: publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([nftMintKeypair]) 
        .rpc();

      setMintSuccessMessage(`NFT Ticket minted successfully!`);
      setMintedNftAddress(nftMintKeypair.publicKey.toBase58());
      console.log(`Transaction Signature: ${txSignature}`);
      console.log(`NFT Mint Address: ${nftMintKeypair.publicKey.toBase58()}`);


      const updatedEventAccount = await (program as any).account.event.fetch(eventPda);
      setEventAccount(updatedEventAccount);

    } catch (err: any) {
      console.error("NFT Minting failed:", err);
      
      const generalMessage = err.message || (typeof err.toString === 'function' ? err.toString() : "An unknown error occurred.");
      setMintError(`NFT Minting failed: ${ generalMessage}`);
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
              <div className="p-6 bg-gray-800 rounded-lg shadow-xl space-y-4">
                <h3 className="text-xl font-semibold text-white">Mint Your NFT Ticket</h3>
                {eventAccount.issued && eventAccount.capacity && eventAccount.issued.gte(eventAccount.capacity) ? (
                    <p className="text-yellow-400 font-medium">This event is fully booked. No more tickets can be minted.</p>
                ) : (
                    <button
                    onClick={handleMint}
                    disabled={isMinting || (eventAccount.issued && eventAccount.capacity && eventAccount.issued.gte(eventAccount.capacity))}
                    className={`w-full px-6 py-3 font-bold rounded-md transition-all duration-300 ease-in-out text-lg
                                ${isMinting || (eventAccount.issued && eventAccount.capacity && eventAccount.issued.gte(eventAccount.capacity)) 
                                  ? 'bg-gray-600 cursor-not-allowed' 
                                  : 'bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white focus:ring-2 focus:ring-green-400 focus:ring-opacity-50 transform hover:scale-105'}`}
                    >
                    {isMinting ? "Minting NFT..." : "Mint NFT Ticket (Max 1)"}
                    </button>
                )}
              </div>
            )}
            
            {mintError && (
                <div className="mt-4 p-4 bg-red-900 border border-red-700 text-red-200 rounded-md shadow-lg" role="alert">
                    <p className="font-semibold">Error:</p>
                    <p className="break-words">{mintError}</p>
                </div>
            )}

            {mintSuccessMessage && !mintError && (
                 <div className="mt-4 p-4 bg-green-900 border border-green-700 text-green-200 rounded-md shadow-lg" role="status">
                    <p className="font-semibold">Success!</p>
                    <p>{mintSuccessMessage}</p>
                    {mintedNftAddress && (
                    <div className="mt-2">
                        <p className="font-medium">Your NFT Mint Address:</p>
                        <a 
                            href={`https://explorer.solana.com/address/${mintedNftAddress}?cluster=devnet`} // Adjust cluster (devnet, testnet, mainnet-beta) as needed
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline break-all"
                        >
                            {mintedNftAddress}
                        </a>
                        <p className="text-sm mt-1 text-gray-400">(This NFT is designed to be non-transferable as per program logic)</p>
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
