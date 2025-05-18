"use client";
import React, { useState, useMemo, useEffect } from "react";
import { PublicKey, SystemProgram, Keypair, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idl from "../anchor/idl.json";
import { Program, AnchorProvider} from "@coral-xyz/anchor";
import { WalletButtonClient } from "../components/walletbutton";
import MintTicketForm from "./mintform";
import BN from "bn.js";
import TicketQR from "../components/ticketQr";


type TickmyshowProgram = {
  methods: {
    mintAndFreeze(): {
      accounts: (accounts: {
        payer: PublicKey;
        event: PublicKey;
        nftMint: PublicKey;
        nftAccount: PublicKey;
        tokenProgram: PublicKey;
        associatedTokenProgram: PublicKey;
        systemProgram: PublicKey;
        rent: PublicKey;
      }) => {
        signers: (signers: Keypair[]) => {
          rpc: () => Promise<string>;
        };
      };
    };
  };
  account: {
    event: {
      fetch: (address: PublicKey) => Promise<EventAccountData>;
    };
  };
};

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

// Add the missing mintAndFreeze function
async function mintAndFreeze(
  program: TickmyshowProgram,
  payer: PublicKey,
  mintKeypair: Keypair,
  nftAccount: PublicKey,
  eventPda: PublicKey
): Promise<string> {
  return program.methods
    .mintAndFreeze()
    .accounts({
      payer: payer,
      event: eventPda,
      nftMint: mintKeypair.publicKey,
      nftAccount: nftAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([mintKeypair])
    .rpc();
}

export default function MintTicketPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet() || { publicKey: null };

  // Initialize the program
  const program = useMemo(() => {
    if (!wallet || !wallet.publicKey) return null;
    const provider = new AnchorProvider(connection, wallet as any, AnchorProvider.defaultOptions());
    const programId = new PublicKey(idl.address);
    return new Program(idl as any,  provider) as unknown as TickmyshowProgram;
  }, [connection, wallet]);

  const publicKey = wallet?.publicKey || null;

  const [eventPdaInput, setEventPdaInput] = useState<string>("");
  const [eventPk, setEventPk] = useState<PublicKey | null>(null);
  const [eventData, setEventData] = useState<EventAccountData | null>(null);

  const [uri, setUri] = useState("");
  const [title, setTitle] = useState("");
  const [symbol, setSymbol] = useState("");

  const [ms1, setms1] = useState("");
  const [mintpk, setmintpk]:any = useState();
  const [minted, setminted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");


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
      const ev: any = await program.account.event.fetch(pk);
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
  const PrintmyTick = () => {
    if (!eventData?.name || !eventData.date || !mintpk) {
      return <p>Loading ticket…</p>;
    }
  
    // Convert PublicKey to string
    const mintStr = mintpk instanceof PublicKey
      ? mintpk.toBase58()
      : String(mintpk);
      function bnToDate(bn: BN): Date {
        return new Date(bn.toNumber() * 1000);
      }
  
    const eventDateObj = bnToDate(eventData.date);
  
    return (
      <div>
        <TicketQR
          eventName={eventData.name}
          eventDate={eventDateObj}
          mint={mintStr}
        />
      </div>
    );
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
      setmintpk(mintKeypair.publicKey);
      const mintPk = mintKeypair.publicKey;
      
      // Get ATA for buyer
      const buyerAta = await getAssociatedTokenAddress(
        mintPk,
        publicKey
      );
      
      // Mint and freeze the NFT
      const tx = await mintAndFreeze(
        program,
        publicKey,
        mintKeypair,
        buyerAta,
        eventPk
      );
      
          setMessage(`Mint+freeze successful: ${tx} 
              Mint: ${mintPk.toBase58()}
              Tx:   ${tx}`);
                    setms1(tx);

      
      setminted(true)
      
      
      // Reload event data to see updated issued NFTs count
      await loadEvent();
    } catch (err: any) {
      setMessage("❌ Error: " + (err.message || err.toString()));
      console.error(err);
    } finally {
      setLoading(false);
    }

    
    }
  

  return (
    <div className="container mx-auto py-20 pb-96 p-6 bg-[url('/mintpage_im_001.png')] bg-center bg-cover">
      <WalletButtonClient />
      {!publicKey ? (
        <div className="max-w-lg mx-auto mt-10 p-6 sm:p-8 bg-white rounded-xl shadow-lg border border-gray-200 text-center">
          <h2 className="text-3xl font-bold mb-6 text-gray-800">Mint my Ticket</h2>
          <p className="text-red-600 font-semibold mb-6">Connect your wallet to continue</p>
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
      { ms1 && <div>{ms1}
        
          <div>Mint Successful: <div>{mintpk.toBase58()}</div></div>
          
        </div>}
        
        {minted && <PrintmyTick/>}
    </div>
  );
}