#!/usr/bin/env python3
import json
import os
import queue
import re
import sys
import threading
import urllib.error
import urllib.request
import tkinter as tk
from tkinter import ttk


class JarvisClient:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip("/")
        self.session_id = None

    def get(self, path):
        with urllib.request.urlopen(f"{self.base_url}{path}", timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))

    def post(self, path, payload):
        data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            headers={"content-type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))

    def chat(self, message, mode, privacy_level, runtime_profile):
        payload = {
            "message": message,
            "mode": mode,
            "privacyLevel": privacy_level,
            "runtimeProfile": runtime_profile,
            "sessionId": self.session_id,
            "title": "Jarvis Python session",
        }
        data = self.post("/chat", payload)
        self.session_id = data.get("sessionId") or self.session_id
        return data

    def stream_events(self):
        request = urllib.request.Request(f"{self.base_url}/events/stream", headers={"accept": "text/event-stream"})
        with urllib.request.urlopen(request, timeout=None) as response:
            event_type = "message"
            data_lines = []
            for raw_line in response:
                line = raw_line.decode("utf-8").rstrip("\r\n")
                if not line:
                    if data_lines:
                        payload = "\n".join(data_lines)
                        yield event_type, payload
                    event_type = "message"
                    data_lines = []
                    continue
                if line.startswith("event:"):
                    event_type = line[6:].strip()
                elif line.startswith("data:"):
                    data_lines.append(line[5:].strip())


class JarvisChatApp:
    def __init__(self, root, client):
        self.root = root
        self.client = client
        self.queue = queue.Queue()
        self.busy = False
        self.connected_status = "Connected"

        root.title("Jarvis Python Chat")
        root.geometry("860x700")
        root.minsize(620, 480)
        root.configure(bg="#0c1114")

        self.mode = tk.StringVar(value="agent")
        self.privacy = tk.StringVar(value="project")
        self.profile = tk.StringVar(value="balanced")
        self.status = tk.StringVar(value="Connecting...")

        self.build_layout()
        self.root.after(100, self.drain_queue)
        self.load_health()

    def build_layout(self):
        self.style = ttk.Style()
        self.style.theme_use("clam")
        self.style.configure("Root.TFrame", background="#0c1114")
        self.style.configure("Panel.TFrame", background="#11191e")
        self.style.configure("TLabel", background="#0c1114", foreground="#edf5f3")
        self.style.configure("Muted.TLabel", background="#0c1114", foreground="#93a2a5")
        self.style.configure("TButton", background="#1f2b31", foreground="#edf5f3", bordercolor="#33434a", focusthickness=0, padding=(14, 10))
        self.style.map("TButton", background=[("active", "#273840")], bordercolor=[("active", "#56c5a4")])

        shell = ttk.Frame(self.root, style="Root.TFrame")
        shell.pack(fill=tk.BOTH, expand=True, padx=22, pady=18)

        header = ttk.Frame(shell, style="Root.TFrame")
        header.pack(fill=tk.X, pady=(0, 12))
        ttk.Label(header, text="Jarvis", font=("Segoe UI", 22, "bold")).pack(side=tk.LEFT)
        ttk.Label(header, textvariable=self.status, style="Muted.TLabel").pack(side=tk.RIGHT)

        chat_frame = ttk.Frame(shell, style="Panel.TFrame")
        chat_frame.pack(fill=tk.BOTH, expand=True)

        self.transcript = tk.Text(
            chat_frame,
            bg="#11191e",
            fg="#edf5f3",
            insertbackground="#edf5f3",
            relief=tk.FLAT,
            padx=20,
            pady=18,
            wrap=tk.WORD,
            font=("Segoe UI", 12),
            state=tk.DISABLED,
        )
        self.transcript.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar = ttk.Scrollbar(chat_frame, command=self.transcript.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.transcript.configure(yscrollcommand=scrollbar.set)
        self.transcript.tag_configure("user_label", foreground="#73cfff", font=("Segoe UI", 10, "bold"), spacing1=10)
        self.transcript.tag_configure("user_body", foreground="#dff4ff", lmargin1=18, lmargin2=18, rmargin=18, spacing3=12)
        self.transcript.tag_configure("jarvis_label", foreground="#9fe8c6", font=("Segoe UI", 10, "bold"), spacing1=10)
        self.transcript.tag_configure("jarvis_body", foreground="#f2f7f4", lmargin1=18, lmargin2=18, rmargin=18, spacing3=14)
        self.transcript.tag_configure("system_label", foreground="#d8c97d", font=("Segoe UI", 10, "bold"), spacing1=10)
        self.transcript.tag_configure("system_body", foreground="#c8d3d2", lmargin1=18, lmargin2=18, rmargin=18, spacing3=12)

        composer = ttk.Frame(shell, style="Root.TFrame")
        composer.pack(fill=tk.X, pady=(14, 0))
        self.entry = tk.Text(
            composer,
            height=3,
            bg="#11191e",
            fg="#edf5f3",
            insertbackground="#edf5f3",
            relief=tk.FLAT,
            padx=14,
            pady=12,
            wrap=tk.WORD,
            font=("Segoe UI", 12),
        )
        self.entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self.entry.bind("<Return>", self.on_enter)
        self.entry.bind("<Shift-Return>", lambda event: None)
        self.send_button = ttk.Button(composer, text="Send", command=self.send)
        self.send_button.pack(side=tk.RIGHT, padx=(10, 0), fill=tk.Y)

        self.add_message("jarvis", "Hey, I'm here. What are we working on?")

    def combo(self, parent, label, variable, values):
        ttk.Label(parent, text=label, style="Muted.TLabel").pack(anchor="w", pady=(10, 4))
        box = ttk.Combobox(parent, textvariable=variable, values=values, state="readonly")
        box.pack(fill=tk.X)

    def on_enter(self, event):
        if event.state & 0x0001:
            return None
        self.send()
        return "break"

    def send(self):
        if self.busy:
            return
        message = self.entry.get("1.0", tk.END).strip()
        if not message:
            return
        self.entry.delete("1.0", tk.END)
        self.add_message("user", message)
        self.busy = True
        self.status.set("Jarvis is thinking...")
        self.send_button.configure(state=tk.DISABLED)
        threading.Thread(target=self.send_worker, args=(message,), daemon=True).start()

    def send_worker(self, message):
        try:
            response = self.client.chat(message, self.mode.get(), self.privacy.get(), self.profile.get())
            self.queue.put(("jarvis", self.format_response(response)))
        except Exception as exc:
            self.queue.put(("system", f"Request failed: {exc}"))

    def show_endpoint(self, path, title):
        if self.busy:
            return
        self.busy = True
        self.status.set(f"Loading {title}...")
        threading.Thread(target=self.endpoint_worker, args=(path, title), daemon=True).start()

    def endpoint_worker(self, path, title):
        try:
            data = self.client.get(path)
            self.queue.put(("system", f"{title}\n{json.dumps(data, indent=2)}"))
        except Exception as exc:
            self.queue.put(("system", f"{title} failed: {exc}"))

    def load_health(self):
        threading.Thread(target=self.health_worker, daemon=True).start()

    def health_worker(self):
        try:
            data = self.client.get("/health")
            providers = data.get("providers", {})
            local_model = providers.get("ollama", {}).get("model")
            label = f"Connected - Jarvis local {local_model}" if local_model else "Connected"
            self.queue.put(("status", label))
        except Exception:
            self.queue.put(("status", "Offline"))

    def start_event_stream(self):
        threading.Thread(target=self.event_stream_worker, daemon=True).start()

    def event_stream_worker(self):
        try:
            for event_type, payload in self.client.stream_events():
                if event_type != "jarvis-event":
                    continue
                event = json.loads(payload)
                if event.get("type") in {
                    "user.message.received",
                    "tool.called",
                    "approval.requested",
                    "tool.completed",
                    "workflow.completed",
                    "workflow.failed",
                }:
                    self.queue.put(("event", f"{event.get('type')}\n{json.dumps(event.get('payload'), indent=2)}"))
        except Exception as exc:
            self.queue.put(("system", f"Live event stream stopped: {exc}"))

    def drain_queue(self):
        try:
            while True:
                role, text = self.queue.get_nowait()
                if role == "status":
                    self.connected_status = text
                    self.status.set(text)
                    continue
                self.add_message(role, text)
                if role != "event":
                    self.busy = False
                    self.send_button.configure(state=tk.NORMAL)
                    self.status.set(self.connected_status)
        except queue.Empty:
            pass
        self.root.after(100, self.drain_queue)

    def add_message(self, role, text):
        label = "You" if role == "user" else "Jarvis" if role == "jarvis" else "System"
        label_tag = f"{role}_label" if role in {"user", "jarvis", "system"} else "system_label"
        body_tag = f"{role}_body" if role in {"user", "jarvis", "system"} else "system_body"
        self.transcript.configure(state=tk.NORMAL)
        self.transcript.insert(tk.END, f"{label}\n", label_tag)
        self.transcript.insert(tk.END, f"{text.strip()}\n\n", body_tag)
        self.transcript.configure(state=tk.DISABLED)
        self.transcript.see(tk.END)

    def format_response(self, response):
        answer = clean_answer(response.get("answer") or "")
        if answer:
            return answer
        tool_results = response.get("toolResults") or []
        if tool_results:
            summaries = []
            for tool in tool_results:
                if tool.get("ok"):
                    summaries.append(tool.get("summary") or f"{tool.get('tool')} finished.")
                elif tool.get("pendingApproval"):
                    summaries.append("I need approval before I can continue that action.")
                else:
                    summaries.append(tool.get("error") or f"{tool.get('tool')} failed.")
            return "\n".join(summaries)
        return "I didn't get a usable answer back. Try asking me again."


def clean_answer(answer):
    text = str(answer or "").strip()
    text = re.sub(r"^\[(?:jarvis-local|ollama|openai-compatible|local-draft(?: fallback)?)\]\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^(Run|Workflow|Verification):.*$", "", text, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r"^\*\*(Answer|Result)\*\*\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()
    if len(text) >= 2 and text[0] == text[-1] == '"':
        text = text[1:-1].strip()
    return text


def main():
    base_url = os.environ.get("JARVIS_BACKEND_URL")
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    if not base_url:
        base_url = "http://localhost:8787"
    root = tk.Tk()
    JarvisChatApp(root, JarvisClient(base_url))
    root.mainloop()


if __name__ == "__main__":
    try:
        main()
    except urllib.error.URLError as exc:
        print(f"Could not connect to Jarvis backend: {exc}", file=sys.stderr)
        sys.exit(1)
