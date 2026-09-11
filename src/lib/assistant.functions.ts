import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AskSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
});

const SYSTEM_PROMPT = `أنت "مساعد مُستَحق"، مساعد ذكي داخل تطبيق سعودي لإدارة الديون الشخصية والجمعيات المالية (الجمعيات الدورية).
- جاوب بالعربية فقط وبأسلوب قصير ومهذّب.
- تخصصك: شرح كيف يعمل التطبيق (الجمعيات، الديون، التذكيرات، السداد)، وحساب الأقساط والأنصبة والتواريخ، ونصائح تنظيم الديون.
- إذا كان السؤال خارج هذا النطاق، اعتذر بلطف وقل إنك مخصص لأسئلة الديون والجمعيات داخل تطبيق مُستَحق فقط.
- لا تعطِ فتاوى شرعية أو استشارات قانونية، ولا تطلب أرقام بطاقات أو بيانات بنكية.`;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function callProvider(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<{ status: number; reply?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, max_tokens: 700, messages }),
  });

  if (!res.ok) {
    console.error("assistant provider error", url, res.status, await res.text());
    return { status: res.status };
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return { status: 200, reply: json.choices?.[0]?.message?.content?.trim() };
}

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskSchema.parse(input))
  .handler(async ({ data }) => {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...data.messages,
    ];

    const openRouterKey = process.env["OPENROUTER_API_KEY"];
    let lastStatus = 0;

    if (openRouterKey) {
      const result = await callProvider(
        "https://openrouter.ai/api/v1/chat/completions",
        openRouterKey,
        "openai/gpt-4o-mini",
        messages,
      );
      if (result.reply) return { ok: true as const, reply: result.reply };
      lastStatus = result.status;
      if (result.status === 429) {
        return { ok: false as const, error: "الطلبات كثيرة الآن، جرّب بعد لحظات." };
      }
    }

    // Fallback to the built-in AI provider (no user key needed).
    const lovableKey = process.env["LOVABLE_API_KEY"];
    if (lovableKey) {
      const result = await callProvider(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        lovableKey,
        "google/gemini-3.8-flash",
        messages,
      );
      if (result.reply) return { ok: true as const, reply: result.reply };
      lastStatus = result.status;
      if (result.status === 429) {
        return { ok: false as const, error: "الطلبات كثيرة الآن، جرّب بعد لحظات." };
      }
      if (result.status === 402 || result.status === 403) {
        return { ok: false as const, error: "رصيد المساعد الذكي انتهى، يحتاج تعبئة." };
      }
    }

    if (lastStatus === 401) {
      return { ok: false as const, error: "مفتاح المساعد غير صالح، حدّثه من الإعدادات." };
    }
    return { ok: false as const, error: "تعذّر الوصول للمساعد الذكي حالياً، جرّب بعد قليل." };
  });

