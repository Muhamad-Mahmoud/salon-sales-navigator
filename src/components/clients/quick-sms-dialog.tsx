import { useState, useEffect } from "react";
import { toast } from "sonner";
import { MessageSquare, Send, Sparkles, Phone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useSaveContactLog } from "@/hooks/use-crm";
import type { Client } from "@/lib/types";

interface QuickSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onSuccess?: () => void;
}

function cleanClientName(rawName?: string): string {
  if (!rawName) return "عزيزنا العميل";
  const trimmed = rawName.trim();
  return trimmed || "عزيزنا العميل";
}

const SMS_TEMPLATES = [
  {
    id: "demo",
    title: "✨ تجربة مجانية لنظام الصالون (Demo)",
    text: (name: string) =>
      `أهلاً ${cleanClientName(name)}، يسعدنا في أوج لينكر تقديم تجربة مجانية لنظام إدارة حجوزات الصالونات والكاشير والفاتورة المعتمدة. لبدء تجربتكم: https://ojlinker.com.sa`,
  },
  {
    id: "missed_call",
    title: "📞 محاولة اتصال لم يُرد عليها",
    text: (name: string) =>
      `مرحباً ${cleanClientName(name)}، حاولنا التواصل معكم من أوج لينكر بخصوص تنظيم حجوزات الصالون وزيادة المبيعات. نسعد بتواصلكم معنا أو تحديد موعد يناسبكم.`,
  },
  {
    id: "followup",
    title: "🤝 متابعة بعد المكالمة وتفعيل الحساب",
    text: (name: string) =>
      `عزيزنا ${cleanClientName(name)}، سعدنا بالتواصل معكم اليوم. يمكنكم الدخول لمنظومة أوج لينكر وتجربة النظام مجاناً ومتابعة المواعيد عبر: https://app.ojlinker.com.sa`,
  },
  {
    id: "offer",
    title: "🎁 عرض خصم 20% على الاشتراك السنوي",
    text: (name: string) =>
      `عرض خاص لـ ${cleanClientName(name)}! وفّر 20% على الاشتراك السنوي في أوج لينكر (تنظيم المواعيد، الفاتورة الإلكترونية، وتقارير الأرباح). العرض لفترة محدودة، تواصل معنا.`,
  },
  {
    id: "renewal",
    title: "⏳ تذكير بتجديد الاشتراك وتفادي التوقف",
    text: (name: string) =>
      `عزيزنا ${cleanClientName(name)}، نود تذكيركم بقرب موعد تجديد اشتراككم في أوج لينكر لضمان استمرار الحجوزات ونقاط البيع دون توقف. للتجديد: https://app.ojlinker.com.sa/billing`,
  },
  {
    id: "whatsapp",
    title: "💬 دعوة للمحادثة المباشرة عبر واتساب",
    text: (name: string) =>
      `مرحباً ${cleanClientName(name)}، لتسهيل الرد على استفساراتكم وعرض مزايا نظام أوج لينكر لإدارة الصالونات، يسعدنا تواصلكم معنا عبر الواتساب مباشرة.`,
  },
  {
    id: "custom",
    title: "✍️ رسالة مخصصة (نص حر)",
    text: () => "",
  },
];

const VOIP_GATEWAY_URL =
  (import.meta.env["VITE_VOIP_GATEWAY_URL"] as string | undefined) ||
  "https://ojcalls.ojlinker.com.sa/api/sms/send";
const VOIP_INTERNAL_API_KEY = "OjLinker_Internal_Voip_API_2026_e7d8f9a2b1c4";

export function QuickSmsDialog({
  open,
  onOpenChange,
  client,
  onSuccess,
}: QuickSmsDialogProps) {
  const saveLog = useSaveContactLog();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("demo");
  const [message, setMessage] = useState<string>("");
  const [autoLog, setAutoLog] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);

  useEffect(() => {
    if (client && open) {
      const tpl = SMS_TEMPLATES.find((t) => t.id === selectedTemplate);
      if (tpl && selectedTemplate !== "custom") {
        setMessage(tpl.text(client.name || ""));
      }
    }
  }, [client, selectedTemplate, open]);

  const handleTemplateSelect = (val: string) => {
    setSelectedTemplate(val);
    const tpl = SMS_TEMPLATES.find((t) => t.id === val);
    if (tpl) {
      if (val === "custom") {
        setMessage("");
      } else if (client) {
        setMessage(tpl.text(client.name || ""));
      }
    }
  };

  const isArabic = /[\u0600-\u06FF]/.test(message);
  const singleLimit = isArabic ? 70 : 160;
  const concatLimit = isArabic ? 67 : 153;
  const charCount = message.length;
  const segmentCount =
    charCount === 0
      ? 0
      : charCount <= singleLimit
      ? 1
      : Math.ceil(charCount / concatLimit);

  if (!client) return null;

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("يرجى كتابة نص الرسالة أولًا");
      return;
    }

    if (!client.phone) {
      toast.error("رقم هاتف العميل غير متوفر");
      return;
    }

    setIsSending(true);

    try {
      // 1. Dispatch SMS via VoIP Manager
      const resp = await fetch(VOIP_GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": VOIP_INTERNAL_API_KEY,
        },
        body: JSON.stringify({
          to: client.phone,
          message: message.trim(),
          priority: "normal",
          source: "crm-sales",
        }),
      });

      const resData = await resp.json().catch(() => ({}));

      if (!resp.ok && !resData.success) {
        throw new Error(resData.error || "فشل إرسال الرسالة عبر بوابة الاتصالات");
      }

      // 2. Automatically log the contact attempt in PocketBase if checked
      if (autoLog) {
        try {
          await saveLog.mutateAsync({
            client_id: client.id,
            contacted_at: new Date().toISOString(),
            channel: "رسالة نصية",
            attempt_type: "متابعة أولى",
            replied: "لم يتضح",
            result: "مهتم",
            next_follow_up_date: null,
            reply_summary: `إرسال رسالة SMS: ${message.trim().slice(0, 100)}`,
            next_action: "انتظار الرد",
            chat_url: client.chat_url || "",
            update_client: true,
          });
        } catch (logErr) {
          console.warn("Failed to auto-log SMS contact:", logErr);
        }
      }

      if (resData.status === "sent") {
        toast.success("تم إرسال الرسالة النصية بنجاح إلى العميل ✅");
      } else if (resData.status === "waiting_gateway" || resData.status === "queued") {
        toast.info("تم حفظ الرسالة في قائمة الانتظار - بانتظار اتصال جهاز الشرائح ⏳");
      } else {
        toast.success(resData.note || "تم استلام الرسالة وجدولتها بنجاح ✅");
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء محاولة إرسال الرسالة");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:rounded-2xl" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <MessageSquare className="size-5 text-amber-500" />
            إرسال رسالة SMS للصالون
          </DialogTitle>
          <DialogDescription>
            إرسال رسالة نصية مباشرة لـ <strong>{client.name}</strong> عبر بدالة أوج لينكر السحابية.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-muted/50 p-3 text-xs">
            <span className="text-muted-foreground">رقم الهاتف:</span>
            <span className="font-mono font-bold text-foreground" dir="ltr">
              {client.phone}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">اختيار قالب جاهز</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger className="h-9 rounded-xl text-xs">
                <SelectValue placeholder="اختر قالباً..." />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {SMS_TEMPLATES.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                    {tpl.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">نص الرسالة</Label>
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className={charCount > singleLimit ? "text-amber-500 font-semibold" : "text-muted-foreground"}>
                  {charCount} حرف
                </span>
                {charCount > 0 && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        segmentCount <= 1
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : segmentCount === 2
                          ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                      }`}
                    >
                      {segmentCount} {segmentCount === 1 ? "رسالة" : "رسائل"}
                    </span>
                  </>
                )}
              </div>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="اكتب نص الرسالة هنا..."
              className="rounded-xl text-xs leading-relaxed"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border p-3">
            <Checkbox
              id="auto-log-sms"
              checked={autoLog}
              onCheckedChange={(c) => setAutoLog(!!c)}
            />
            <Label htmlFor="auto-log-sms" className="cursor-pointer text-xs font-medium text-foreground">
              تسجيل هذه الرسالة تلقائيًا في سجل متابعة الصالون
            </Label>
          </div>
        </div>

        <DialogFooter className="mt-2 gap-2 sm:justify-start">
          <Button
            type="button"
            className="h-9 gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 font-semibold text-white hover:from-amber-600 hover:to-amber-700 shadow-xs"
            onClick={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              "جاري الإرسال..."
            ) : (
              <>
                <Send className="size-4" />
                إرسال الرسالة الآن
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-xl text-xs"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

