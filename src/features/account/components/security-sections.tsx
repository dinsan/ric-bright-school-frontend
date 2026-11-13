"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Laptop, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { renderSVG } from "uqr";
import { z } from "zod";
import { Form, FormErrorSummary, SubmitButton, useZodForm } from "@/components/forms/form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { oauthStartUrl } from "@/features/auth/api";
import { providerNames } from "@/features/auth/components/social-sign-in";
import { PASSWORD_MAX, PASSWORD_MIN, type Me, type OAuthProvider, type TotpSetup } from "@/features/auth/contract";
import { authApi } from "@/features/auth/api";
import { useUser } from "@/features/auth/session";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/format";
import { fields } from "@/lib/forms/zod";
import { messages } from "@/lib/forms/messages";
import { accountApi } from "../api";
import { useEndOtherSessions, useEndSession, useLinkedAccounts, useRefreshSession, useSessions } from "../hooks";
import { AccountSection } from "./section";

// --- Password ----------------------------------------------------------------------------------------

const passwordSchema = z
  .object({
    current_password: z.string().min(1, messages.required("your current password")),
    new_password: fields.text("a new password", { min: PASSWORD_MIN, max: PASSWORD_MAX }),
    confirm: z.string().min(1, messages.required("the new password again")),
  })
  .refine((values) => values.new_password === values.confirm, { path: ["confirm"], message: "The two passwords are different. Type the same one twice." })
  .refine((values) => values.new_password !== values.current_password, { path: ["new_password"], message: "Choose a password you haven't used here before." });

export function PasswordSection() {
  const form = useZodForm(passwordSchema, { defaultValues: { current_password: "", new_password: "", confirm: "" } });
  return (
    <AccountSection id="password" title="Password">
      <Form
        form={form}
        onSubmit={async ({ current_password, new_password }) => {
          await accountApi.changePassword({ current_password, new_password });
          form.reset();
          toast({ title: "Password changed", tone: "success" });
        }}
      >
        <FormErrorSummary title="Your password isn't changed yet" />
        <FormField name="current_password" label="Current password" required>
          <PasswordInput autoComplete="current-password" {...form.register("current_password")} />
        </FormField>
        <div className="grid gap-stack sm:grid-cols-2">
          <FormField name="new_password" label="New password" hint={`At least ${PASSWORD_MIN} characters.`} required>
            <PasswordInput autoComplete="new-password" {...form.register("new_password")} />
          </FormField>
          <FormField name="confirm" label="New password again" required>
            <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
          </FormField>
        </div>
        <div>
          <SubmitButton>Change password</SubmitButton>
        </div>
      </Form>
    </AccountSection>
  );
}

// --- Email ------------------------------------------------------------------------------------------

const emailSchema = z.object({ new_email: fields.email("your new email address"), password: z.string().min(1, messages.required("your password")) });

export function EmailSection({ user }: { user: Me }) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useZodForm(emailSchema, { defaultValues: { new_email: "", password: "" } });
  return (
    <AccountSection id="email" title="Email address" description={<>You sign in with <strong className="text-fg">{user.email}</strong>.</>}>
      {sentTo ? (
        <Alert tone="success" title="Check your new inbox" role="status">
          We sent a link to {sentTo}. The change happens when you open it. Until then, keep using your current address.
        </Alert>
      ) : (
        <Form
          form={form}
          onSubmit={async (values) => {
            await accountApi.changeEmail(values);
            setSentTo(values.new_email);
            form.reset();
          }}
        >
          <FormErrorSummary title="Your email isn't changed yet" />
          <div className="grid gap-stack sm:grid-cols-2">
            <FormField name="new_email" label="New email address" required>
              <Input type="email" autoComplete="email" {...form.register("new_email")} />
            </FormField>
            <FormField name="password" label="Your password" hint="To check it's you." required>
              <PasswordInput autoComplete="current-password" {...form.register("password")} />
            </FormField>
          </div>
          <div>
            <SubmitButton variant="secondary">Change email</SubmitButton>
          </div>
        </Form>
      )}
    </AccountSection>
  );
}

// --- Two-step verification (TOTP) -----------------------------------------------------------------------

const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the app.") });

export function MfaSection({ user: initialUser }: { user: Me }) {
  // The live session, not the page's snapshot: it changes when MFA is turned on or off here.
  const user = useUser() ?? initialUser;
  const refreshSession = useRefreshSession();
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const start = useMutation({ mutationFn: accountApi.startTotp, onSuccess: setSetup });

  return (
    <AccountSection
      id="two-step"
      title="Two-step verification"
      description="Signing in also asks for a code from an authenticator app on your phone, so a stolen password is not enough."
    >
      {codes ? (
        <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />
      ) : user.mfa_enabled ? (
        <MfaEnabled onCodes={setCodes} onDisabled={refreshSession} />
      ) : setup ? (
        <MfaSetup
          setup={setup}
          onCancel={() => setSetup(null)}
          onEnabled={(recovery) => {
            setSetup(null);
            setCodes(recovery);
            refreshSession();
          }}
        />
      ) : (
        <div className="grid gap-3">
          <p className="flex items-center gap-2 text-small">
            <Badge>Off</Badge>
          </p>
          {start.isError && <Alert tone="danger" role="alert" title="We couldn't start the setup. Try again." />}
          <div>
            <Button variant="primary" loading={start.isPending} onClick={() => start.mutate()}>
              <ShieldCheck aria-hidden />
              Turn on two-step verification
            </Button>
          </div>
        </div>
      )}
    </AccountSection>
  );
}

function MfaSetup({ setup, onEnabled, onCancel }: { setup: TotpSetup; onEnabled: (codes: string[]) => void; onCancel: () => void }) {
  const qr = useMemo(() => renderSVG(setup.otpauth_uri, { border: 2 }), [setup.otpauth_uri]);
  const form = useZodForm(codeSchema, { defaultValues: { code: "" } });
  return (
    <div className="grid gap-5">
      <ol className="grid list-decimal gap-2 pl-5 text-body">
        <li>Open an authenticator app (for example Google Authenticator, Microsoft Authenticator or 1Password).</li>
        <li>Scan this code, or type the key below.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className="flex flex-wrap items-center gap-5">
        {/* Generated locally from the otpauth URI: the secret never leaves the browser for a QR service. */}
        <div
          role="img"
          aria-label="QR code for your authenticator app"
          className="size-44 shrink-0 overflow-hidden rounded-control border-2 border-line bg-white p-1 [&_svg]:size-full"
          dangerouslySetInnerHTML={{ __html: qr }}
        />
        <div className="grid min-w-0 gap-1">
          <p className="text-small font-bold">Key</p>
          <code className="rounded-control bg-surface-sunken px-2 py-1 font-mono text-small break-all">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
        </div>
      </div>
      <Form form={form} onSubmit={async ({ code }) => onEnabled((await accountApi.confirmTotp(code)).recovery_codes)}>
        <FormErrorSummary title="Two-step verification isn't on yet" />
        <FormField name="code" label="6-digit code" required>
          <Input autoComplete="one-time-code" inputMode="numeric" className="max-w-48" {...form.register("code")} />
        </FormField>
        <div className="flex flex-wrap gap-3">
          <SubmitButton>Turn on</SubmitButton>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Form>
    </div>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const download = () => {
    const blob = new Blob([`Lumina recovery codes\n\n${codes.join("\n")}\n\nEach code works once.\n`], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "lumina-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <div className="grid gap-4" role="status">
      <Alert tone="warning" title="Save your recovery codes now">
        If you lose your phone, each of these codes lets you sign in once. You won&apos;t see them again.
      </Alert>
      <ul className="grid grid-cols-2 gap-2 font-mono sm:grid-cols-4">
        {codes.map((code) => (
          <li key={code} className="rounded-control bg-surface-sunken px-2 py-1 text-center">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Button onClick={download}>
          <Download aria-hidden />
          Download codes
        </Button>
        <Button variant="primary" onClick={onDone}>
          I&apos;ve saved them
        </Button>
      </div>
    </div>
  );
}

function MfaEnabled({ onCodes, onDisabled }: { onCodes: (codes: string[]) => void; onDisabled: () => void }) {
  const [action, setAction] = useState<"regenerate" | "disable" | null>(null);
  const form = useZodForm(codeSchema, { defaultValues: { code: "" } });
  return (
    <div className="grid gap-4">
      <p className="flex items-center gap-2 text-small">
        <Badge tone="success">On</Badge>
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setAction("regenerate")}>New recovery codes</Button>
        <Button variant="ghost" onClick={() => setAction("disable")}>
          Turn off
        </Button>
      </div>
      <Dialog open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent
          title={action === "disable" ? "Turn off two-step verification?" : "Make new recovery codes?"}
          description={
            action === "disable"
              ? "Your account will only be protected by your password. Enter a code from your app to confirm."
              : "Your old recovery codes will stop working. Enter a code from your app to confirm."
          }
        >
          <Form
            form={form}
            onSubmit={async ({ code }) => {
              if (action === "disable") {
                await accountApi.disableTotp(code);
                toast({ title: "Two-step verification is off", tone: "info" });
                onDisabled();
              } else {
                onCodes((await accountApi.regenerateRecoveryCodes(code)).recovery_codes);
              }
              form.reset();
              setAction(null);
            }}
          >
            <FormErrorSummary />
            <FormField name="code" label="6-digit code" required>
              <Input autoComplete="one-time-code" inputMode="numeric" {...form.register("code")} />
            </FormField>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Cancel</Button>
              </DialogClose>
              <SubmitButton variant={action === "disable" ? "danger" : "primary"}>{action === "disable" ? "Turn off" : "Make new codes"}</SubmitButton>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Linked social accounts -------------------------------------------------------------------------------

export function LinkedAccountsSection({ linkResult }: { linkResult?: { status: string | null; provider: string | null } }) {
  const queryClient = useQueryClient();
  const providers = useQuery({ queryKey: ["auth", "providers"], queryFn: authApi.providers, staleTime: 10 * 60_000 });
  const linked = useLinkedAccounts();
  const unlink = useMutation({
    mutationFn: accountApi.unlink,
    onSuccess: (_, provider) => {
      toast({ title: `${providerNames[provider]} is no longer linked`, tone: "info" });
      queryClient.invalidateQueries({ queryKey: ["account", "linked"] });
    },
    onError: (error) => toast({ title: "Could not unlink", description: error.message, tone: "danger" }),
  });
  const available = providers.data?.providers ?? [];
  if (providers.isSuccess && available.length === 0) return null;
  const name = (provider: string | null) => (provider ? (providerNames[provider as OAuthProvider] ?? provider) : "The account");

  return (
    <AccountSection id="social" title="Sign in with Google, Microsoft or Apple" description="Link an account to sign in with one click.">
      {linkResult?.status === "done" && <Alert tone="success" role="status" title={`${name(linkResult.provider)} is linked`} />}
      {linkResult?.status === "failed" && (
        <Alert tone="danger" role="alert" title="That account wasn't linked">
          It may already belong to another Lumina account. Try again or use a different account.
        </Alert>
      )}
      {linked.isPending || providers.isPending ? (
        <Skeleton className="h-control w-full" />
      ) : (
        <ul className="grid gap-3">
          {available.map((provider) => {
            const account = linked.data?.find((item) => item.provider === provider);
            return (
              <li key={provider} className="flex flex-wrap items-center justify-between gap-3 rounded-control border-2 border-line-subtle p-3">
                <div className="grid">
                  <span className="font-bold">{providerNames[provider]}</span>
                  <span className="text-small text-fg-muted">{account ? `Linked${account.email ? ` as ${account.email}` : ""}` : "Not linked"}</span>
                </div>
                {account ? (
                  <Button size="sm" loading={unlink.isPending && unlink.variables === provider} onClick={() => unlink.mutate(provider)}>
                    Unlink
                  </Button>
                ) : (
                  <a href={oauthStartUrl(provider, { intent: "link" })} className={buttonVariants({ size: "sm" })}>
                    Link
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AccountSection>
  );
}

// --- Sessions ------------------------------------------------------------------------------------------

/** "Chrome on Windows" from the raw user agent the API sends; other values as they are. */
export function describeDevice(device: string | null): string {
  if (!device) return "Unknown device";
  if (!device.startsWith("Mozilla/")) return device;
  const browser = /Edg\//.test(device) ? "Edge" : /Firefox\//.test(device) ? "Firefox" : /Chrome\//.test(device) ? "Chrome" : /Safari\//.test(device) ? "Safari" : "A browser";
  const system = /iPhone/.test(device) ? "iPhone" : /iPad/.test(device) ? "iPad" : /Android/.test(device) ? "Android" : /CrOS/.test(device) ? "Chromebook"
    : /Windows/.test(device) ? "Windows" : /Mac OS X/.test(device) ? "Mac" : /Linux/.test(device) ? "Linux" : null;
  return system ? `${browser} on ${system}` : browser;
}

export function SessionsSection() {
  const sessions = useSessions();
  const end = useEndSession();
  const endOthers = useEndOtherSessions();
  const others = (sessions.data ?? []).filter((session) => !session.current);
  return (
    <AccountSection id="sessions" title="Where you're signed in" description="Sign out of devices you don't use any more, or don't recognise.">
      {sessions.isPending ? (
        <div className="grid gap-2" role="status" aria-label="Loading sessions">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : sessions.isError ? (
        <Alert tone="danger" role="alert" title="Your sessions didn't load" action={<Button size="sm" onClick={() => sessions.refetch()}>Try again</Button>} />
      ) : (
        <>
          <ul className="grid gap-3">
            {sessions.data.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-control border-2 border-line-subtle p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Laptop aria-hidden className="size-icon shrink-0 text-fg-muted" />
                  <div className="grid min-w-0">
                    <span className="flex min-w-0 flex-wrap items-center gap-2 font-bold">
                      <span className="max-w-full min-w-0 truncate">{describeDevice(session.device)}</span>
                      {session.current && <Badge tone="success">This device</Badge>}
                    </span>
                    <span className="text-small text-fg-muted">
                      {[session.ip_address, `signed in ${formatDate(session.created_at)}`].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                </div>
                {!session.current && (
                  <Button size="sm" loading={end.isPending && end.variables === session.id} onClick={() => end.mutate(session.id)}>
                    <LogOut aria-hidden />
                    Sign out<span className="sr-only"> {describeDevice(session.device)}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {others.length > 0 && (
            <div>
              <Button
                loading={endOthers.isPending}
                onClick={() => endOthers.mutate(undefined, { onSuccess: () => toast({ title: "Signed out of your other devices", tone: "success" }) })}
              >
                Sign out everywhere else
              </Button>
            </div>
          )}
        </>
      )}
    </AccountSection>
  );
}

// --- Delete account --------------------------------------------------------------------------------------

const deleteSchema = z.object({ password: z.string(), confirm: z.literal("DELETE", { error: "Type DELETE in capital letters to confirm." }) });

export function DeleteAccountSection({ user }: { user: Me }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useZodForm(deleteSchema, { defaultValues: { password: "", confirm: "" as "DELETE" } });
  return (
    <AccountSection
      id="delete"
      tone="danger"
      title="Delete your account"
      description={
        user.role === "parent"
          ? "This deletes your account. Your children's accounts are not deleted; they stay linked to their school if they have one."
          : "This deletes your account and everything in it. It can't be undone."
      }
    >
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="danger" className="w-fit">
            <Trash2 aria-hidden />
            Delete account
          </Button>
        </DialogTrigger>
        <DialogContent title="Delete your account?" description="This can't be undone.">
          <Form
            form={form}
            onSubmit={async ({ password }) => {
              await accountApi.remove(password ? { password } : {});
              queryClient.clear();
              router.replace("/?account=deleted");
              router.refresh();
            }}
          >
            <FormErrorSummary title="Your account isn't deleted" />
            <FormField name="password" label="Your password" hint="Leave empty if you only sign in with Google, Microsoft or Apple.">
              <PasswordInput autoComplete="current-password" {...form.register("password")} />
            </FormField>
            <FormField name="confirm" label="Type DELETE to confirm" required>
              <Input autoComplete="off" autoCapitalize="characters" {...form.register("confirm")} />
            </FormField>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Keep my account</Button>
              </DialogClose>
              <SubmitButton variant="danger">Delete for good</SubmitButton>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </AccountSection>
  );
}
