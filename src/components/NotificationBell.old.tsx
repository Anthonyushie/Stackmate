import { useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import useNotifications from '../hooks/useNotifications';
import { formatRelativeTime } from '../lib/time-utils';

const brutal = 'rounded-none border-[3px] border-black shadow-[6px_6px_0_#000]';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, enableSound, enableDesktop, desktopPermission, setEnableSound, setEnableDesktop } = useNotifications();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const top = useMemo(() => notifications.slice(0, 10), [notifications]);

  return (
    <div className="relative">
      <button ref={btnRef} className={`relative inline-flex items-center justify-center h-9 w-9 bg-white ${brutal}`} onClick={() => setOpen(o => !o)} aria-label="Notifications">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full border-[2px] border-black shadow-[2px_2px_0_#000]">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 mt-2 w-80 bg-white ${brutal} z-50`}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-black/20">
            <div>
              <div className="text-xs font-black uppercase tracking-wider">Notifications</div>
              <div className="flex items-center gap-2 mt-1">
                <label className="flex items-center gap-1 text-[11px]">
                  <input type="checkbox" checked={enableSound} onChange={(e) => setEnableSound(e.target.checked)} />
                  Sound
                </label>
                <label className="flex items-center gap-1 text-[11px]">
                  <input type="checkbox" checked={enableDesktop} onChange={(e) => setEnableDesktop(e.target.checked)} disabled={desktopPermission === 'denied' || desktopPermission === 'unsupported'} />
                  Desktop
                </label>
                {(desktopPermission === 'denied') && (
                  <span className="text-[10px] opacity-70">(blocked in browser)</span>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <button className={`text-xs bg-yellow-300 px-2 py-1 ${brutal}`} onClick={() => markAllAsRead()}>Mark all read</button>
            )}
          </div>
          <div className="max-h-80 overflow-auto">
            {top.length === 0 && (
              <div className="px-3 py-4 text-sm opacity-70">No notifications</div>
            )}
            {top.map((n) => (
              <div key={n.id} className={`px-3 py-2 border-b border-black/10 ${!n.read ? 'bg-yellow-100' : 'bg-white'}`} onClick={() => markAsRead(n.id)}>
                <div className="text-sm font-bold">{n.message}</div>
                <div className="text-[11px] opacity-60">{formatRelativeTime(n.createdAt)}</div>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 text-[11px] opacity-60">Showing latest 10</div>
        </div>
      )}
    </div>
  );
}
