/** Live Q&A chat panel. Posts the conversation to /api/chat; each reply shows Live, model and ms. */
import { apiPost } from "./api";

interface Msg { role: "user" | "assistant"; content: string }
interface Reply { answer: string; handed_to_human: boolean; confidence: number; step_id: string; model?: string; ms?: number }

class ChatPanel extends HTMLElement {
  private messages: Msg[] = [];
  private q = <T extends Element>(sel: string) => this.querySelector(sel) as T;

  connectedCallback() {
    const openBtn = this.q<HTMLButtonElement>("[data-chat-open]");
    const box = this.q<HTMLElement>("[data-chat-box]");
    const input = this.q<HTMLInputElement>("[data-chat-input]");

    const setOpen = (open: boolean) => {
      box.hidden = !open;
      openBtn.hidden = open;
      openBtn.setAttribute("aria-expanded", String(open));
      (open ? input : openBtn).focus();
    };
    openBtn.addEventListener("click", () => setOpen(true));
    this.q("[data-chat-close]").addEventListener("click", () => setOpen(false));
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

    this.q<HTMLFormElement>("[data-chat-form]").addEventListener("submit", (e) => {
      e.preventDefault();
      this.send(input.value);
      input.value = "";
    });
    this.querySelectorAll<HTMLButtonElement>("[data-chat-suggestion]").forEach((b) =>
      b.addEventListener("click", () => this.send(b.textContent ?? "")));
  }

  private async send(text: string) {
    text = text.trim();
    const submit = this.q<HTMLButtonElement>("[data-chat-form] button[type=submit]");
    if (!text || submit.disabled) return;
    this.q<HTMLElement>("[data-chat-suggest]").hidden = true;
    this.messages.push({ role: "user", content: text });
    this.addBubble(text, "user");

    const typing = this.q<HTMLElement>("[data-chat-typing]");
    typing.hidden = false;
    submit.disabled = true;
    try {
      const r = await apiPost<Reply>("/api/chat", {
        conference_id: this.dataset.conference, mode: this.dataset.mode,
        lang: this.dataset.lang, messages: this.messages,
      });
      this.messages.push({ role: "assistant", content: r.answer });
      this.addBubble(r.answer, "assistant", r);
    } catch {
      this.messages.pop();
      this.addBubble(this.dataset.error ?? "", "assistant");
    } finally {
      typing.hidden = true;
      submit.disabled = false;
    }
  }

  private addBubble(text: string, role: Msg["role"], r?: Reply) {
    const li = document.createElement("li");
    li.className = role === "user"
      ? "self-end max-w-[85%] rounded-lg bg-theme px-3 py-2 text-sm text-paper"
      : "self-start max-w-[90%] rounded-lg bg-muted px-3 py-2 text-sm text-ink";
    const p = document.createElement("p");
    p.className = "whitespace-pre-line";
    p.textContent = text;
    li.append(p);
    if (r) {
      const meta = document.createElement("div");
      meta.className = "mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-soft";
      const tpl = this.q<HTMLTemplateElement>("[data-chat-live]");
      meta.append(tpl.content.cloneNode(true));
      for (const s of [r.model?.replace(/^.*\//, ""), r.ms != null ? `${(r.ms / 1000).toFixed(1)} s` : null]) {
        if (!s) continue;
        const span = document.createElement("span");
        span.textContent = s;
        meta.append(span);
      }
      li.append(meta);
      if (r.handed_to_human) {
        const h = document.createElement("p");
        h.className = "mt-2 rounded border border-banana/40 bg-banana-soft px-2 py-1 text-xs font-semibold text-banana";
        h.textContent = this.dataset.handed ?? "";
        li.append(h);
      }
    }
    const log = this.q<HTMLElement>("[data-chat-log]");
    log.append(li);
    log.scrollTop = log.scrollHeight;
  }
}

customElements.define("chat-panel", ChatPanel);
