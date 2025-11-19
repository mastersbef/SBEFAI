import React from 'react';

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex space-x-1 p-2 bg-gray-800/50 rounded-2xl w-16 items-center justify-center">
      <div className="w-2 h-2 bg-cyan-400 rounded-full typing-dot"></div>
      <div className="w-2 h-2 bg-cyan-400 rounded-full typing-dot"></div>
      <div className="w-2 h-2 bg-cyan-400 rounded-full typing-dot"></div>
    </div>
  );
};

export default TypingIndicator;