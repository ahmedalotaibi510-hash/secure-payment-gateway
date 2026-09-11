import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAssistant } from "@/lib/assistant.functions";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "المساعد الذكي | مُستَحق" },
      {
        name: "description",
        content: "مساعد ذكي يجاوب على أسئلتك حول الديون والجمعيات المالية داخل مُستَحق.",
      },
      { property: "og:title", content: "المساعد الذكي | مُستَحق" },
      { property: "og:description", content: "اسأل عن الأنصبة والأدوار وتنظيم الديون." },
    ],
  }),
  component: AssistantScreen,
});

type Message = { role: "user" | "assistant"; content: string };

const suggestions = [
  "كيف أحسب سهم الشهر لجمعية من 10 أعضاء؟",
  "كيف أذكّر شخص بدين بدون إحراج؟",
  "وش الفرق بين حالة مؤكد وفي انتظار الموافقة؟",
];

function AssistantScreen() {
  const ask = useServerFn(askAssistant);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "أهلاً بك! أنا مساعد مُستَحق. اسألني عن ديونك أو جمعياتك وأساعدك فوراً.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const result = await ask({
        data: {
          messages: nextMessages
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
    } catch {
      toast.error("تعذّر الاتصال بالمساعد");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[75vh] flex-col">
      <header className="flex items-center gap-2">
        <span className="rounded-xl bg-primary/15 p-2 text-primary">
          <Sparkles className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold">المساعد الذكي</h1>
          <p className="text-xs text-muted-foreground">مخصص لأسئلة الديون والجمعيات</p>
        </div>
      </header>

      <div className="mt-5 flex-1 space-y-3">
        {messages.map((m, index) => (
          <div
            key={index}
            className={
              m.role === "user"
                ? "ms-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                : "card-surface max-w-[90%] whitespace-pre-wrap p-4 text-sm leading-relaxed"
            }
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="card-surface flex max-w-[60%] items-center gap-2 p-4 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> يكتب…
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="mt-4 space-y-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="card-surface w-full p-3 text-start text-xs text-muted-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="sticky bottom-24 mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب سؤالك…"
          maxLength={2000}
        />
        <Button type="submit" size="icon" disabled={loading}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
