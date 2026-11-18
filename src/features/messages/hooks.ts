"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { messagesApi } from "./api";
import type { AnnouncementCreate, ConversationView, Message } from "./contract";
import { messageKeys } from "./keys";
import { POLL_MS, useLive } from "./live";

export { messageKeys };

/** Polls only while the live stream is down. */
function usePolling() {
  return useLive() ? false : POLL_MS;
}

export function useConversations() {
  return useQuery({ queryKey: messageKeys.conversations(), queryFn: ({ signal }) => messagesApi.conversations(signal), refetchInterval: usePolling() });
}

/** The latest messages of a conversation (older pages are loaded by the view itself). */
export function useConversation(id: string) {
  return useQuery({ queryKey: messageKeys.conversation(id), queryFn: ({ signal }) => messagesApi.conversation(id, undefined, signal), refetchInterval: usePolling() });
}

export function useContacts(enabled = true) {
  return useQuery({ queryKey: messageKeys.contacts(), queryFn: ({ signal }) => messagesApi.contacts(signal), enabled });
}

export function useAnnouncements() {
  return useQuery({ queryKey: messageKeys.announcements(), queryFn: ({ signal }) => messagesApi.announcements(signal), refetchInterval: usePolling() });
}

/** The menu badge. Refused (an unverified teacher) simply shows none. */
export function useUnreadCounts(enabled: boolean) {
  return useQuery({ queryKey: messageKeys.unread(), queryFn: ({ signal }) => messagesApi.unread(signal), enabled, retry: false, refetchInterval: usePolling() });
}

/** Adds a sent message to the conversation at once (the live event then refreshes it). */
function useAppendMessage(id: string) {
  const queryClient = useQueryClient();
  return (message: Message) => {
    queryClient.setQueryData<ConversationView>(messageKeys.conversation(id), (data) =>
      data && !data.messages.some((entry) => entry.id === message.id) ? { ...data, messages: [...data.messages, message] } : data,
    );
    void queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
  };
}

/** Sends a message. Not optimistic on purpose: the text stays in the box until the server has it. */
export function useSendMessage(id: string) {
  const append = useAppendMessage(id);
  return useMutation({ mutationFn: (body: string) => messagesApi.send(id, body), onSuccess: append });
}

export function useShareProgress(id: string) {
  const append = useAppendMessage(id);
  return useMutation({ mutationFn: (note?: string) => messagesApi.shareProgress(id, note), onSuccess: append });
}

export function useMarkRead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => messagesApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messageKeys.unread() });
      void queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
    },
  });
}

export function useOpenConversation() {
  return useMutation({ mutationFn: messagesApi.open });
}

export function usePostAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AnnouncementCreate) => messagesApi.postAnnouncement(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messageKeys.announcements() }),
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: messagesApi.deleteAnnouncement, onSettled: () => queryClient.invalidateQueries({ queryKey: messageKeys.announcements() }) });
}

export function useMarkAnnouncementRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: messagesApi.markAnnouncementRead,
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: messageKeys.announcements() }), queryClient.invalidateQueries({ queryKey: messageKeys.unread() })]),
  });
}
