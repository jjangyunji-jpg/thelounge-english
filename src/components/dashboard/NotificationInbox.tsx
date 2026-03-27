import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Bell, Clock, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
}

export default function NotificationInbox({ userId, role }: NotificationInboxProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showInbox, setShowInbox] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupNotification, setPopupNotification] = useState<Notification | null>(null);
  const [detailNotification, setDetailNotification] = useState<Notification | null>(null);

  const targetFilter = role === "instructor" ? ["all", "instructors"] : ["all", "students"];

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("admin_notifications")
      .select("id, target, subject, body, sent_at, read_by")
      .order("sent_at", { ascending: false })
      .limit(50);

    if (!data) return;

    const filtered = (data as Notification[]).filter(
      (n) => targetFilter.includes(n.target)
    );
    setNotifications(filtered);

    const unread = filtered.filter(
      (n) => !n.read_by?.includes(userId)
    );
    setUnreadCount(unread.length);

    // Show popup for latest unread notification on first load
    if (unread.length > 0 && !showInbox) {
      setPopupNotification(unread[0]);
      setShowPopup(true);
    }
  }, [userId, role]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    const notif = notifications.find((n) => n.id === notificationId);
    if (!notif || notif.read_by?.includes(userId)) return;

    const updatedReadBy = [...(notif.read_by || []), userId];
    await supabase
      .from("admin_notifications")
      .update({ read_by: updatedReadBy } as any)
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
        .update({ read_by: updatedReadBy } as any)
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

  const handleClosePopup = () => {
    if (popupNotification) {
      markAsRead(popupNotification.id);
    }
    setShowPopup(false);
    setPopupNotification(null);
  };

  return (
    <>
      {/* Inbox Button with Badge */}
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

      {/* Auto Popup Modal for unread notification */}
      <Dialog open={showPopup} onOpenChange={(open) => { if (!open) handleClosePopup(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Bell className="w-4 h-4 text-gold" />
              새 공지사항
            </DialogTitle>
          </DialogHeader>
          {popupNotification && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{popupNotification.subject}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(popupNotification.sent_at), "yyyy.MM.dd HH:mm")}
                </p>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/40 p-3 rounded-lg">
                {popupNotification.body}
              </p>
              <Button onClick={handleClosePopup} className="w-full bg-navy hover:bg-navy-light text-primary-foreground gap-2">
                <Check className="w-4 h-4" />
                확인
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Inbox Modal */}
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
                        ? "border-border bg-muted/20"
                        : "border-gold/30 bg-gold/5"
                    }`}
                    onClick={() => !isRead && markAsRead(n.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
                          )}
                          <p className={`text-sm truncate ${isRead ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                            {n.subject}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {n.body}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {format(new Date(n.sent_at), "yyyy.MM.dd HH:mm")}
                        </p>
                      </div>
                      {!isRead && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] text-muted-foreground flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(n.id);
                          }}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
