import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, MessageCircle, Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { createDebtCheckout } from "@/lib/payments.functions";
import { formatSar, formatDate, debtStatusLabels } from "@/lib/money";
import type { Database } from "@/integrations/supabase/types";

type Debt = Database["public"]["Tables"]["debts"]["Row"];

export const Route = createFileRoute("/_authenticated/debts")({
  head: () => ({
    meta: [
      { title: "الديون | مُستَحق" },
      { name: "description", content: "تابع من تطلبه ومن يطالبك، وأرسل تذكيراً ودياً أو سدّد الآن." },
      { property: "og:title", content: "الديون | مُستَحق" },
      { property: "og:description", content: "تتبّع الديون بحالة واضحة وتذكير مهذب وسداد إلكتروني." },
    ],
  }),
  component: DebtsScreen,
});

const formSchema = z.object({
  counterparty_name: z.string().trim().min(2, "اكتب اسم الشخص").max(80),
  counterparty_phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+\s-]*$/, "رقم الجوال غير صحيح")
    .optional(),
  amount: z.number().min(1, "أدخل المبلغ"),
  direction: z.enum(["owed_to_me", "i_owe"]),
  due_date: z.string().optional(),
  note: z.string().trim().max(300).optional(),
});

function DebtsScreen() {
  const queryClient = useQueryClient();
  const checkout = useServerFn(createDebtCheckout);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"owed_to_me" | "i_owe">("owed_to_me");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);

  const { data: debts = [], isLoading } = useQuery({
    queryKey: ["debts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = formSchema.parse({
        counterparty_name: name,
        counterparty_phone: phone || undefined,
        amount: Number(amount),
        direction,
        due_date: dueDate || undefined,
        note: note || undefined,
      });
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("انتهت الجلسة، سجّل الدخول مرة ثانية");

      const { error } = await supabase.from("debts").insert({
        owner_id: userId,
        counterparty_name: parsed.counterparty_name,
        counterparty_phone: parsed.counterparty_phone ?? null,
        amount: parsed.amount,
        direction: parsed.direction,
        due_date: parsed.due_date ?? null,
        note: parsed.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تسجيل الدين");
      setOpen(false);
      setName("");
      setPhone("");
      setAmount("");
      setDueDate("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["debts"] });
    },
    onError: (error) => {
      const message =
        error instanceof z.ZodError ? error.issues[0]!.message : (error as Error).message;
      toast.error(message);
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("debts").update({ status: "paid" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة الدين إلى مسدد");
      queryClient.invalidateQueries({ queryKey: ["debts"] });
    },
    onError: () => toast.error("تعذّر تحديث الحالة"),
  });

  function sendReminder(debt: Debt) {
    const text = `مساء الخير ${debt.counterparty_name} 🌿 تذكير ودي بخصوص مبلغ ${formatSar(
      debt.amount,
    )}${debt.due_date ? ` المستحق بتاريخ ${formatDate(debt.due_date)}` : ""}. شاكر لك مقدماً.`;
    const digits = (debt.counterparty_phone ?? "").replace(/[^0-9]/g, "");
    const url = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  }

  async function payNow(debt: Debt) {
    setPayingId(debt.id);
    try {
      const result = await checkout({
        data: { debtId: debt.id, origin: window.location.origin },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.url;
    } catch {
      toast.error("تعذّر بدء عملية الدفع");
    } finally {
      setPayingId(null);
    }
  }

  const owedToMe = debts.filter((d) => d.direction === "owed_to_me");
  const iOwe = debts.filter((d) => d.direction === "i_owe");

  function statusVariant(status: string) {
    if (status === "confirmed") return "default" as const;
    if (status === "late") return "destructive" as const;
    return "secondary" as const;
  }

  function renderList(list: Debt[], mine: boolean) {
    if (isLoading) {
      return <p className="text-center text-xs text-muted-foreground">جارٍ التحميل…</p>;
    }
    if (list.length === 0) {
      return (
        <div className="card-surface p-6 text-center text-sm text-muted-foreground">
          لا يوجد شيء هنا حالياً.
        </div>
      );
    }
    return (
      <ul className="space-y-3">
        {list.map((debt) => (
          <li key={debt.id} className="card-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{debt.counterparty_name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(debt.due_date)}</p>
                <Badge variant={statusVariant(debt.status)} className="mt-2">
                  {debtStatusLabels[debt.status]}
                </Badge>
              </div>
              <p
                className={
                  mine
                    ? "text-base font-extrabold text-primary"
                    : "text-base font-extrabold text-gold"
                }
              >
                {formatSar(debt.amount)}
              </p>
            </div>
            {debt.status !== "paid" && (
              <div className="mt-3 flex gap-2">
                {mine ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => sendReminder(debt)}
                    >
                      <MessageCircle className="size-4" /> تذكير ودي
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => markPaid.mutate(debt.id)}
                    >
                      تم السداد
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    className="flex-1 font-bold"
                    onClick={() => payNow(debt)}
                    disabled={payingId === debt.id}
                  >
                    {payingId === debt.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CreditCard className="size-4" />
                    )}
                    سداد الآن
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">الديون</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="font-bold">
              <Plus className="size-4" /> دين جديد
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تسجيل دين جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={direction === "owed_to_me" ? "default" : "outline"}
                  onClick={() => setDirection("owed_to_me")}
                >
                  أطلبهم
                </Button>
                <Button
                  type="button"
                  variant={direction === "i_owe" ? "default" : "outline"}
                  onClick={() => setDirection("i_owe")}
                >
                  يطالبوني
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">الاسم</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="سعد"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الجوال (اختياري)</Label>
                <Input
                  id="phone"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={20}
                  placeholder="9665xxxxxxxx"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="amount">المبلغ</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due">تاريخ الاستحقاق</Label>
                  <Input
                    id="due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">ملاحظة (اختياري)</Label>
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={300}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="w-full font-bold"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="me-2 size-4 animate-spin" />}
                حفظ الدين
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Tabs defaultValue="mine">
        <TabsList className="w-full">
          <TabsTrigger value="mine" className="flex-1">
            أطلبهم
          </TabsTrigger>
          <TabsTrigger value="theirs" className="flex-1">
            يطالبوني
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mine" className="mt-4">
          {renderList(owedToMe, true)}
        </TabsContent>
        <TabsContent value="theirs" className="mt-4">
          {renderList(iOwe, false)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
