import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة | مُستَحق" },
      { name: "description", content: "اختر كلمة مرور جديدة لحسابك في مُستَحق." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة | مُستَحق" },
      { property: "og:description", content: "استعادة الدخول إلى حسابك في مُستَحق." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = z
      .string()
      .min(8, "كلمة المرور 8 أحرف على الأقل")
      .max(72)
      .safeParse(password);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    setLoading(false);
    if (error) {
      toast.error("تعذّر تحديث كلمة المرور، اطلب رابطاً جديداً.");
      return;
    }
    toast.success("تم تحديث كلمة المرور");
    navigate({ to: "/home", replace: true });
  }

  return (
    <main className="gradient-hero flex min-h-screen items-center justify-center px-5">
      <form onSubmit={handleSubmit} className="card-surface w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-bold">كلمة مرور جديدة</h1>
        <div className="space-y-2">
          <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
          <Input
            id="new-password"
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={72}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full font-bold" disabled={loading}>
          {loading && <Loader2 className="me-2 size-4 animate-spin" />}
          حفظ
        </Button>
      </form>
    </main>
  );
}
