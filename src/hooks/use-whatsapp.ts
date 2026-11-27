"use client";

import useSWR from "swr";
import { getWhatsapp, getWhatsappQr } from "@/lib/api";

const WHATSAPP_KEY = "/whatsapp";

/** Estado da conexão do número (polling de 3 s; a lateral e a tela de conexão compartilham o cache). */
export function useWhatsapp() {
  return useSWR(WHATSAPP_KEY, getWhatsapp, { refreshInterval: 3000 });
}

/** QR code para parear. Só busca enquanto a tela está esperando a leitura. */
export function useWhatsappQr(enabled: boolean) {
  return useSWR(enabled ? "/whatsapp/qr" : null, getWhatsappQr, { refreshInterval: 3000 });
}
