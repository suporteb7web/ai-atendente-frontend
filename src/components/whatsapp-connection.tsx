"use client";

import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogOut,
  MessagesSquare,
  QrCode,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWhatsapp, useWhatsappQr } from "@/hooks/use-whatsapp";
import { activateLicense, connectWhatsapp, disconnectWhatsapp, getLicenseLink } from "@/lib/api";
import { formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEPS = ["Licença", "Conectar", "Pronto"] as const;

// Em que passo o fluxo está, a partir do status que o backend devolve.
function stepOf(status: string | undefined) {
  if (status === "license_required") return 0;
  if (status === "connected") return 2;
  return 1;
}

export function WhatsappConnection() {
  const router = useRouter();
  const params = useSearchParams();
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useWhatsapp();
  const status = data?.status;

  const [busy, setBusy] = useState<null | "license" | "connect" | "disconnect" | "activate">(null);
  const [started, setStarted] = useState(false); // clicou em "Conectar" nesta tela
  const [activationError, setActivationError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");

  const showQr = status === "connecting" || (started && status === "disconnected");
  const { data: qr } = useWhatsappQr(showQr);

  const refresh = () => mutate("/whatsapp");

  // 1. O provedor da licença volta para /whatsapp?code=...: ativa e limpa a URL.
  const code = params.get("code");
  const activating = useRef(false);
  useEffect(() => {
    if (!code || activating.current) return;
    activating.current = true;
    setBusy("activate");
    activateLicense(code)
      .then(() => {
        toast.success("Licença ativada!");
        router.replace("/whatsapp");
      })
      .catch((e: Error) => {
        setActivationError(e.message);
        router.replace("/whatsapp");
      })
      .finally(() => {
        setBusy(null);
        refresh();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<unknown>, after?: () => void) {
    setBusy(kind);
    try {
      await fn();
      after?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
      refresh();
    }
  }

  const goToLicense = () =>
    run("license", async () => {
      const { registerUrl } = await getLicenseLink(`${window.location.origin}/whatsapp`);
      window.location.href = registerUrl; // o provedor volta aqui com ?code=
    });
  const activateManually = () =>
    run("activate", () => activateLicense(manualCode.trim()), () => {
      setManualCode("");
      setActivationError(null);
      toast.success("Licença ativada!");
    });
  const connect = () => run("connect", connectWhatsapp, () => setStarted(true));
  const disconnect = () => run("disconnect", disconnectWhatsapp, () => setStarted(false));

  const step = stepOf(status);

  return (
    <div className="chat-bg flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
        <Button variant="ghost" size="sm" className="mb-4 md:hidden" nativeButton={false} render={<Link href="/" />}>
          <ArrowLeft /> Conversas
        </Button>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <QrCode className="size-7" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Conectar WhatsApp</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O atendente responde pelo número que você conectar aqui.
          </p>
        </div>

        <Stepper current={step} />

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          {isLoading ? (
            <Centered>
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </Centered>
          ) : error && !data ? (
            <Problem
              title="Não consegui falar com o backend"
              text={error.message}
              action={<Button onClick={refresh}>Tentar de novo</Button>}
            />
          ) : busy === "activate" ? (
            <Centered>
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Ativando a licença...</p>
            </Centered>
          ) : status === "unavailable" ? (
            <Problem
              title="O EvolutionGo não respondeu"
              text="Confirme que ele está no ar (docker compose up) e tente de novo."
              action={<Button onClick={refresh}>Tentar de novo</Button>}
            />
          ) : status === "license_required" ? (
            <div className="space-y-4 text-center">
              <ShieldCheck className="mx-auto size-8 text-primary" />
              <div>
                <h3 className="font-semibold">Ative a licença do EvolutionGo</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  É um cadastro gratuito, feito uma única vez no site do provedor. Quando terminar, você volta
                  automaticamente para cá.
                </p>
              </div>
              {activationError && <p className="text-sm text-destructive">{activationError}</p>}
              <Button size="lg" className="h-10" onClick={goToLicense} disabled={busy === "license"}>
                {busy === "license" ? <Loader2 className="animate-spin" /> : <ExternalLink />}
                Cadastrar e ativar licença
              </Button>
              <details className="text-left text-sm">
                <summary className="cursor-pointer text-center text-muted-foreground hover:text-foreground">
                  Já tenho o código de ativação
                </summary>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Cole o código aqui"
                    aria-label="Código de ativação da licença"
                  />
                  <Button onClick={activateManually} disabled={!manualCode.trim()}>
                    Ativar
                  </Button>
                </div>
              </details>
            </div>
          ) : status === "connected" ? (
            <div className="space-y-5 text-center">
              <CheckCircle2 className="mx-auto size-10 text-primary" />
              <div>
                <h3 className="text-lg font-semibold">WhatsApp conectado</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data?.name && <span className="font-medium text-foreground">{data.name}</span>}
                  {data?.name && data?.phone && " · "}
                  {data?.phone && formatPhone(data.phone)}
                  {!data?.name && !data?.phone && "Número pareado e no ar."}
                </p>
              </div>
              <div className="flex flex-col justify-center gap-2 sm:flex-row">
                <Button size="lg" className="h-10" nativeButton={false} render={<Link href="/" />}>
                  <MessagesSquare /> Ver conversas
                </Button>
                <Button variant="outline" size="lg" className="h-10" onClick={disconnect} disabled={busy === "disconnect"}>
                  {busy === "disconnect" ? <Loader2 className="animate-spin" /> : <LogOut />}
                  Desconectar
                </Button>
              </div>
            </div>
          ) : showQr ? (
            <div className="space-y-4 text-center">
              <div>
                <h3 className="font-semibold">Leia o QR code com o WhatsApp</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  No celular: <strong>Configurações → Aparelhos conectados → Conectar um aparelho</strong>.
                </p>
              </div>
              <div className="mx-auto flex size-60 items-center justify-center rounded-2xl border bg-white p-3 shadow-sm">
                {qr?.qrcode ? (
                  // data URL vindo do backend: next/image não agrega nada aqui
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr.qrcode} alt="QR code para conectar o WhatsApp" className="size-full [image-rendering:pixelated]" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-6 animate-spin" />
                    Gerando QR...
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">O QR renova sozinho. Esta tela avisa quando conectar.</p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={connect} disabled={busy === "connect"}>
                  <RefreshCw className={cn(busy === "connect" && "animate-spin")} /> Gerar novo QR
                </Button>
                <Button variant="ghost" onClick={disconnect} disabled={busy === "disconnect"}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <BadgeCheck className="mx-auto size-8 text-primary" />
              <div>
                <h3 className="font-semibold">Pronto para conectar</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vamos gerar um QR code para você parear o número do atendente.
                </p>
              </div>
              <Button size="lg" className="h-10" onClick={connect} disabled={busy === "connect"}>
                {busy === "connect" ? <Loader2 className="animate-spin" /> : <QrCode />}
                Conectar WhatsApp
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-5 flex items-center justify-center gap-2 text-xs font-medium">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1",
              i < current && "bg-primary/15 text-primary",
              i === current && "bg-primary text-primary-foreground",
              i > current && "bg-muted text-muted-foreground",
            )}
          >
            {i < current ? <CheckCircle2 className="size-3.5" /> : <span>{i + 1}</span>}
            {label}
          </span>
          {i < STEPS.length - 1 && <span className="h-px w-5 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-3 py-6">{children}</div>;
}

function Problem({ title, text, action }: { title: string; text: string; action: React.ReactNode }) {
  return (
    <div className="space-y-3 text-center">
      <TriangleAlert className="mx-auto size-8 text-destructive" />
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}
