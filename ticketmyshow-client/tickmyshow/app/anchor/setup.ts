import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import { useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import BN from "bn.js";

// Anchor-generated IDL
import idl from "./idl.json";

/**
 * Expose the raw IDL for clients
 */
export const IDL = idl as Idl;

/**
 * Strongly-typed Program interface
 */
export type Tickmyshow = Program<Idl>;

/**
 * Program ID for on-chain deployment
 */
export const PROGRAM_ID = new PublicKey("5FFwn1xD4ae3kttPDNoHmnW2x2tfekLQXUbRiaj6mBeG");

/**
 * React hook to initialize Anchor Provider and Program
 */
export function useAnchorProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const provider = useMemo(() => {
    if (!wallet.publicKey) return null;
    return new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(IDL,  provider) as Program<Idl>;
  }, [provider]);

  return { program: program as Program<Idl>, provider, wallet };
}


export function getEventPDA(
  name: string,
  date: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("event"),
      Buffer.from(name),
      new BN(date).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );
}

/**
 * Derive Ticket PDA: ["ticket", eventPubkey, nftMintPubkey]
 */
export function getTicketPDA(
  event: PublicKey,
  nftMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("ticket"), event.toBuffer(), nftMint.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive GateAuthority PDA: ["entrypoint", eventPubkey, entrypointId]
 */
export function getGatePDA(
  event: PublicKey,
  entrypointId: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("entrypoint"), event.toBuffer(), Buffer.from(entrypointId)],
    PROGRAM_ID
  );
}

/**
 * Derive CheckInData PDA: ["checkin", ticketPubkey, timestamp_le_8bytes]
 */
export function getCheckinPDA(
  ticket: PublicKey,
  timestamp: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("checkin"),
      ticket.toBuffer(),
      new BN(timestamp).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );
}
