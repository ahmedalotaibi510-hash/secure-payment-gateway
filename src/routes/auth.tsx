import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | مُستَحق" },
      { name: "description", content: "سجّل الدخول أو أنشئ حساباً في مُستَحق لإدارة ديونك وجمعياتك." },
      { property: "og:title", content: "تسجيل الدخول | مُستَحق" },
      { property: "og:description", content: "حسابك في مُستَحق: ديونك وجمعياتك في مكان واحد." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("البريد الإلكتروني غير صحيح").max(255);
const passwordSchema = z.string().min(8, "كلمة المرور 8 أحرف على الأقل").max(72);
const nameSchema = z.string().trim().min(2, "اكتب اسمك الكامل").max(80);

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(mode !== "signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const parsedEmail = emailSchema.safeParse(email);
      if (!parsedEmail.success) throw new Error(parsedEmail.error.issues[0]!.message);
      const parsedPassword = passwordSchema.safeParse(password);
      if (!parsedPassword.success) throw new Error(parsedPassword.error.issues[0]!.message);

      if (isSignUp) {
        const parsedName = nameSchema.safeParse(fullName);
        if (!parsedName.success) throw new Error(parsedName.error.issues[0]!.message);

        const { data, error } = await supabase.auth.signUp({
          email: parsedEmail.data,
          password: parsedPassword.data,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: parsedName.data },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setEmailSent(true);
          toast.success("تم إنشاء الحساب، تحقق من بريدك لتأكيد التسجيل.");
          return;
        }
        toast.success("تم إنشاء حسابك، أهلاً بك!");
        navigate({ to: "/home", replace: true });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: parsedEmail.data,
        password: parsedPassword.data,
      });
      if (error) throw error;
      toast.success("تم تسجيل الدخول");
      navigate({ to: "/home", replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
      toast.error(
        message === "Invalid login credentials" ? "البريد أو كلمة المرور غير صحيحة" : message,
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      toast.error("اكتب بريدك الإلكتروني أولاً");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("تعذّر إرسال رابط الاستعادة");
      return;
    }
    toast.success("أرسلنا لك رابط استعادة كلمة المرور");
  }

  if (emailSent) {
    return (
      <main className="gradient-hero flex min-h-screen items-center justify-center px-5">
        <div className="card-surface max-w-sm p-6 text-center">
          <h1 className="text-xl font-bold">تحقق من بريدك</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            أرسلنا رابط تأكيد إلى <span className="font-semibold text-foreground">{email}</span>.
            افتح الرابط لتفعيل حسابك ثم سجّل الدخول.
          </p>
          <Button className="mt-6 w-full" onClick={() => setEmailSent(false)}>
            رجوع
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="gradient-hero min-h-screen px-5 py-10">
      <div className="mx-auto max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
        >
          <ArrowRight className="size-4" /> رجوع
        </Link>

        <h1 className="mt-6 text-3xl font-extrabold">
          {isSignUp ? "إنشاء حساب" : "تسجيل الدخول"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSignUp ? "خلّ ديونك وجمعياتك منظمة من أول يوم." : "أهلاً بك مرة ثانية في مُستَحق."}
        </p>

        <form onSubmit={handleSubmit} className="card-surface mt-6 space-y-4 p-5">
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="fullName">الاسم الكامل</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="أحمد العتيبي"
                maxLength={80}
                autoComplete="name"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              maxLength={255}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
          </div>

          <Button type="submit" className="w-full font-bold" disabled={loading}>
            {loading && <Loader2 className="me-2 size-4 animate-spin" />}
            {isSignUp ? "إنشاء الحساب" : "دخول"}
          </Button>

          {!isSignUp && (
            <button
              type="button"
              onClick={handleReset}
              className="w-full text-xs font-semibold text-muted-foreground"
            >
              نسيت كلمة المرور؟
            </button>
          )}
        </form>

        <button
          type="button"
          onClick={() => setIsSignUp((prev) => !prev)}
          className="mt-5 w-full text-sm font-semibold text-primary"
        >
          {isSignUp ? "لدي حساب بالفعل · تسجيل الدخول" : "ما عندي حساب · إنشاء حساب"}
        </button>
      </div>
    </main>
  );
}
