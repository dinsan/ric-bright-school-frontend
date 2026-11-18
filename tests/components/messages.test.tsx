import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppNav } from "@/components/layout/app-nav";
import { visibleNavItems } from "@/config/navigation";
import type { Announcement, Contacts, ConversationSummary, ConversationView as View, Message } from "@/features/messages/contract";
import { ParentAnnouncements, TeacherAnnouncements } from "@/features/messages/components/announcements";
import { ConversationView } from "@/features/messages/components/conversation";
import { Inbox } from "@/features/messages/components/inbox";
import { dayHeading, formatWhen } from "@/features/messages/format";
import { LiveUpdatesProvider, useLive } from "@/features/messages/live";
import { useConversation } from "@/features/messages/hooks";
import { resetNavigation, router } from "../support/next-navigation";
import { apiErrorResponse, mockApi, renderWithProviders } from "../support/render";

vi.mock("next/navigation", () => import("../support/next-navigation"));
beforeEach(() => resetNavigation());

const NOW = new Date();
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

const summary = (overrides: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id: "k1",
  child: { id: "c1", name: "Leo", grade_level: 5 },
  teacher: { id: "t1", name: "Tom Teacher" },
  classes: ["Class 5L"],
  last_message: { preview: "He's doing well!", at: minutesAgo(5), sender_name: "Tom Teacher", mine: false },
  unread: 2,
  ...overrides,
});

const message = (overrides: Partial<Message> = {}): Message => ({
  id: "m1",
  conversation_id: "k1",
  kind: "text",
  body: "Hello Mr Tom!",
  snapshot: null,
  sender: { id: "p1", name: "Pat Park", role_label: "Leo's parent" },
  mine: true,
  created_at: minutesAgo(30),
  ...overrides,
});

const view = (overrides: Partial<View> = {}): View => ({
  ...summary({ unread: 0 }),
  participants: [
    { id: "t1", name: "Tom Teacher", role_label: "Teacher" },
    { id: "p1", name: "Pat Park", role_label: "Leo's parent" },
  ],
  messages: [
    message(),
    message({
      id: "m2",
      kind: "progress",
      body: "Here's where Leo is.",
      mine: false,
      sender: { id: "t1", name: "Tom Teacher", role_label: "Teacher" },
      snapshot: { title: "Work in Class 5L", as_of: minutesAgo(10), items: [{ label: "Halves homework", value: "Not started · Overdue by 2 days", tone: "attention" }] },
      created_at: minutesAgo(10),
    }),
  ],
  has_more: false,
  context: { work: [{ title: "Halves homework", due_at: minutesAgo(2 * 24 * 60), status: "not_started", lessons_done: 0, lessons_total: 1 }] },
  can_send: true,
  ...overrides,
});

describe("inbox", () => {
  it("lists conversations with what's unread, and opens a new one for a parent", async () => {
    const opens: unknown[] = [];
    const contacts: Contacts = { classes: [], children: [{ id: "c1", name: "Leo", teachers: [{ id: "t1", name: "Tom Teacher", classes: ["Class 5L"] }] }, { id: "c2", name: "Maya", teachers: [] }] };
    mockApi({
      "GET /api/me/conversations": () => Response.json([summary(), summary({ id: "k2", child: { id: "c2", name: "Maya", grade_level: 2 }, unread: 0, last_message: null })]),
      "GET /api/me/contacts": () => Response.json(contacts),
      "POST /api/me/conversations": ({ body }) => {
        opens.push(body);
        return Response.json({ id: "k9" }, { status: 201 });
      },
    });
    const { user } = renderWithProviders(<Inbox role="parent" basePath="/family/messages" />);
    const first = await screen.findByRole("link", { name: /Tom Teacher, about Leo/ });
    expect(first).toHaveAttribute("href", "/family/messages/k1");
    expect(first).toHaveTextContent("Tom Teacher: He's doing well!");
    expect(within(first).getByText("2")).toBeInTheDocument();
    expect(first).toHaveAccessibleName(/2 unread$/);
    expect(screen.getByRole("link", { name: /Tom Teacher, about Maya/ })).toHaveTextContent("No messages yet");

    await user.click(screen.getByRole("button", { name: "New message" }));
    const dialog = await screen.findByRole("dialog", { name: "New message" });
    expect(within(dialog).getByRole("button", { name: "Open conversation" })).toBeDisabled();
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Child" }), "Maya");
    expect(within(dialog).getByText("No teacher on Lumina teaches this child yet.")).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Child" }), "Leo");
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Teacher" }), "Tom Teacher (Class 5L)");
    await user.click(within(dialog).getByRole("button", { name: "Open conversation" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/family/messages/k9"));
    expect(opens).toEqual([{ child_id: "c1", teacher_id: "t1" }]);
  });

  it("lets a teacher pick a pupil, but not one without a parent on Lumina", async () => {
    mockApi({
      "GET /api/me/conversations": () => Response.json([]),
      "GET /api/me/contacts": () =>
        Response.json({ children: [], classes: [{ id: "x5", name: "Class 5L", students: [{ id: "c1", name: "Leo", parents: 2 }, { id: "c3", name: "Mia", parents: 0 }] }] } satisfies Contacts),
    });
    const { user } = renderWithProviders(<Inbox role="teacher" basePath="/teach/messages" />);
    expect(await screen.findByText("No messages yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New message" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(await within(dialog).findByRole("combobox", { name: "Class" }), "Class 5L");
    expect(within(dialog).getByRole("option", { name: "Mia (no parent on Lumina yet)" })).toBeDisabled();
    expect(within(dialog).getByRole("option", { name: "Leo" })).toBeEnabled();
  });

  it("says when the messages didn't load", async () => {
    mockApi({ "GET /api/me/conversations": () => apiErrorResponse(403, "forbidden", "Your teacher account isn't verified yet.") });
    renderWithProviders(<Inbox role="teacher" basePath="/teach/messages" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Your teacher account isn't verified yet.");
  });
});

describe("a conversation", () => {
  it("shows the messages, progress updates and the child's work, and marks it read", async () => {
    const reads: string[] = [];
    mockApi({
      "GET /api/me/conversations/k1": () => Response.json(view({ unread: 1 })),
      "POST /api/me/conversations/k1/read": () => {
        reads.push("read");
        return new Response(null, { status: 204 });
      },
    });
    renderWithProviders(<ConversationView id="k1" role="parent" backHref="/family/messages" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Tom Teacher, about Leo" })).toBeInTheDocument();
    expect(screen.getByText(/With Tom Teacher \(Teacher\), Pat Park \(Leo's parent\)/)).toBeInTheDocument();
    const log = screen.getByRole("log", { name: "Messages" });
    // Regression: the log keeps its list (role="log" on the <ol> itself dropped it; axe "listitem").
    const thread = within(log).getAllByRole("list")[0]!;
    expect(thread.tagName).toBe("OL");
    expect(thread.querySelectorAll(":scope > li")).toHaveLength(2);
    expect(within(log).getByText("Today")).toBeInTheDocument();
    expect(within(log).getByRole("article", { name: /^You,/ })).toHaveTextContent("Hello Mr Tom!");
    const update = within(log).getByRole("article", { name: /^Tom Teacher,/ });
    expect(update).toHaveTextContent("Progress update: Work in Class 5L");
    expect(update).toHaveTextContent("Halves homework");
    expect(update).toHaveTextContent("Not started · Overdue by 2 days");
    expect(update).toHaveTextContent("Here's where Leo is.");
    const panel = screen.getByRole("complementary", { name: "Leo's work with Tom Teacher" });
    expect(within(panel).getByText("Not started")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "See all of Leo's progress" })).toHaveAttribute("href", "/family/children/c1");
    await waitFor(() => expect(reads).toEqual(["read"]));
    expect(screen.getByText("Checking for new messages every 20 seconds")).toBeInTheDocument();
  });

  it("sends a message, and keeps the text when sending fails", async () => {
    let fail = true;
    const sent: unknown[] = [];
    mockApi({
      "GET /api/me/conversations/k1": () => Response.json(view({ messages: [] })),
      "GET /api/me/conversations": () => Response.json([]),
      "POST /api/me/conversations/k1/messages": ({ body }) => {
        sent.push(body);
        return fail ? apiErrorResponse(429, "too_many_requests", "That's a lot of messages in a short time.") : Response.json(message({ id: "m9", body: (body as { body: string }).body, created_at: new Date().toISOString() }), { status: 201 });
      },
    });
    const { user } = renderWithProviders(<ConversationView id="k1" role="parent" backHref="/family/messages" />);
    expect(await screen.findByText(/No messages yet. Say hello, or ask how Leo is doing./)).toBeInTheDocument();
    const box = screen.getByRole("textbox", { name: "Write a message" });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.type(box, "How was the trip?");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Your message wasn't sent")).toBeInTheDocument();
    expect(box).toHaveValue("How was the trip?");

    fail = false;
    await user.click(box);
    await user.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => expect(box).toHaveValue(""));
    expect(within(screen.getByRole("log")).getByText("How was the trip?")).toBeInTheDocument();
    expect(sent).toEqual([{ body: "How was the trip?" }, { body: "How was the trip?" }]);
  });

  it("shares a progress update with a note, after saying what it contains", async () => {
    const shares: unknown[] = [];
    mockApi({
      "GET /api/me/conversations/k1": () => Response.json(view({ messages: [] })),
      "GET /api/me/conversations": () => Response.json([]),
      "POST /api/me/conversations/k1/progress": ({ body }) => {
        shares.push(body);
        return Response.json(message({ id: "m5", kind: "progress", body: "Busy week!", snapshot: { title: "Learning at home", as_of: new Date().toISOString(), items: [{ label: "Streak", value: "3 days", tone: "neutral" }] } }), { status: 201 });
      },
    });
    const { user } = renderWithProviders(<ConversationView id="k1" role="parent" backHref="/family/messages" />);
    await user.click(await screen.findByRole("button", { name: "Share a progress update" }));
    const dialog = await screen.findByRole("dialog", { name: "Share a progress update" });
    expect(dialog).toHaveTextContent("Leo's learning at home in the last 7 days");
    await user.type(within(dialog).getByRole("textbox", { name: /Add a note/ }), "Busy week!");
    await user.click(within(dialog).getByRole("button", { name: "Share update" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(shares).toEqual([{ note: "Busy week!" }]);
    expect(within(screen.getByRole("log")).getByText("Progress update: Learning at home")).toBeInTheDocument();
  });

  it("is read-only for someone who can't send, and explains a conversation that's gone", async () => {
    mockApi({ "GET /api/me/conversations/k1": () => Response.json(view({ can_send: false })) });
    const { unmount } = renderWithProviders(<ConversationView id="k1" role="parent" backHref="/family/messages" />);
    expect(await screen.findByText("You can read this conversation, but not write in it.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    unmount();
    mockApi({ "GET /api/me/conversations/k1": () => apiErrorResponse(404, "not_found", "That conversation was not found.") });
    renderWithProviders(<ConversationView id="k1" role="teacher" backHref="/teach/messages" />);
    expect(await screen.findByText("This conversation isn't available")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to messages" })).toHaveAttribute("href", "/teach/messages");
  });

  it("loads earlier messages on request", async () => {
    mockApi({
      "GET /api/me/conversations/k1": ({ url }) =>
        url.searchParams.get("before")
          ? Response.json(view({ messages: [message({ id: "old", body: "An older message", created_at: minutesAgo(600) })], has_more: false }))
          : Response.json(view({ has_more: true })),
    });
    const { user } = renderWithProviders(<ConversationView id="k1" role="parent" backHref="/x" />);
    await user.click(await screen.findByRole("button", { name: "Show earlier messages" }));
    expect(await screen.findByText("An older message")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show earlier messages" })).not.toBeInTheDocument();
  });
});

describe("announcements", () => {
  const announcement = (overrides: Partial<Announcement> = {}): Announcement => ({
    id: "a1",
    title: "Trip on Friday",
    body: "Bring a packed lunch.",
    class_name: "Class 5L",
    teacher_name: "Tom Teacher",
    children: ["Leo"],
    created_at: minutesAgo(60),
    read: false,
    reach: null,
    ...overrides,
  });

  it("shows parents what's new, and marks it read", async () => {
    let read = false;
    mockApi({
      "GET /api/me/announcements": () => Response.json([announcement({ read }), announcement({ id: "a2", title: "Old news", read: true })]),
      "POST /api/me/announcements/a1/read": () => {
        read = true;
        return new Response(null, { status: 204 });
      },
      "GET /api/me/unread": () => Response.json({ messages: 0, announcements: 0 }),
    });
    const { user } = renderWithProviders(<ParentAnnouncements />);
    const trip = await screen.findByRole("group", { name: "Trip on Friday" });
    expect(within(trip).getByText("New")).toBeInTheDocument();
    expect(trip).toHaveTextContent("Tom Teacher · Class 5L (Leo's class)");
    expect(within(screen.getByRole("group", { name: "Old news" })).queryByRole("button")).not.toBeInTheDocument();
    await user.click(within(trip).getByRole("button", { name: "Mark as read" }));
    await waitFor(() => expect(within(screen.getByRole("group", { name: "Trip on Friday" })).queryByText("New")).not.toBeInTheDocument());
  });

  it("lets a teacher write to a class, and shows how many parents read each", async () => {
    const posts: unknown[] = [];
    mockApi({
      "GET /api/me/announcements": () => Response.json([announcement({ read: true, children: [], reach: { parents: 2, read: 1 } })]),
      "GET /api/me/contacts": () => Response.json({ children: [], classes: [{ id: "x5", name: "Class 5L", students: [{ id: "c1", name: "Leo", parents: 2 }, { id: "c3", name: "Mia", parents: 0 }] }] } satisfies Contacts),
      "POST /api/me/announcements": ({ body }) => {
        posts.push(body);
        return Response.json(announcement({ ...(body as object), reach: { parents: 2, read: 0 } }), { status: 201 });
      },
    });
    const { user } = renderWithProviders(<TeacherAnnouncements />);
    expect(await screen.findByText("Read by 1 of 2 parents")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Send to parents" }));
    expect(screen.getByText("Choose a class.")).toBeInTheDocument();
    expect(screen.getByText("Give it a title.")).toBeInTheDocument();
    expect(posts).toEqual([]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Class" }), "Class 5L");
    expect(screen.getByText("The parents of 1 of 2 pupils are on Lumina and will see it.")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Sports day");
    await user.type(screen.getByRole("textbox", { name: "Announcement" }), "Wear trainers.");
    await user.click(screen.getByRole("button", { name: "Send to parents" }));
    expect(await screen.findByText("Announcement sent")).toBeInTheDocument();
    expect(posts).toEqual([{ class_id: "x5", title: "Sports day", body: "Wear trainers." }]);
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("");
  });
});

describe("live updates", () => {
  class FakeEventSource {
    static last: FakeEventSource | null = null;
    listeners = new Map<string, Array<(event: MessageEvent) => void>>();
    onerror: (() => void) | null = null;
    closed = false;
    constructor(readonly url: string) {
      FakeEventSource.last = this;
    }
    addEventListener(type: string, listener: (event: MessageEvent) => void) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
    }
    emit(type: string, data: unknown = {}) {
      for (const listener of this.listeners.get(type) ?? []) listener(new MessageEvent(type, { data: JSON.stringify(data) }));
    }
    close() {
      this.closed = true;
    }
  }
  beforeEach(() => vi.stubGlobal("EventSource", FakeEventSource));
  afterEach(() => vi.unstubAllGlobals());

  function Probe() {
    const live = useLive();
    const conversation = useConversation("k1");
    return (
      <p>
        {live ? "live" : "polling"} · {conversation.data?.messages.length ?? 0} messages
      </p>
    );
  }

  it("connects, refetches a conversation when its message event arrives, and polls when the stream drops", async () => {
    let count = 1;
    const fetchMock = mockApi({ "GET /api/me/conversations/k1": () => Response.json(view({ messages: Array.from({ length: count }, (_, index) => message({ id: `m${index}` })) })) });
    const { unmount } = renderWithProviders(
      <LiveUpdatesProvider enabled>
        <Probe />
      </LiveUpdatesProvider>,
    );
    expect(await screen.findByText("polling · 1 messages")).toBeInTheDocument();
    const source = FakeEventSource.last!;
    expect(source.url).toBe("/api/me/events");
    act(() => source.emit("ready"));
    expect(await screen.findByText("live · 1 messages")).toBeInTheDocument();

    count = 2;
    act(() => source.emit("message", { type: "message", conversation_id: "k1" }));
    expect(await screen.findByText("live · 2 messages")).toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);

    act(() => source.onerror?.());
    expect(await screen.findByText("polling · 2 messages")).toBeInTheDocument();
    unmount();
    expect(source.closed).toBe(true);
  });

  it("does nothing for people who don't use messages", () => {
    FakeEventSource.last = null;
    renderWithProviders(
      <LiveUpdatesProvider enabled={false}>
        <p>child</p>
      </LiveUpdatesProvider>,
    );
    expect(FakeEventSource.last).toBeNull();
  });
});

describe("navigation", () => {
  it("offers Messages to parents and teachers (and Announcements to teachers), with the unread count", () => {
    expect(visibleNavItems("parent").map((item) => item.label)).toEqual(["Overview", "My children", "Messages"]);
    expect(visibleNavItems("teacher").map((item) => item.label)).toEqual(["Dashboard", "Messages", "Announcements"]);
    render(<AppNav items={visibleNavItems("parent")} activeHref="/family" badges={{ "/family/messages": 3 }} />);
    expect(screen.getByRole("link", { name: "Messages 3 unread" })).toHaveAttribute("href", "/family/messages");
  });

  it("writes times the way people read them", () => {
    const now = new Date(2026, 10, 16, 15, 0);
    expect(formatWhen(new Date(2026, 10, 16, 14, 5).toISOString(), now)).toBe("14:05");
    expect(formatWhen(new Date(2026, 10, 15, 9, 30).toISOString(), now)).toBe("Yesterday, 09:30");
    expect(formatWhen(new Date(2026, 10, 12, 9, 30).toISOString(), now)).toBe("Thu, Nov 12, 09:30");
    expect(formatWhen(new Date(2025, 10, 12, 9, 30).toISOString(), now)).toBe("Wed, Nov 12, 2025, 09:30");
    expect(dayHeading(new Date(2026, 10, 16, 8).toISOString(), now)).toBe("Today");
    expect(dayHeading(new Date(2026, 10, 13, 8).toISOString(), now)).toBe("Friday, Nov 13");
  });
});
