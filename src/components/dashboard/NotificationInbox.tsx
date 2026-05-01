import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { Bell, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import NotificationPopupContent, { renderNotificationBody } from "@/components/dashboard/NotificationPopupContent";
import { supabase } from "@/integrations/supabase/client";

interface Notification {
  id: string;
  target: string;
  subject: string;
  body: string;
  sent_at: string;
  read_by: string[];
}

interface NotificationInboxProps {
  userId: string;
  role: "instructor" | "student";
  studentName?: string; // when role==='student', enables targeted notifications
  suppressPopup?: boolean;
}

export default function NotificationInbox({ userId, role, studentName, suppressPopup = false }: NotificationInboxProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showInbox, setShowInbox] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupNotification, setPopupNotification] = useState<Notification | null>(null);
  const [detailNotification, setDetailNotification] = useState<Notification | null>(null);
  const wasSuppressedRef = useRef(suppressPopup);

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("admin_notifications")
      .select("id, target, subject, body, sent_at, read_by")
      .order("sent_at", { ascending: false })
      .limit(50);

    if (!data) return;

    const targetFilter = role === "instructor" ? ["all", "instructors"] : ["all", "students"];
    const personalTarget = role === "student" && studentName ? `student:${studentName}` : null;
    const filtered = (data as Notification[]).filter(
      (n) => targetFilter.includes(n.target) || (personalTarget && n.target === personalTarget)
    );
    setNotifications(filtered);

    const unread = filtered.filter(
      (n) => !n.read_by?.includes(userId)
    );
    setUnreadCount(unread.length);

  }, [userId, role, studentName]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const wasSuppressed = wasSuppressedRef.current;
    wasSuppressedRef.current = suppressPopup;
    if (wasSuppressed && !suppressPopup) {
      fetchNotifications();
    }
  }, [suppressPopup, fetchNotifications]);

  useEffect(() => {
    if (suppressPopup) {
      setShowPopup(false);
      setPopupNotification(null);
      return;
    }
    if (!showInbox && !showPopup) {
      const next = notifications.find((n) => !n.read_by?.includes(userId));
      if (next) {
        setPopupNotification(next);
        setShowPopup(true);
      }
    }
  }, [suppressPopup, notifications, userId, showInbox, showPopup]);

  const markAsRead = async (notificationId: string) => {
    const notif = notifications.find((n) => n.id === notificationId);
    if (!notif || notif.read_by?.includes(userId)) return;

    const updatedReadBy = [...(notif.read_by || []), userId];
    await supabase
      .from("admin_notifications")
      .update({ read_by: updatedReadBy })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, read_by: updatedReadBy } : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read_by?.includes(userId));
    for (const n of unread) {
      const updatedReadBy = [...(n.read_by || []), userId];
      await supabase
        .from("admin_notifications")
        .update({ read_by: updatedReadBy })
        .eq("id", n.id);
    }
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        read_by: n.read_by?.includes(userId) ? n.read_by : [...(n.read_by || []), userId],
      }))
    );
    setUnreadCount(0);
  };

  const handleClosePopup = async () => {
    const current = popupNotification;
    if (current) {
      await markAsRead(current.id);
    }
    // Find next unread (excluding the one just read)
    const next = notifications.find(
      (n) => n.id !== current?.id && !n.read_by?.includes(userId),
    );
    if (next && !showInbox) {
      setPopupNotification(next);
      setShowPopup(true);
    } else {
      setShowPopup(false);
      setPopupNotification(null);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setShowInbox(true);
          setShowPopup(false);
        }}
        className="h-8 text-xs gap-1 text-muted-foreground px-2 sm:px-3 relative"
        title="메시지함"
      >
        <Bell className="w-3 h-3" />
        <span className="hidden sm:inline">메시지함</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
            {unreadCount}
          </span>
        )}
      </Button>

      {showPopup && popupNotification && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClosePopup(); }}
        >
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-background border rounded-lg shadow-lg p-6 grid gap-4">
            <NotificationPopupContent
              subject={popupNotification.subject}
              body={popupNotification.body}
              timestampLabel={format(new Date(popupNotification.sent_at), "yyyy.MM.dd HH:mm")}
              onConfirm={handleClosePopup}
            />
          </div>
        </div>,
        document.body,
      )}

      <Dialog open={showInbox} onOpenChange={setShowInbox}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base">
                <Bell className="w-4 h-4 text-gold" />
                메시지함
                {unreadCount > 0 && (
                  <span className="text-xs font-normal text-destructive">({unreadCount}건 미확인)</span>
                )}
              </span>
              {unreadCount > 0 && (
                <Button size="sm" variant="ghost" onClick={markAllAsRead} className="h-7 text-xs text-muted-foreground">
                  모두 읽음
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">공지사항이 없습니다.</p>
            ) : (
              notifications.map((n) => {
                const isRead = n.read_by?.includes(userId);
                return (
                  <div
                    key={n.id}
                    className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                      isRead
                        ? "border-border bg-muted/20 hover:bg-muted/40"
                        : "border-gold/30 bg-gold/5 hover:bg-gold/10"
                    }`}
                    onClick={() => {
                      setDetailNotification(n);
                      if (!isRead) markAsRead(n.id);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {!isRead && (
                        <span className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
                      )}
                      <p className={`text-sm truncate flex-1 ${isRead ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                        {n.subject}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        {format(new Date(n.sent_at), "MM.dd")}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailNotification} onOpenChange={(open) => { if (!open) setDetailNotification(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base break-words [overflow-wrap:anywhere]">
              {detailNotification?.subject}
            </DialogTitle>
          </DialogHeader>
          {detailNotification && (
            <div className="min-w-0 space-y-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(detailNotification.sent_at), "yyyy.MM.dd HH:mm")}
              </p>
              <div className="max-w-full rounded-lg bg-muted/40 p-3 max-h-[60vh] overflow-y-auto space-y-1">
                {renderNotificationBody(detailNotification.body)}
              </div>
              <Button onClick={() => setDetailNotification(null)} className="w-full bg-navy hover:bg-navy-light text-primary-foreground">
                닫기
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
