'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // ChunkLoadError → auto reload แทนที่จะโชว์หน้า error
  if (error?.name === 'ChunkLoadError') {
    window.location.reload();
    return null;
  }

  return (
    <html>
      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>เกิดข้อผิดพลาด</h2>
          <button onClick={() => reset()}>ลองใหม่</button>
        </div>
      </body>
    </html>
  );
}
