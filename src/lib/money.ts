export function formatSar(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return `${amount.toLocaleString("ar-KW", { maximumFractionDigits: 3 })} د.ك`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "بدون تاريخ";
  return new Date(value).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const debtStatusLabels: Record<string, string> = {
  confirmed: "مؤكد",
  pending: "في انتظار الموافقة",
  late: "متأخر",
  paid: "مسدد",
};
