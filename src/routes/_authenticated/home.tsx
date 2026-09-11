import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Plus, Users, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { formatSar, formatDate, debtStatusLabels } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "الرئيسية | مُستَحق" },
      { name: "description", content: "ملخص ديونك وجمعياتك وآخر الحركات في مُستَحق." },
      { property: "og:title", content: "الرئيسية | مُستَحق" },
      { property: "og:description", content: "لك وعليك، جمعياتك النشطة، وآخر النشاطات." },
    ],
  }),
  component: HomeScreen,
});

function HomeScreen() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: debts = [] } = useQuery({
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

  const { data: associations = [] } = useQuery({
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

  const open = debts.filter((d) => d.status !== "paid");
  const owedToMe = open
    .filter((d) => d.direction === "owed_to_me")
    .reduce((sum, d) => sum + Number(d.amount), 0);
  const iOwe = open
    .filter((d) => d.direction === "i_owe")
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const firstName = (profile?.full_name || "").split(" ")[0] || "صديقنا";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">أهلاً</p>
          <h1 className="text-2xl font-extrabold">{firstName} 👋</h1>
        </div>
        <span className="card-surface p-2.5 text-muted-foreground">
          <Bell className="size-5" />
        </span>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="card-surface p-4">
          <p className="text-xs text-muted-foreground">لك</p>
          <p className="mt-1 text-xl font-extrabold text-primary">{formatSar(owedToMe)}</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs text-muted-foreground">عليك</p>
          <p className="mt-1 text-xl font-extrabold text-gold">{formatSar(iOwe)}</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Button asChild className="h-12 font-bold">
          <Link to="/associations">
            <Users className="size-4" /> إنشاء جمعية
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-12 font-bold">
          <Link to="/debts">
            <HandCoins className="size-4" /> تسجيل دين
          </Link>
        </Button>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold">الجمعيات النشطة</h2>
        {associations.length === 0 ? (
          <div className="card-surface p-5 text-center text-xs text-muted-foreground">
            ما عندك جمعيات بعد.
            <Link to="/associations" className="mx-1 font-bold text-primary">
              أنشئ أول جمعية
            </Link>
          </div>
        ) : (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {associations.map((a) => (
              <article key={a.id} className="card-surface min-w-[220px] shrink-0 p-4">
                <p className="text-sm font-bold">{a.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  الشهر {a.current_month} من {a.members_count}
                </p>
                <Progress
                  className="mt-3"
                  value={Math.min(100, (a.current_month / Math.max(1, a.members_count)) * 100)}
                />
                <p className="mt-3 text-xs text-gold">
                  {a.my_turn_month
                    ? `دورك في الشهر ${a.my_turn_month}`
                    : "لم يتم تحديد دورك بعد"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold">آخر النشاطات</h2>
        {open.length === 0 ? (
          <div className="card-surface p-5 text-center text-xs text-muted-foreground">
            لا توجد حركات حالياً.
          </div>
        ) : (
          <ul className="space-y-2">
            {open.slice(0, 5).map((d) => (
              <li key={d.id} className="card-surface flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-bold">{d.counterparty_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {debtStatusLabels[d.status]} · {formatDate(d.due_date)}
                  </p>
                </div>
                <p
                  className={
                    d.direction === "owed_to_me"
                      ? "text-sm font-extrabold text-primary"
                      : "text-sm font-extrabold text-gold"
                  }
                >
                  {formatSar(d.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button asChild variant="secondary" className="w-full font-bold">
        <Link to="/assistant">
          <Plus className="size-4" /> اسأل المساعد الذكي
        </Link>
      </Button>
    </div>
  );
}
