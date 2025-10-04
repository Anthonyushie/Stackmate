export default function PuzzleCardSkeleton() {
  const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]';
  const ske = 'skeleton';
  return (
    <div className={`${brutal} bg-white/80 dark:bg-zinc-900/60 backdrop-blur p-5 relative overflow-hidden`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`${brutal} ${ske} h-6 w-20`} />
          <div className={`${brutal} ${ske} h-6 w-28`} />
        </div>
        <div className="flex gap-2">
          <div className={`${brutal} ${ske} h-6 w-16`} />
          <div className={`${brutal} ${ske} h-6 w-16`} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${brutal} bg-white/90 dark:bg-zinc-800/60 p-3`}>
            <div className={`${ske} h-3 w-24 mb-2`} />
            <div className={`${ske} h-6 w-28`} />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className={`${brutal} ${ske} h-10 w-full`} />
      </div>
    </div>
  );
}
