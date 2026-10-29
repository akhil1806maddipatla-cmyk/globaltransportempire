import React, { useState, useEffect } from 'react';
import { globalEventBus } from '../core/EventBus';
import { Info, AlertTriangle, CheckCircle, X } from 'lucide-react';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success';
}

export const NotificationSystem: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const unsubscribe = globalEventBus.on<Omit<NotificationItem, 'id'>>('ui:notify', (payload) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const item: NotificationItem = {
        id,
        title: payload.title,
        message: payload.message,
        type: payload.type || 'info',
      };

      setNotifications((prev) => [...prev.slice(-3), item]); // keep maximum 4 notifications

      setTimeout(() => {
        setNotifications((current) => current.filter((n) => n.id !== id));
      }, 4000);
    });

    return unsubscribe;
  }, []);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl bg-slate-900/95 border-slate-700/60 text-slate-100 transition-all duration-200 animate-in fade-in slide-in-from-right-4"
        >
          <div className="mt-0.5 shrink-0">
            {n.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
            {n.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
            {(!n.type || n.type === 'info') && <Info className="w-5 h-5 text-sky-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-slate-100 uppercase tracking-wider">{n.title}</h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{n.message}</p>
          </div>
          <button
            onClick={() => removeNotification(n.id)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
