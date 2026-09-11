import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PaySchema = z.object({
  debtId: z.string().uuid(),
  origin: z.string().url().max(300),
});

/** Creates a Stripe Checkout session to settle one of the user's own debts. */
export const createDebtCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PaySchema.parse(input))
  .handler(async ({ data, context }) => {
    const secretKey = process.env["STRIPE_TEST_API_KEY"];
    if (!secretKey) {
      return { ok: false as const, error: "بوابة الدفع غير مهيأة حالياً." };
    }

    const { data: debt, error } = await context.supabase
      .from("debts")
      .select("id, amount, counterparty_name, status")
      .eq("id", data.debtId)
      .single();

    if (error || !debt) {
      return { ok: false as const, error: "لم يتم العثور على الدين." };
    }
    if (debt.status === "paid") {
      return { ok: false as const, error: "هذا الدين مسدد مسبقاً." };
    }

    const amountHalalas = Math.round(Number(debt.amount) * 100);
    if (amountHalalas < 200) {
      return { ok: false as const, error: "المبلغ صغير جداً للدفع الإلكتروني." };
    }

    const body = new URLSearchParams({
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "sar",
      "line_items[0][price_data][unit_amount]": String(amountHalalas),
      "line_items[0][price_data][product_data][name]": `سداد دين: ${debt.counterparty_name}`,
      success_url: `${data.origin}/debts?paid=${debt.id}`,
      cancel_url: `${data.origin}/debts`,
      "metadata[debt_id]": debt.id,
      "metadata[user_id]": context.userId,
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      console.error("Stripe error", res.status, await res.text());
      return { ok: false as const, error: "تعذّر إنشاء عملية الدفع، حاول لاحقاً." };
    }

    const session = (await res.json()) as { url?: string };
    if (!session.url) {
      return { ok: false as const, error: "تعذّر إنشاء رابط الدفع." };
    }
    return { ok: true as const, url: session.url };
  });
