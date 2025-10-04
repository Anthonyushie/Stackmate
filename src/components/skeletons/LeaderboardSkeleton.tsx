export default function LeaderboardSkeleton({ rows = 8 }: { rows?: number }) {
  const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]';
  const ske = 'skeleton';
  return (
    <div className={`${brutal} bg-white/90 backdrop-blur overflow-hidden`}>
      <div className="max-h-[460px] overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100">
            <tr>
              <th className="text-left p-2">Rank</th>
              <th className="text-left p-2">Player</th>
              <th className="text-right p-2">Wins</th>
              <th className="text-right p-2">Total STX Won</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-t border-zinc-200">
                <td className="p-2"><div className={`${ske} h-4 w-6`} /></td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full border-[2px] border-black ${ske}" style={{ width: 28, height: 28 }} />
                    <div className={`${ske} h-4 w-40`} />
                  </div>
                </td>
                <td className="p-2 text-right"><div className={`${ske} h-4 w-10 ml-auto`} /></td>
                <td className="p-2 text-right"><div className={`${ske} h-4 w-20 ml-auto`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
