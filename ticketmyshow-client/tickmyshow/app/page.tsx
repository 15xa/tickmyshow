"use client";

import { useRouter } from 'next/navigation';


export default function Home() {
  const router = useRouter();

  const handleClick = (route:string) => {
    router.push(`/${route}`);
  };

  return (
    <div className="flex items-center justify-evenly w-full h-screen bg-[url('/img-home-page-001.png')] bg-cover bg-center">
      <div className="mx-24 m-4 p-10 gap-4 flex flex-col items-center justify-center text-center bg-gray-200 text-black p-4 rounded-xl">
        <div className="font-bold text-xl text-center ">
          Buy Tickets
        </div>
        <div onClick={() => {handleClick("minttickets")}} className="bg-green-400 hover:bg-green-400 hover:border hover:border-2 hover:border-green-400 hover:cursor-pointer rounded-full text-black font-extrabold text-center w-fit p-4">Grab Tickets</div>
      </div>
      <div className="mx-24 p-10 gap-4 flex flex-col m-4 items-center justify-center text-center bg-gray-200 text-black p-4 rounded-xl">
        <div className="font-bold text-xl text-center ">
          Create an Event
        </div>

        <div onClick={() => {handleClick("createEvent")}} className="bg-green-400 hover:bg-green-400 hover:border hover:border-2 hover:border-green-400 hover:cursor-pointer rounded-full text-black font-extrabold text-center w-fit p-4">create</div>
      </div>
    </div>
  );
}
