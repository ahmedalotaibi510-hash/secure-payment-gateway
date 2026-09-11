import { Link } from "@tanstack/react-router";
import { Home, Users, HandCoins, User, Sparkles } from "lucide-react";

const items = [
  { to: "/home", label: "الرئيسية", icon: Home },
  { to: "/associations", label: "الجمعيات", icon: Users },
  { to: "/debts", label: "الديون", icon: HandCoins },
  { to: "/assistant", label: "المساعد", icon: Sparkles },
  { to: "/profile", label: "حسابي", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 py-2">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
