import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldCheck, Users, HandCoins, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "مُستَحق | ديونك وجمعياتك بدون إحراج" },
      {
        name: "description",
        content:
          "مُستَحق يساعدك تتابع من يطلبك ومن تطلبه، وتدير جمعياتك المالية وتذكّر الأعضاء وتسدد إلكترونياً.",
      },
      { property: "og:title", content: "مُستَحق | ديونك وجمعياتك بدون إحراج" },
      {
        property: "og:description",
        content: "تتبّع الديون، أنشئ جمعية، وأرسل تذكيراً ودياً — كل شي من مكان واحد.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: HandCoins, title: "تتبّع الديون", text: "اعرف من يطلبك ومن تطلبه بدقيقة." },
  { icon: Users, title: "الجمعيات المالية", text: "دورات وأنصبة وأدوار واضحة للأعضاء." },
  { icon: Sparkles, title: "مساعد ذكي", text: "يجاوب على أسئلتك حول الديون والجمعيات." },
  { icon: ShieldCheck, title: "خصوصية تامة", text: "بياناتك محفوظة ومربوطة بحسابك فقط." },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  return (
    <main className="gradient-hero min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-between px-5 py-10">
        <div>
          <span className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            مُستَحق · Mustahaq
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight">
            ديونك وجمعياتك
            <br />
            <span className="text-primary">بدون إحراج</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            سجّل الدين، تابع الجمعية، وأرسل تذكيراً ودياً بدل المكالمات المحرجة. وسدّد إلكترونياً
            بضغطة.
          </p>

          <ul className="mt-8 grid gap-3">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="card-surface flex items-start gap-3 p-4">
                <span className="rounded-xl bg-primary/15 p-2 text-primary">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-bold">{title}</span>
                  <span className="block text-xs text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 space-y-3">
          <Button asChild size="lg" className="w-full text-base font-bold">
            <Link to="/auth">إنشاء حساب جديد</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full text-base font-bold">
            <Link to="/auth" search={{ mode: "signin" }}>
              لدي حساب · تسجيل الدخول
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
