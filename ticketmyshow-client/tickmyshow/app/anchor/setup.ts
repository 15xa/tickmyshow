import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import idl from "./idl.json";
import { PublicKey, SystemProgram, Keypair, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";

export const getEventPDA = (name: string, date: BN, programId: PublicKey): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("event"), Buffer.from(name), date.toBuffer("le", 8)],
    programId
  );
};

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const programId = new PublicKey(idl.address);
  const program = new Program(idl as any,  provider);
  console.log("Program ID:", programId.toString());

  const creatorWallet = provider.wallet as anchor.Wallet;
  console.log("Creator/Payer Wallet:", creatorWallet.publicKey.toString());

  const eventName = "Solana Summer Fest";
  const eventDate = new BN(Math.floor(Date.now() / 1000) + 3600);
  const eventCapacity = 500;

  const [eventPda, eventBump] = getEventPDA(eventName, eventDate, programId);
  console.log("Event PDA:", eventPda.toString(), "bump:", eventBump);

  try {
    const initTx = await program.methods
      .initEvent(eventName, eventDate, eventCapacity)
      .accounts({
        event: eventPda,
        creator: creatorWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Init transaction:", initTx);

    const eventData = await (program as any).account.event.fetch(eventPda);
    console.log("Event Data:", eventData);
  } catch (error) {
    console.error("Init error:", error);
    const err = error as anchor.AnchorError;
    if (err.error?.errorCode) console.error(err.error.errorCode.code, err.error.errorMessage);
    if (err.logs) console.error(err.logs);
    return;
  }

  console.log("--- Mint & Freeze NFT ---");

  const payer = creatorWallet;
  const mintKeypair = Keypair.generate();
  const ata = await getAssociatedTokenAddress(mintKeypair.publicKey, payer.publicKey);

  try {
    const mintTx = await program.methods
      .mintAndFreeze()
      .accounts({
        payer: payer.publicKey,
        event: eventPda,
        nftMint: mintKeypair.publicKey,
        nftAccount: ata,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([mintKeypair])
      .rpc();
    console.log("Mint tx:", mintTx);

    const updated = await (program as any).account.event.fetch(eventPda);
    console.log("Issued NFTs:", updated.issuedNfts);
  } catch (error) {
    console.error("Mint error:", error);
    const err = error as anchor.AnchorError;
    if (err.error?.errorCode) console.error(err.error.errorCode.code, err.error.errorMessage);
    if (err.logs) console.error(err.logs);
  }
}

if (require.main === module) {
  main().then(
    () => console.log("Done."),
    (err) => {
      console.error(err);
      process.exit(1);
    }
  );
}
