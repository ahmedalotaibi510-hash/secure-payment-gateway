import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { LogOut, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "الملف الشخصي | مُستَحق" },
      { name: "description", content: "بيانات حسابك ودرجة الثقة وإعدادات الخروج في مُستَحق." },
      { property: "og:title", content: "الملف الشخصي | مُستَحق" },
      { property: "og:description", content: "إدارة بياناتك ودرجة الثقة داخل مُستَحق." },
    ],
  }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: email } = useQuery({
    queryKey: ["auth-email"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.email ?? "",
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = z
        .object({
          full_name: z.string().trim().min(2, "اكتب اسمك الكامل").max(80),
          phone: z
            .string()
            .trim()
            .max(20)
            .regex(/^[0-9+\s-]*$/, "رقم الجوال غير صحيح"),
        })
        .parse({ full_name: fullName, phone });

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("انتهت الجلسة");

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: parsed.full_name, phone: parsed.phone || null })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ بياناتك");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => {
      const message =
        error instanceof z.ZodError ? error.issues[0]!.message : (error as Error).message;
      toast.error(message);
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const trust = profile?.trust_score ?? 80;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">الملف الشخصي</h1>

      <section className="card-surface p-5">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="size-5" />
          <p className="text-sm font-bold">درجة الثقة</p>
        </div>
        <p className="mt-2 text-3xl font-extrabold">{trust}%</p>
        <Progress className="mt-3" value={trust} />
        <p className="mt-2 text-xs text-muted-foreground">
          ترتفع درجتك مع الالتزام بالسداد في وقته.
        </p>
      </section>

      <section className="card-surface space-y-4 p-5">
        <div className="space-y-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" dir="ltr" value={email ?? ""} readOnly disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">الاسم الكامل</Label>
          <Input
            id="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={80}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">رقم الجوال</Label>
          <Input
            id="phone"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            placeholder="9665xxxxxxxx"
          />
        </div>
        <Button
          className="w-full font-bold"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && <Loader2 className="me-2 size-4 animate-spin" />}
          حفظ التغييرات
        </Button>
      </section>

      <Button variant="outline" className="w-full font-bold" onClick={signOut}>
        <LogOut className="size-4" /> تسجيل الخروج
      </Button>
    </div>
  );
}
