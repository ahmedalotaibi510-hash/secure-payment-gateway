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

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      return { ok: false as const, error: "خدمة المساعد غير مهيأة حالياً." };
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: 700,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("OpenRouter error", res.status, detail);
      if (res.status === 429) {
        return { ok: false as const, error: "الطلبات كثيرة الآن، جرّب بعد لحظات." };
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false as const, error: "مفتاح المساعد غير صالح أو منتهي." };
      }
      return { ok: false as const, error: "تعذّر الوصول للمساعد الذكي حالياً." };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return { ok: false as const, error: "ما وصلني رد من المساعد، جرّب مرة ثانية." };
    }
    return { ok: true as const, reply };
  });
