import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

// Cor estável por nome: o mesmo contato sempre tem a mesma cor.
const COLORS = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
];

export function ContactAvatar({
  name,
  seed,
  className,
}: {
  name: string;
  seed: string;
  className?: string;
}) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <Avatar className={cn("size-10", className)}>
      <AvatarFallback className={cn("font-semibold", COLORS[h % COLORS.length])}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
