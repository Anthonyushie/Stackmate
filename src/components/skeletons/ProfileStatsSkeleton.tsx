export default function ProfileStatsSkeleton() {
  const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]';
  const ske = 'skeleton';
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${brutal} bg-white p-4`}>
            <div className={`${ske} h-3 w-20 mb-2`} />
            <div className={`${ske} h-7 w-24`} />
          </div>
        ))}
      </div>
      <div>
        <div className={`${ske} h-4 w-40 mb-2`} />
        <div className={`${brutal} bg-white p-3 h-64`}>
          <div className={`${ske} h-full w-full`} />
        </div>
      </div>
      <div>
        <div className={`${ske} h-4 w-40 mb-2`} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${brutal} bg-white p-3 flex items-start gap-3`}>
              <div className={`h-8 w-8 ${brutal} ${ske}`} />
              <div className="flex-1">
                <div className={`${ske} h-4 w-32 mb-1`} />
                <div className={`${ske} h-3 w-40`} />
              </div>
              <div className={`${ske} h-5 w-5`} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className={`${ske} h-4 w-40`} />
          <div className={`${ske} h-3 w-20`} />
        </div>
        <div className={`${brutal} bg-white/90 backdrop-blur overflow-hidden`}>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-100">
                <tr>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <th key={i} className="text-left p-2"><div className={`${ske} h-3 w-20`} /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t border-zinc-200">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="p-2"><div className={`${ske} h-4 w-24`} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-2 border-t border-zinc-200 text-xs">
            <div className={`${ske} h-3 w-24`} />
            <div className="flex items-center gap-2">
              <div className={`${ske} h-7 w-14`} />
              <div className={`${ske} h-7 w-14`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
