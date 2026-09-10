
import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Send,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { Lead } from '../services/leads.service';

interface WhatsAppTabProps {
  lead: Lead;
}

interface WhatsAppMessage {
  id: string | number;
  text: string;
  direction: 'Sent' | 'Received';
  status: string;
  createdAt: string;
  mediaUrl?: string;
  mediaType?: string;
}

export const WhatsAppTab = ({ lead }: WhatsAppTabProps) => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchHistory = async () => {
    try {
      setError('');

      const res = await apiClient.get(
        `/whatsapp/leads/${lead.id}/chat`
      );

      if (res.data?.success) {
        const allMessages: WhatsAppMessage[] = [];

        res.data.data?.forEach((msgSend: any) => {
          // Outgoing message
          const text =
            msgSend.subject === 'Outgoing WhatsApp Message'
              ? msgSend.events?.find(
                (event: any) => event.eventType === 'TEXT_SENT'
              )?.metadataJson?.text || 'Media Message'
              : msgSend.subject || '';

          allMessages.push({
            id: msgSend.id,
            text,
            direction: 'Sent',
            status: msgSend.status || '',
            createdAt: msgSend.createdAt,
          });

          // Incoming replies
          if (Array.isArray(msgSend.events)) {
            msgSend.events.forEach((event: any) => {
              if (event.eventType === 'REPLY') {
                allMessages.push({
                  id: event.id,
                  text:
                    event.metadataJson?.text ||
                    'Received a message',
                  direction: 'Received',
                  status: 'Received',
                  createdAt: event.eventTime,
                });
              }
            });
          }
        });

        // Sort messages by date/time
        allMessages.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        );

        setMessages(allMessages);
      } else {
        setMessages([]);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Failed to load WhatsApp history.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    const interval = setInterval(() => {
      fetchHistory();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [lead.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages]);

  const handleSend = async () => {
    const message = newMessage.trim();

    if ((!message && !selectedFile) || isSending) {
      return;
    }

    setIsSending(true);
    setError('');

    try {
      let mediaData = null;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadRes = await apiClient.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (uploadRes.data?.success) {
          mediaData = uploadRes.data.data;
        } else {
          throw new Error('Failed to upload file');
        }
      }

      const res = await apiClient.post(
        `/whatsapp/leads/${lead.id}/send`,
        {
          message,
          media: mediaData
        }
      );

      if (res.data?.success) {
        setNewMessage('');
        setSelectedFile(null);
        await fetchHistory();
      } else {
        setError(
          res.data?.error ||
          res.data?.message ||
          'Failed to send message.'
        );
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Failed to send message.'
      );
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex h-[500px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-[#e5ddd5]">
      {/* Error */}
      {error && (
        <div className="flex items-center border-b border-red-100 bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="mr-2 h-4 w-4 shrink-0" />

          <span className="flex-1">{error}</span>

          <button
            type="button"
            onClick={() => setError('')}
            className="ml-2 text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="mx-8 flex h-full items-center justify-center rounded-lg bg-white/50 p-4 text-center text-sm text-slate-500">
            No WhatsApp messages yet.
            <br />
            Send a message to start the conversation!
          </div>
        ) : (
          messages.map((msg) => {
            const isSent = msg.direction === 'Sent';

            return (
              <div
                key={msg.id}
                className={`flex ${isSent ? 'justify-end' : 'justify-start'
                  }`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${isSent
                    ? 'bg-[#dcf8c6]'
                    : 'bg-white'
                    }`}
                >
                  {/* Message */}
                  <p className="break-words whitespace-pre-wrap text-[14px] leading-relaxed text-slate-800">
                    {msg.text}
                  </p>

                  {/* Time + Status */}
                  <div className="mt-1 flex items-center justify-end space-x-1">
                    <span className="text-[10px] text-slate-500">
                      {new Date(
                        msg.createdAt
                      ).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    {isSent && (
                      <CheckCircle2
                        className={`h-3 w-3 ${msg.status === 'READ'
                          ? 'text-blue-500'
                          : 'text-slate-400'
                          }`}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="flex items-end space-x-2 border-t border-slate-200 bg-[#f0f0f0] p-3">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
          className="min-h-[44px] max-h-32 flex-1 resize-none rounded-lg border-none px-4 py-3 text-sm outline-none shadow-sm"
          rows={1}
          disabled={isSending}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={(!newMessage.trim() && !selectedFile) || isSending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white transition-colors hover:bg-[#008f6f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="ml-1 h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
};

