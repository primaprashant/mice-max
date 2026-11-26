/** Live booking call panel: starts an ElevenLabs voice session in the browser, then asks the backend for the booking. */
import { apiGet, apiPost } from "./api";

// Loaded from a CDN so the UI needs no new npm dependency.
const SDK = "https://esm.sh/@elevenlabs/client@1.38.0";

interface AgentInfo { agent_id: string; hotel_ja: string; hotel_en: string; day: string }
interface Booking { confirmed: boolean; date: string | null; time: string | null; party: number | null; notes_en: string; notes_ja: string }

async function init(root: HTMLElement) {
  const conf = root.dataset.conference!;
  const lang = root.dataset.lang as "en" | "ja";
  const s: Record<string, string> = JSON.parse(root.dataset.strings!);
  const labels: Record<string, string> = JSON.parse(root.dataset.labels!);
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const start = $<HTMLButtonElement>("[data-start]");
  const end = $<HTMLButtonElement>("[data-end]");
  const status = $("[data-status]");
  const list = $("[data-transcript]");

  let info: AgentInfo;
  try {
    info = await apiGet<AgentInfo>(`/api/voice/${conf}`);
  } catch {
    return; // no agent for this conference: panel stays hidden
  }
  const hotel = lang === "ja" ? info.hotel_ja : info.hotel_en;
  $("[data-role]").textContent = labels.role.replace("{hotel}", hotel).replace("{day}", info.day);
  root.hidden = false;

  let session: { endSession(): Promise<void>; getId(): string } | null = null;
  let conversationId: string | null = null;

  const addLine = (role: string, text: string) => {
    $("[data-transcript-box]").hidden = false;
    const li = document.createElement("li");
    li.className = "flex gap-3 text-sm";
    const who = document.createElement("span");
    who.className = "w-24 shrink-0 pt-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft";
    who.textContent = role === "agent" ? labels.agent : labels.staff;
    const msg = document.createElement("span");
    msg.className = "min-w-0 break-words";
    msg.textContent = text;
    li.append(who, msg);
    list.append(li);
  };

  const showResult = (b: Booking) => {
    $("[data-r-confirmed]").textContent = b.confirmed ? labels.confirmed : labels.notConfirmed;
    $("[data-r-date]").textContent = b.date ?? "";
    $("[data-r-time]").textContent = b.time ?? "";
    $("[data-r-party]").textContent = b.party == null ? "" : String(b.party);
    $("[data-r-notes]").textContent = lang === "ja" ? b.notes_ja : b.notes_en;
    $("[data-result]").hidden = false;
  };

  const finish = async () => {
    session = null;
    end.hidden = true;
    start.hidden = false;
    start.disabled = true;
    status.textContent = s.reading;
    try {
      const r = await apiPost<{ booking: Booking }>(`/api/voice/${conf}/result`, { conversation_id: conversationId });
      showResult(r.booking);
      status.textContent = s.done;
    } catch {
      status.textContent = s.error;
    }
    start.disabled = false;
  };

  start.addEventListener("click", async () => {
    start.disabled = true;
    list.replaceChildren();
    $("[data-result]").hidden = true;
    status.textContent = s.connecting;
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      status.textContent = s.mic;
      start.disabled = false;
      return;
    }
    try {
      const { Conversation } = await import(/* @vite-ignore */ SDK);
      session = await Conversation.startSession({
        agentId: info.agent_id,
        connectionType: "webrtc",
        onConnect: () => {
          conversationId = session?.getId() ?? conversationId;
          start.hidden = true;
          end.hidden = false;
        },
        onModeChange: ({ mode }: { mode: string }) => {
          status.textContent = mode === "speaking" ? s.speaking : s.listening;
        },
        onMessage: (m: { message: string; role?: string; source?: string }) =>
          addLine(m.role ?? (m.source === "ai" ? "agent" : "user"), m.message),
        onDisconnect: () => void finish(),
        onError: () => { status.textContent = s.error; },
      });
      conversationId = session!.getId();
    } catch {
      status.textContent = s.error;
      start.disabled = false;
    }
  });

  end.addEventListener("click", () => void session?.endSession());
}

document.querySelectorAll<HTMLElement>("[data-voice-call]").forEach((el) => void init(el));
