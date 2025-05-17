import { useMemo } from "react";
import {
  useConnection,
  useWallet,
  WalletContextState,
} from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, Idl, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import idl from "./idl.json";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export const PROGRAM_ID = new PublicKey(idl.address);
export type Tickmyshow = Idl;

export function useAnchorProgram(): {
  program: Program<Tickmyshow> | null;
  provider: AnchorProvider | null;
  wallet: WalletContextState;
} {
  const { connection } = useConnection();
  const wallet = useWallet();
  const provider = useMemo<AnchorProvider | null>(() => {
    if (!wallet.publicKey) return null;
    return new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);
  const program = useMemo<Program<Tickmyshow> | null>(() => {
    if (!provider) return null;
    return new Program<Tickmyshow>(idl as any, provider);
  }, [provider]);
  return { program, provider, wallet };
}

export function getEventPDA(
  name: string,
  date: number
): [PublicKey, number] {
  const dateBuf = new BN(date).toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("event"), Buffer.from(name), dateBuf],
    PROGRAM_ID
  );
}

export function getTicketPDA(
  event: PublicKey,
  nftMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("ticket"), event.toBuffer(), nftMint.toBuffer()],
    PROGRAM_ID
  );
}

export function getGatePDA(
  event: PublicKey,
  entrypointId: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("entrypoint"),
      event.toBuffer(),
      Buffer.from(entrypointId),
    ],
    PROGRAM_ID
  );
}

export function getCheckinPDA(
  ticket: PublicKey,
  timestamp: number
): [PublicKey, number] {
  const tsBuf = new BN(timestamp).toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("checkin"), ticket.toBuffer(), tsBuf],
    PROGRAM_ID
  );
}

// Example wrappers for your common operations:

export async function initEvent(
  program: Program<Tickmyshow>,
  creator: PublicKey,
  name: string,
  date: number,
  capacity: number
) {
  const [eventPda] = getEventPDA(name, date);
  return program.methods
    .initEvent(name, new BN(date), capacity)
    .accounts({
      event: eventPda,
      creator,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function mintAndFreeze(
  program: Program<Tickmyshow>,
  payer: PublicKey,
  mintKeypair: Keypair,
  buyerAta: PublicKey,
  eventPda: PublicKey
) {
  return await program.methods
    .mintAndFreeze()               
    .accounts({
      payer,                       
      event: eventPda,
      nftMint: mintKeypair.publicKey,
      nftAccount: buyerAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([mintKeypair])         
    .rpc();
}

export async function checkIn(
  program: Program<Tickmyshow>,
  gateAgent: PublicKey,
  eventPda: PublicKey,
  gatePda: PublicKey,
  ticketPda: PublicKey,
  nftMint: PublicKey,
  nftAta: PublicKey,
  checkinPda: PublicKey
) {
  return program.methods
    .checkIn()
    .accounts({
      event: eventPda,
      gate: gatePda,
      gateAgent,
      nftMint,
      nftAccount: nftAta,
      ticket: ticketPda,
      checkin: checkinPda,
      tokenProgram: SystemProgram.programId /* replace with TOKEN_PROGRAM_ID */,
      clock: SYSVAR_CLOCK_PUBKEY,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}
