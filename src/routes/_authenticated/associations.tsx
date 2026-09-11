import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Share2, Loader2, GripVertical, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatSar } from "@/lib/money";
import { createAssociationCheckout } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/associations")({
  head: () => ({
    meta: [
      { title: "الجمعيات | مُستَحق" },
      { name: "description", content: "أنشئ جمعياتك المالية وتابع الدورات والأدوار والأنصبة." },
      { property: "og:title", content: "الجمعيات | مُستَحق" },
      { property: "og:description", content: "إدارة الجمعيات الدورية بأدوار واضحة وتقدم مرئي." },
    ],
  }),
  component: AssociationsScreen,
});

const formSchema = z.object({
  title: z.string().trim().min(2, "اسم الجمعية قصير").max(80),
  total_amount: z.number().min(1, "أدخل المبلغ الإجمالي"),
  members_count: z.number().int().min(2, "عدد الأعضاء 2 على الأقل").max(60),
  monthly_share: z.number().min(1, "أدخل سهم الشهر"),
  payout_day: z.number().int().min(1).max(28),
});

function AssociationsScreen() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [membersCount, setMembersCount] = useState("");
  const [monthlyShare, setMonthlyShare] = useState("");
  const [payoutDay, setPayoutDay] = useState("1");
  const [memberNames, setMemberNames] = useState<string[]>([""]);

  const { data: associations = [], isLoading } = useQuery({
    queryKey: ["associations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("associations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = formSchema.parse({
        title,
        total_amount: Number(totalAmount),
        members_count: Number(membersCount),
        monthly_share: Number(monthlyShare),
        payout_day: Number(payoutDay),
      });
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("انتهت الجلسة، سجّل الدخول مرة ثانية");

      const { data: created, error } = await supabase
        .from("associations")
        .insert({ ...parsed, owner_id: userId })
        .select()
        .single();
      if (error) throw error;

      const members = memberNames
        .map((name, index) => ({ name: name.trim(), turn_order: index + 1 }))
        .filter((m) => m.name.length > 0);

      if (members.length > 0) {
        const { error: memberError } = await supabase.from("association_members").insert(
          members.map((m) => ({
            ...m,
            association_id: created.id,
            owner_id: userId,
          })),
        );
        if (memberError) throw memberError;
      }
      return created;
    },
    onSuccess: () => {
      toast.success("تم إنشاء الجمعية");
      setOpen(false);
      setTitle("");
      setTotalAmount("");
      setMembersCount("");
      setMonthlyShare("");
      setPayoutDay("1");
      setMemberNames([""]);
      queryClient.invalidateQueries({ queryKey: ["associations"] });
    },
    onError: (error) => {
      const message =
        error instanceof z.ZodError ? error.issues[0]!.message : (error as Error).message;
      toast.error(message);
    },
  });

  function shareInvite(name: string) {
    const text = `دعوة للانضمام إلى جمعية "${name}" على تطبيق مُستَحق: ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  function moveMember(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= memberNames.length) return;
    const next = [...memberNames];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setMemberNames(next);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">الجمعيات</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="font-bold">
              <Plus className="size-4" /> جمعية جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>إنشاء جمعية جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="title">اسم الجمعية</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="جمعية العائلة"
                  maxLength={80}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="total">المبلغ الإجمالي</Label>
                  <Input
                    id="total"
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="60000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="members">عدد الأعضاء</Label>
                  <Input
                    id="members"
                    type="number"
                    value={membersCount}
                    onChange={(e) => setMembersCount(e.target.value)}
                    placeholder="10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="share">سهم الشهر</Label>
                  <Input
                    id="share"
                    type="number"
                    value={monthlyShare}
                    onChange={(e) => setMonthlyShare(e.target.value)}
                    placeholder="600"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payout">يوم التسليم</Label>
                  <Input
                    id="payout"
                    type="number"
                    min={1}
                    max={28}
                    value={payoutDay}
                    onChange={(e) => setPayoutDay(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>ترتيب الأدوار</Label>
                {memberNames.map((name, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <GripVertical className="size-4 text-muted-foreground" />
                    <Input
                      value={name}
                      onChange={(e) => {
                        const next = [...memberNames];
                        next[index] = e.target.value;
                        setMemberNames(next);
                      }}
                      placeholder={`العضو ${index + 1}`}
                      maxLength={60}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => moveMember(index, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => moveMember(index, 1)}
                    >
                      ↓
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setMemberNames([...memberNames, ""])}
                >
                  <Plus className="size-4" /> إضافة عضو
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button
                className="w-full font-bold"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="me-2 size-4 animate-spin" />}
                إنشاء الجمعية
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {isLoading ? (
        <p className="text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
      ) : associations.length === 0 ? (
        <div className="card-surface p-6 text-center text-sm text-muted-foreground">
          ما عندك جمعيات بعد. ابدأ بإنشاء جمعية جديدة.
        </div>
      ) : (
        <ul className="space-y-3">
          {associations.map((a) => (
            <li key={a.id} className="card-surface p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    سهم الشهر {formatSar(a.monthly_share)} · الإجمالي {formatSar(a.total_amount)}
                  </p>
                </div>
                <Button size="icon" variant="outline" onClick={() => shareInvite(a.title)}>
                  <Share2 className="size-4" />
                </Button>
              </div>
              <Progress
                className="mt-3"
                value={Math.min(100, (a.current_month / Math.max(1, a.members_count)) * 100)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                الشهر {a.current_month} من {a.members_count} · التسليم يوم {a.payout_day}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
