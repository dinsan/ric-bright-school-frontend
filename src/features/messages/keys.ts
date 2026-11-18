/** Query keys for messaging. Everything starts with ["messages"], so one invalidation refreshes it all. */
export const messageKeys = {
  all: ["messages"] as const,
  conversations: () => [...messageKeys.all, "conversations"] as const,
  conversation: (id: string) => [...messageKeys.all, "conversation", id] as const,
  contacts: () => [...messageKeys.all, "contacts"] as const,
  announcements: () => [...messageKeys.all, "announcements"] as const,
  unread: () => [...messageKeys.all, "unread"] as const,
};
