"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import IDL from "../anchor/idl.json";
import { PROGRAM_ID, Tickmyshow } from "../anchor/setup";
import { Buffer } from 'buffer'; // Import Buffer

// --- Define CreatePopup OUTSIDE the main component ---
function CreatePopup({ name, setName, date, setDate, capacity, setCapacity, handleCreate }) {
    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-2xl shadow-md border">
            <h2 className="text-2xl font-bold mb-4 text-center">Create Event</h2>
            <form onSubmit={handleCreate} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Event Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="Enter event name"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Event Date</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Capacity</label>
                    <input
                        type="number"
                        min={1}
                        value={capacity}
                        onChange={(e) => setCapacity(Number(e.target.value))}
                        className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="Enter max attendees"
                        required
                    />
                </div>

                <button
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition"
                >
                    Create Event
                </button>
            </form>
        </div>
    );
}
// --- End CreatePopup definition ---


export default function CreateEvent() {
    // Initialize state
    const [name, setName] = useState("");
    const [date, setDate] = useState("");
    const [capacity, setCapacity] = useState(0);

    const { connection } = useConnection();
    const wallet = useWallet();

    const provider = wallet.publicKey
        ? new AnchorProvider(connection, wallet as any, { commitment: "confirmed" })
        : null;
    const program = provider
        ? new Program<Tickmyshow>(IDL as any, provider)
        : null;


    // Handler for the form submit
    const handleCreate = async (event: React.FormEvent) => {
        event.preventDefault(); // Prevent default form submission

        if (!program || !wallet.publicKey) {
            alert("Connect wallet first!");
            return;
        }

        const dateObj = new Date(date);

        if (isNaN(dateObj.getTime())) {
             alert("Invalid date selected.");
             console.error("Invalid date string:", date);
             return;
        }

        const timestampInSeconds = Math.floor(dateObj.getTime() / 1000);
        const timestampBigInt = BigInt(timestampInSeconds);

        console.log("Value being passed for date:", timestampBigInt);
        console.log("Type of value being passed for date:", typeof timestampBigInt);


        try {
            const [eventPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("event"), wallet.publicKey.toBuffer(), Buffer.from(name)],
                PROGRAM_ID
            );

            const tx = await program.methods
                .initEvent(name, timestampBigInt, capacity)
                .accounts({
                    event: eventPDA,
                    creator: wallet.publicKey,
                    systemProgram: PublicKey.default,
                })
                .rpc();

            console.log("Transaction signature", tx);
            alert("Event created! PDA: " + eventPDA.toBase58());

            setName("");
            setDate("");
            setCapacity(0);

        } catch (err) {
            if (err instanceof Error) {
                console.error(err);
                alert("Error: " + err.message);
            } else {
                console.error("Unknown error", err);
                alert("An unknown error occurred");
            }
        }
    };

    return (
        <div>
            {wallet.connected ? (
                 // --- Render CreatePopup, passing necessary props ---
                <CreatePopup
                    name={name}
                    setName={setName}
                    date={date}
                    setDate={setDate}
                    capacity={capacity}
                    setCapacity={setCapacity}
                    handleCreate={handleCreate}
                />
            ) : (
                <div>Connect your wallet to create an event.</div>
            )}
        </div>
    );
}