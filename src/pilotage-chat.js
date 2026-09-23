(() => {
  'use strict';

  function client() {
    const c = window.PILOTAGE_SUPABASE_CLIENT;
    if (!c) throw new Error('Supabase Pilotage indisponible.');
    return c;
  }

  async function rpc(name, args = {}) {
    const { data, error } = await client().rpc(name, args);
    if (error) throw error;
    return data;
  }

  window.PILOTAGE_CHAT = Object.freeze({
    listRooms: async () => {
      const rows = await rpc('list_pilotage_chat_rooms');
      return Array.isArray(rows) ? rows : [];
    },

    listMessages: async (roomId, limit = 100) => {
      const rows = await rpc('list_pilotage_chat_messages', {
        p_room_id: roomId,
        p_limit: Math.max(1, Math.min(Number(limit || 100), 200))
      });
      return (Array.isArray(rows) ? rows : []).reverse();
    },

    sendMessage: (roomId, body) =>
      rpc('send_pilotage_chat_message', {
        p_room_id: roomId,
        p_body: String(body || '')
      }),

    markRead: roomId =>
      rpc('mark_pilotage_chat_read', { p_room_id: roomId }),

    createRoom: (name, projectClientKey = null) =>
      rpc('create_pilotage_chat_room', {
        p_name: String(name || ''),
        p_project_client_key: projectClientKey || null
      }),

    subscribe: onEvent => {
      const member = window.PILOTAGE_AUTH?.member;
      if (!member?.id) throw new Error('Membre Pilotage introuvable.');
      const channel = client()
        .channel(`pilotage-chat-live-${member.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'pilotage_chat_messages'
        }, payload => {
          if (typeof onEvent === 'function') onEvent(payload);
        })
        .subscribe();
      return channel;
    },

    unsubscribe: channel => {
      if (!channel) return Promise.resolve();
      return client().removeChannel(channel);
    }
  });
})();