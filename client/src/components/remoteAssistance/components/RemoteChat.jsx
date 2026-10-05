import { MessageCircle, SendHorizontal } from "lucide-react";
import { formatChatTime } from "../utils/format.js";

function ChatBubble({ message }) {
  return (
    <p className={`chat-bubble chat-${message.sender}`}>
      <span className="chat-bubble-meta">
        {message.sender === "technician" ? "Você" : (message.senderName || "Usuário local")}
        {" - "}
        {formatChatTime(message.createdAt)}
      </span>
      {message.text}
    </p>
  );
}

function ChatForm({ chat, active }) {
  return (
    <form className="remote-assistance-chat-form" onSubmit={chat.send}>
      <input
        type="text"
        value={chat.draft}
        onChange={(event) => chat.setDraft(event.target.value)}
        placeholder="Escreva uma mensagem..."
        maxLength={2000}
        disabled={!active || chat.sending}
        aria-label="Mensagem de chat"
      />
      <button
        type="submit"
        className="icon-button"
        disabled={!active || chat.sending || !chat.draft.trim()}
        title="Enviar mensagem"
      >
        <SendHorizontal size={16} />
      </button>
    </form>
  );
}

export default function RemoteChat({ chat, canChat, session }) {
  return (
    <section className="remote-assistance-chat" aria-label="Chat com o usuário local">
      <h3><MessageCircle size={16} /> Chat com o usuário local</h3>
      <div className="remote-assistance-chat-log" ref={chat.logRef}>
        {chat.messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
        {!chat.messages.length && <p className="remote-assistance-chat-empty">Nenhuma mensagem ainda.</p>}
      </div>
      {canChat ? (
        <ChatForm chat={chat} active={session.status === "active"} />
      ) : (
        <p className="remote-assistance-chat-empty">Você não tem permissão para enviar mensagens.</p>
      )}
    </section>
  );
}
