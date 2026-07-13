import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, User, Mic, MicOff } from 'lucide-react';
import { chatService } from '../services/chat.service';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
}

// Ensure TypeScript knows about the Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Hello! I am your AI assistant. Ask me anything about your leads or campaigns.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            setInput((prev) => prev + event.results[i][0].transcript + ' ');
          } else {
            currentTranscript += event.results[i][0].transcript;
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (e) {
          console.error("Speech recognition failed to start", e);
        }
      } else {
        alert("Your browser does not support speech recognition.");
      }
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const responseText = await chatService.sendMessage(userMsg.text);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: responseText,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'Sorry, I am having trouble connecting to the server right now.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  // Convert markdown-like response to simple HTML
  const formatText = (text: string) => {
    // Basic bold formatting
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Basic line breaks
    formatted = formatted.replace(/\n/g, '<br />');
    return { __html: formatted };
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-96 max-h-[500px] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 ease-in-out transform origin-bottom-right">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center border-b border-indigo-500/30">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md p-1.5 border-2 border-white/20">
                <img src="/mascot.png" alt="Mascot" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-bold text-lg text-white leading-tight">AI Assistant</h3>
                <span className="text-xs text-blue-100 font-medium flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></span>
                  Online
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto min-h-[300px] max-h-[400px] bg-gray-50/50 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2`}>
                  {msg.sender === 'user' ? (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 ml-2">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center mr-1">
                      <img src="/mascot.png" alt="Mascot" className="w-full h-full object-contain drop-shadow-sm" />
                    </div>
                  )}
                  <div
                    className={`p-3 rounded-2xl text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none shadow-sm'
                    }`}
                    dangerouslySetInnerHTML={msg.sender === 'ai' ? formatText(msg.text) : undefined}
                  >
                    {msg.sender === 'user' ? msg.text : undefined}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-end space-x-2 max-w-[80%]">
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center mr-1">
                    <img src="/mascot.png" alt="Mascot" className="w-full h-full object-contain drop-shadow-sm" />
                  </div>
                  <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-bl-none shadow-sm flex space-x-2 items-center">
                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                    <span className="text-xs text-gray-400 font-medium tracking-wide uppercase">Searching Database...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-100">
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Listening..." : "Ask about leads, scores, campaigns..."}
                className={`w-full bg-gray-50 border ${isListening ? 'border-red-400 ring-2 ring-red-200' : 'border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'} text-gray-800 text-sm rounded-full block pl-4 pr-20 py-3 transition-all`}
                disabled={isTyping}
              />
              <div className="absolute right-2 flex items-center space-x-1">
                <button
                  onClick={toggleListen}
                  disabled={isTyping || !recognitionRef.current}
                  className={`p-2 rounded-full transition-colors ${
                    isListening 
                      ? 'text-red-500 bg-red-100 animate-pulse' 
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  } disabled:opacity-50`}
                  title={isListening ? "Stop listening" : "Start speaking"}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="p-2 text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-full shadow-2xl hover:shadow-3xl transition-all transform hover:-translate-y-2 group w-20 h-20 flex items-center justify-center bg-transparent border-none outline-none"
        >
          <img src="/mascot.png" alt="Chat" className="w-full h-full object-contain drop-shadow-xl group-hover:scale-110 transition-transform" />
        </button>
      )}
    </div>
  );
};
