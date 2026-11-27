import { Suspense } from "react";
import { WhatsappConnection } from "@/components/whatsapp-connection";

// useSearchParams (o ?code= da licença) precisa de Suspense.
export default function WhatsappPage() {
  return (
    <Suspense>
      <WhatsappConnection />
    </Suspense>
  );
}
