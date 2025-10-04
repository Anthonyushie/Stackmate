export default function ChessBoardSkeleton() {
  const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]';
  const ske = 'skeleton';
  const gridCols = 'grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 lg:gap-6';
  return (
    <div className={`min-h-screen bg-gradient-to-br from-yellow-200 via-rose-200 to-blue-200 text-black relative overflow-hidden`}>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className={`${gridCols}`}>
          <div className={`${brutal} bg-yellow-200 p-3 flex items-center justify-center`}>
            <div className={`${ske}`} style={{ width: 520, height: 520, maxWidth: '100%', aspectRatio: '1 / 1' }} />
          </div>
          <div className={`${brutal} bg-white/80 backdrop-blur p-4 sm:p-6 lg:p-6 flex flex-col`}>
            <div className="flex items-center justify-between mb-2">
              <div className={`${ske} h-4 w-40`} />
              <div className={`${ske} h-4 w-24`} />
            </div>
            <div className={`${ske} h-4 w-80 mb-2`} />
            <div className={`${ske} h-3 w-64 mb-4`} />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`${brutal} bg-white p-3`}>
                <div className={`${ske} h-3 w-20 mb-2`} />
                <div className={`${ske} h-6 w-24`} />
              </div>
              <div className={`${brutal} bg-white p-3`}>
                <div className={`${ske} h-3 w-20 mb-2`} />
                <div className={`${ske} h-6 w-24`} />
              </div>
            </div>
            <div className="grid gap-2 max-h-[320px] overflow-auto pr-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`${brutal} bg-white p-2 flex items-center justify-between text-xs`}>
                  <div className={`${ske} h-4 w-8`} />
                  <div className={`${ske} h-4 w-40`} />
                  <div className={`${ske} h-4 w-12`} />
                </div>
              ))}
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <div className={`${brutal} ${ske} h-9 w-28`} />
              <div className={`${brutal} ${ske} h-9 w-36`} />
              <div className={`${brutal} ${ske} h-9 w-40`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
