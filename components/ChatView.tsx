import React, { useState, useEffect, useRef } from 'react';
import { Note, ChatMessage, MessageSender } from '../types';
import { createChatSession, sendMessageToChat } from '../services/openaiService';
import { Send, ArrowLeft, Loader } from 'lucide-react';

interface ChatViewProps {
  note: Note | null;
  onBack: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({ note, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isTranscribing = note?.transcript.startsWith('[Transcribing');

  useEffect(() => {
    if (note) {
      if (note.transcript && !isTranscribing) {
        chatSessionRef.current = createChatSession(note.transcript);
      }

      let initialMessage: ChatMessage;
      if (isTranscribing) {
        initialMessage = {
          sender: MessageSender.AI,
          text: "Please wait for the file to finish transcribing before asking questions."
        };
      } else {
        initialMessage = {
          sender: MessageSender.AI,
          text: `I'm ready to answer questions about "${note.title}". What would you like to know?`,
        };
      }
      setMessages([initialMessage]);
    }
  }, [note, isTranscribing]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading || !note || isTranscribing) return;

    const userMessage: ChatMessage = { sender: MessageSender.User, text: userInput };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = userInput;
    setUserInput('');
    setIsLoading(true);

    if (!chatSessionRef.current) {
      chatSessionRef.current = createChatSession(note.transcript);
    }

    const responseText = await sendMessageToChat(chatSessionRef.current, currentInput);
    const aiMessage: ChatMessage = { sender: MessageSender.AI, text: responseText };
    setMessages(prev => [...prev, aiMessage]);
    setIsLoading(false);
  };

  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-light-text-secondary dark:dark-text-secondary">
        <ArrowLeft size={48} className="mb-4" />
        <h2 className="text-xl font-semibold">No note selected</h2>
        <p>Go back to select a note to chat with.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 py-2">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" aria-label="Go back to note">
          <ArrowLeft size={24} className="text-light-text dark:text-dark-text" />
        </button>
        <h2 className="text-lg font-semibold text-light-text dark:text-dark-text truncate">
          Chat with: {note.title}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.sender === MessageSender.User ? 'justify-end' : 'justify-start'}`}>
            {msg.sender === MessageSender.AI && <div className="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center text-white text-sm font-bold flex-shrink-0">AI</div>}
            <div className={`max-w-sm md:max-w-lg px-4 py-3 rounded-2xl ${msg.sender === MessageSender.User ? 'bg-brand-blue text-white' : 'bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text'}`}>
              <p className="whitespace-pre-wrap text-[15px] text-[15px] leading-7">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center text-white text-xs font-bold flex-shrink-0">AI</div>
            <div className="max-w-xs md:max-w-md p-3 rounded-2xl bg-light-card dark:bg-dark-card">
              <Loader size={20} className="animate-spin text-light-text-secondary dark:dark-text-secondary" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="mt-auto p-2">
        <div className="flex items-center w-full bg-light-card dark:bg-[#191920] rounded-full border border-gray-300 dark:border-gray-700 focus-within:border-brand-blue transition-colors">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={isTranscribing ? "Transcription in progress..." : "Ask a question..."}
            className="flex-1 bg-transparent py-4 px-5 text-light-text dark:text-dark-text placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none"
            disabled={isLoading || isTranscribing}
          />
          <button
            type="submit"
            className={`mr-2 w-10 h-10 flex flex-shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed ${userInput.trim() && !isLoading && !isTranscribing
                ? 'bg-brand-blue text-white'
                : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
              }`}
            disabled={isLoading || !userInput.trim() || isTranscribing}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatView;