import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Persistent chat + document history for signed-in users.
// Guests never touch these — their history is intentionally ephemeral.
// Requires the chat_messages / document_history tables + RLS policies from
// supabase_schema.sql to be run once in the Supabase SQL editor.
// ─────────────────────────────────────────────────────────────────────────────

export const saveChatMessage = async (userId, { role, content, sources, isError }) => {
  const { error } = await supabase.from('chat_messages').insert({
    user_id: userId,
    role,
    content,
    sources: sources || [],
    is_error: !!isError,
  });
  if (error) console.error('[history] Failed to save chat message:', error);
};

export const loadChatHistory = async (userId) => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('role, content, sources, is_error, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[history] Failed to load chat history:', error);
    return [];
  }
  return (data || []).map((row) => ({
    role: row.role,
    content: row.content,
    sources: row.sources || [],
    isError: row.is_error,
  }));
};

export const saveDocumentToHistory = async (userId, filename) => {
  const { error } = await supabase.from('document_history').insert({
    user_id: userId,
    filename,
  });
  if (error) console.error('[history] Failed to save document history:', error);
};

export const loadDocumentHistory = async (userId) => {
  const { data, error } = await supabase
    .from('document_history')
    .select('filename, uploaded_at')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false });
  if (error) {
    console.error('[history] Failed to load document history:', error);
    return [];
  }
  return data || [];
};

export const removeDocumentFromHistory = async (userId, filename) => {
  const { error } = await supabase
    .from('document_history')
    .delete()
    .eq('user_id', userId)
    .eq('filename', filename);
  if (error) console.error('[history] Failed to remove document from history:', error);
};

export const clearChatHistory = async (userId) => {
  const { error } = await supabase.from('chat_messages').delete().eq('user_id', userId);
  if (error) console.error('[history] Failed to clear chat history:', error);
};
