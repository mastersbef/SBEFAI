import React, { useState, useEffect } from 'react';
import { Message, Sender, VoiceSettings } from '../types';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
  language: string; // 'az', 'tr', etc.
  voiceSettings: VoiceSettings;
  isLatest: boolean;
  onPreview?: (code: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, language, voiceSettings, isLatest, onPreview }) => {
  const isUser = message.sender === Sender.USER;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [htmlCode, setHtmlCode] = useState<string | null>(null);

  // Extract HTML code for preview detection
  useEffect(() => {
    if (!isUser && message.text.includes('```html')) {
      const match = message.text.match(/```html([\s\S]*?)```/);
      if (match && match[1]) {
        setHtmlCode(match[1].trim());
      }
    } else if (!isUser && message.text.includes('<!DOCTYPE html>')) {
       // Fallback if not in code block but is raw html
       setHtmlCode(message.text);
    }
  }, [message.text, isUser]);

  // Auto Read Logic
  useEffect(() => {
    if (!isUser && isLatest && voiceSettings.autoRead) {
      // Small delay to ensure UI is ready and not overlapping with sound effects
      const timer = setTimeout(() => {
        speakMessage();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLatest, voiceSettings.autoRead]); // Removed isUser dependency from array but checked inside, safer

  const speakMessage = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }

      // Clean text from code blocks for speaking
      const textToSpeak = message.text.replace(/```[\s\S]*?```/g, " Code block detected. ");

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      utterance.rate = voiceSettings.rate;
      utterance.pitch = voiceSettings.pitch;

      const langMap: Record<string, string> = {
        az: 'az-AZ',
        tr: 'tr-TR',
        en: 'en-US',
        ru: 'ru-RU'
      };
      utterance.lang = langMap[language] || 'en-US';

      const voices = window.speechSynthesis.getVoices();
      
      if (voiceSettings.voiceURI) {
        const specificVoice = voices.find(v => v.voiceURI === voiceSettings.voiceURI);
        if (specificVoice) utterance.voice = specificVoice;
      } else {
        let selectedVoice = voices.find(voice => 
          voice.lang.includes(language) && voice.name.includes("Google")
        );
        if (!selectedVoice) {
          selectedVoice = voices.find(voice => voice.lang.toLowerCase().includes(language));
        }
        if (!selectedVoice && language === 'az') {
          selectedVoice = voices.find(voice => voice.lang.includes('tr'));
        }
        if (selectedVoice) utterance.voice = selectedVoice;
      }
      
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      setIsSpeaking(true);
      window.speechSynthesis.cancel(); 
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up group`}>
      <div className={`flex max-w-[95%] md:max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>
        
        <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-bold shadow-[0_0_15px_rgba(0,0,0,0.3)] border border-white/10
          ${isUser 
            ? 'bg-gradient-to-br from-purple-600 to-fuchsia-700 text-white' 
            : 'bg-[#0f172a] text-cyan-400 border-cyan-500/30 shadow-cyan-500/20'
          }`}>
          {isUser ? 'SİZ' : 'V2'}
        </div>

        <div className="flex flex-col gap-1 w-full">
          
          <div
            className={`relative p-4 md:p-5 rounded-2xl shadow-2xl
              ${isUser 
                ? 'bg-gradient-to-br from-indigo-900/90 to-purple-900/90 text-white rounded-br-sm border border-purple-500/30' 
                : 'bg-[#111827]/95 text-gray-100 rounded-bl-sm border border-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.05)]'
              }
              backdrop-blur-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,0,0,0.4)]
            `}
          >
            {!isUser && (
              <div className="text-[10px] font-bold text-cyan-400 mb-2 tracking-[0.15em] uppercase flex items-center gap-2 font-cyber opacity-80">
                <span>SbefBOT<span className="text-white">V2</span></span>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-cyan-500/50 to-transparent"></div>
              </div>
            )}

            {message.attachment && (
              <div className="mb-4 rounded-xl overflow-hidden border border-white/10 shadow-lg group-hover:border-cyan-500/30 transition-colors">
                <img 
                  src={`data:image/jpeg;base64,${message.attachment}`} 
                  alt="Content" 
                  className="max-w-full h-auto max-h-[350px] object-cover w-full"
                />
              </div>
            )}

            <div className="text-sm md:text-[15px] leading-7 font-light prose prose-invert max-w-none prose-p:my-2 prose-strong:text-cyan-200 prose-a:text-cyan-400 prose-code:text-cyan-300">
              <ReactMarkdown>
                {message.text}
              </ReactMarkdown>
            </div>

            {/* Project Preview Button */}
            {htmlCode && onPreview && (
              <button 
                onClick={() => onPreview(htmlCode)}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] animate-pulse"
              >
                <span>🚀</span>
                <span>LIVE PREVIEW (WEB TEST)</span>
              </button>
            )}

            <div className={`text-[9px] mt-3 opacity-50 font-mono tracking-wider ${isUser ? 'text-right text-purple-200' : 'text-left text-gray-500'}`}>
              {message.timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {!isUser && (
            <div className="flex gap-2 ml-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
               <button 
                 onClick={speakMessage} 
                 className={`p-2 rounded-lg transition-all border border-transparent ${isSpeaking ? 'text-cyan-400 bg-cyan-950/50 border-cyan-900' : 'text-gray-500 hover:text-cyan-400 hover:bg-[#1e293b]'}`}
                 title={voiceSettings.autoRead ? "Oxuyur (Auto)" : "Səsli oxu"}
               >
                 {isSpeaking ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 animate-pulse">
                      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 2.485.963 4.682 2.525 6.305.348.37.546.9.546 1.445v.25c0 1.104.896 2 2 2H6.75c1.104 0 2-.896 2-2V19.5c0-.546.198-1.076.546-1.445A9.06 9.06 0 0112 12c0-2.4-.866-4.61-2.3-6.31.943.944 2.56.275 2.56-1.06v-.57zM13.5 12a5.5 5.5 0 005.5-5.5c0-.825-.176-1.607-.488-2.324A.75.75 0 0017.5 4.5a.75.75 0 00-1.499.054 4 4 0 01.999 2.946 4 4 0 01-4 4 .75.75 0 100 1.5z" />
                      <path d="M13.5 12a5.5 5.5 0 005.5 5.5.75.75 0 100-1.5 4 4 0 01-4-4 .75.75 0 100 1.5z" />
                    </svg>
                 ) : (
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                     <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 2.485.963 4.682 2.525 6.305.348.37.546.9.546 1.445v.25c0 1.104.896 2 2 2H6.75c1.104 0 2-.896 2-2V19.5c0-.546.198-1.076.546-1.445A9.06 9.06 0 0112 12c0-2.4-.866-4.61-2.3-6.31.943.944 2.56.275 2.56-1.06v-.57zM13.5 12a5.5 5.5 0 005.5-5.5c0-.825-.176-1.607-.488-2.324A.75.75 0 0017.5 4.5a.75.75 0 00-1.499.054 4 4 0 01.999 2.946 4 4 0 01-4 4 .75.75 0 100 1.5z" />
                   </svg>
                 )}
               </button>
               <button 
                 onClick={handleCopy} 
                 className={`p-2 rounded-lg transition-all border border-transparent ${copied ? 'text-green-400 bg-green-900/20' : 'text-gray-500 hover:text-white hover:bg-[#1e293b]'}`}
                 title="Mətni kopyala"
               >
                 {copied ? (
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                     <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                   </svg>
                 ) : (
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                     <path fillRule="evenodd" d="M17.663 3.118c.225.015.45.032.673.05C19.876 3.298 21 4.604 21 6.109v9.642c0 1.176-.772 2.2-1.87 2.45-.034.007-.07.01-.106.011a.75.75 0 01-.07-1.498 10.099 10.099 0 00.183-.033c.494-.112.863-.572.863-1.093V6.109c0-.838-.628-1.566-1.488-1.636a18.732 18.732 0 00-.763-.044.75.75 0 01-.08-1.498z" clipRule="evenodd" />
                     <path fillRule="evenodd" d="M15 5.25a2.25 2.25 0 012.25 2.25v11.25a2.25 2.25 0 01-2.25 2.25H9a2.25 2.25 0 01-2.25-2.25V7.5A2.25 2.25 0 019 5.25h6zm-3 2.25a.75.75 0 00-1.5 0v1.5a.75.75 0 001.5 0v-1.5zM9.75 11.25a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z" clipRule="evenodd" />
                   </svg>
                 )}
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;