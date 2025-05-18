'use client';

import { useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';

type Props = {
  eventName: string;
  eventDate: Date;
  mint: string;
};

export default function CanvasTicket({ eventName, eventDate, mint }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dimensions
  const ticketW = 500;
  const ticketH = 750;
  const margin = 40;
  const qrSize = 300;

  // Draw the ticket
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    // 1) Clear & background
    ctx.clearRect(0, 0, ticketW, ticketH);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, ticketW, ticketH);

    // 2) Draw border
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, ticketW, ticketH);

    // 3) Generate perfect-square QR off-screen
    const qrCanvas = document.createElement('canvas');
    qrCanvas.width = qrSize;
    qrCanvas.height = qrSize;
    QRCode.toCanvas(qrCanvas, `tickmyshow://${mint}`, {
      width: qrSize,
      margin: 2,
      color: { dark: '#000', light: '#fff' },
    }).then(() => {
      // 4) Blit QR onto main canvas, centered horizontally
      const qrX = (ticketW - qrSize) / 2;
      const qrY = margin;
      ctx.drawImage(qrCanvas, qrX, qrY);

      // 5) Text styling
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';

      // Event Name
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(eventName, ticketW / 2, qrY + qrSize + 50);

      // Date & Time
      const readable = eventDate.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      ctx.font = '18px sans-serif';
      ctx.fillText(readable, ticketW / 2, qrY + qrSize + 85);

      // Mint string
      ctx.font = '14px monospace';
      ctx.fillText(mint, ticketW / 2, qrY + qrSize + 115);
    });
  }, [eventName, eventDate, mint]);

  const downloadPDF = () => {
    const canvas = canvasRef.current!;
    const imgData = canvas.toDataURL('image/png');
    // scale down so PDF page ~= A6
    const pdfW = ticketW * 0.7;
    const pdfH = ticketH * 0.7;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [pdfW, pdfH] });
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
    pdf.save(`${eventName.replace(/\s+/g, '_')}_ticket.pdf`);
  };

  return (
    <div className='flex items-center justify-center text-center'>
    <div className="flex flex-col items-center space-y-4 bg-white p-4 w-fit rounded-xl">
      <canvas
        ref={canvasRef}
        width={ticketW}
        height={ticketH}
        className="shadow-lg"
      />
      <button
        onClick={downloadPDF}
        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
      >
        Download PDF
      </button>
    </div>
    </div>
  );
}
