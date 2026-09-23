(() => {
  'use strict';

  function client() {
    const c = window.PILOTAGE_SUPABASE_CLIENT;
    if (!c) throw new Error('Session Supabase indisponible.');
    return c;
  }

  async function rpc(name, args = {}) {
    const { data, error } = await client().rpc(name, args);
    if (error) throw new Error(error.message || 'Erreur du module Idées.');
    return data;
  }

  function normalizedIdeaPayload(input = {}) {
    return {
      p_title: String(input.title || '').trim(),
      p_description: String(input.description || ''),
      p_association_type: input.association_type || 'none',
      p_project_client_key: input.project_client_key || null,
      p_task_client_key: input.task_client_key || null,
      p_module: String(input.module || '').trim() || null,
      p_origin: input.origin || 'internal',
      p_impact_level: input.impact_level || null,
      p_effort_level: input.effort_level || null
    };
  }

  async function list() {
    const rows = await rpc('list_pilotage_ideas');
    return Array.isArray(rows) ? rows : [];
  }

  async function detail(ideaId) {
    return rpc('get_pilotage_idea_detail', { p_idea_id: ideaId });
  }

  async function create(input) {
    return rpc('create_pilotage_idea', normalizedIdeaPayload(input));
  }

  async function update(ideaId, input) {
    return rpc('update_pilotage_idea', {
      p_idea_id: ideaId,
      ...normalizedIdeaPayload(input)
    });
  }

  async function toggleVote(ideaId) {
    return rpc('toggle_pilotage_idea_vote', { p_idea_id: ideaId });
  }

  async function addComment(ideaId, body) {
    return rpc('add_pilotage_idea_comment', {
      p_idea_id: ideaId,
      p_body: String(body || '').trim()
    });
  }

  async function deleteComment(commentId) {
    return rpc('delete_pilotage_idea_comment', { p_comment_id: commentId });
  }

  async function addResource(ideaId, resource = {}) {
    return rpc('add_pilotage_idea_resource', {
      p_idea_id: ideaId,
      p_resource_type: resource.resource_type || 'link',
      p_label: String(resource.label || '').trim(),
      p_url: String(resource.url || '').trim() || null,
      p_reference: String(resource.reference || '').trim() || null
    });
  }

  async function deleteResource(resourceId) {
    return rpc('delete_pilotage_idea_resource', { p_resource_id: resourceId });
  }

  async function setStatus(ideaId, status) {
    return rpc('set_pilotage_idea_status', {
      p_idea_id: ideaId,
      p_status: status
    });
  }

  async function convertToTask(ideaId, payload = {}) {
    return rpc('convert_pilotage_idea_to_task', {
      p_idea_id: ideaId,
      p_project_client_key: payload.project_client_key || null,
      p_assignee_client_key: payload.assignee_client_key || null,
      p_priority: payload.priority || 'medium',
      p_planning_bucket: payload.planning_bucket || null,
      p_scheduled_for: payload.scheduled_for || null,
      p_due_at: payload.due_at || null
    });
  }

  function subscribe(onEvent) {
    const c = client();
    const name = 'pilotage-ideas-' + (window.PILOTAGE_AUTH?.member?.id || 'member');
    const channel = c.channel(name);

    ['ideas','idea_votes','idea_comments','idea_resources'].forEach(table => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        payload => {
          try { onEvent?.({ table, ...payload }); }
          catch (error) { console.warn('Ideas realtime callback', error); }
        }
      );
    });

    channel.subscribe();
    return channel;
  }

  function unsubscribe(channel) {
    if (!channel) return;
    try { client().removeChannel(channel); } catch {}
  }

  window.PILOTAGE_IDEAS = Object.freeze({
    list,
    detail,
    create,
    update,
    toggleVote,
    addComment,
    deleteComment,
    addResource,
    deleteResource,
    setStatus,
    convertToTask,
    subscribe,
    unsubscribe
  });
})();
