// src/components/tod/ui/PlayersSidebar.tsx

interface Participant {
  user_id: string;
  has_gone_this_round: boolean;
  profiles?: { username: string };
}

interface Message {
  id: string;
  content: string;
  message_type: 'chat' | 'truth' | 'dare' | 'system';
}

// 1. ADD 'className' AND 'onClose' TO THIS INTERFACE
interface PlayersSidebarProps {
  participants: Participant[];
  messages: Message[];
  currentTargetId?: string;
  hostId: string;
  onClose?: () => void; // Added to support the mobile close button
  className?: string;   // <--- THIS IS WHAT THE ERROR IS ASKING FOR
}

// 2. ENSURE DESTRUCTURING MATCHES THE INTERFACE
export const PlayersSidebar = ({
  participants,
  messages,
  currentTargetId,
  hostId,
  onClose,
  className = '' // Default to empty string
}: PlayersSidebarProps) => {
  
  const gameEvents = messages
    .filter(m => m.message_type === 'system' || m.message_type === 'truth' || m.message_type === 'dare')
    .slice(-10);

  return (
    <aside className={`w-64 flex-shrink-0 p-4 overflow-y-auto ${className}`}>
      {/* ... rest of your code ... */}
    </aside>
  );
};
