import "server-only";

import type { AdminUser, Child, LinkedAccount, Me, OAuthProvider, Session, TeacherProfile } from "@/features/auth/contract";
import type { OAuthAccountRow, SessionRow, TeacherProfileRow, UserRow } from "@/server/db";

/** Database rows -> the JSON shapes in features/auth/contract.ts. Nothing secret ever leaves through here. */

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : null);

export function toTeacherProfile(profile: TeacherProfileRow | null | undefined): TeacherProfile {
  return {
    school_name: profile?.schoolName ?? null,
    subjects: profile?.subjects ?? [],
    grade_levels: profile?.gradeLevels ?? [],
    bio: profile?.bio ?? null,
    verified: Boolean(profile?.verifiedAt),
  };
}

export function toMe(user: UserRow, profile?: TeacherProfileRow | null): Me {
  return {
    id: user.id,
    role: user.role,
    display_name: user.displayName,
    email: user.email,
    username: user.username,
    email_verified: Boolean(user.emailVerifiedAt),
    mfa_enabled: Boolean(user.mfaEnabledAt),
    avatar_url: user.avatarUrl,
    grade_level: user.gradeLevel,
    language: user.language,
    timezone: user.timezone,
    teacher_profile: user.role === "teacher" ? toTeacherProfile(profile) : null,
    active_child_id: user.role === "parent" ? user.activeChildId : null,
    created_at: user.createdAt.toISOString(),
  };
}

export function toAdminUser(user: UserRow, profile?: TeacherProfileRow | null): AdminUser {
  return {
    id: user.id,
    role: user.role,
    display_name: user.displayName,
    email: user.email,
    username: user.username,
    is_active: user.isActive,
    email_verified: Boolean(user.emailVerifiedAt),
    mfa_enabled: Boolean(user.mfaEnabledAt),
    teacher_verified: user.role === "teacher" ? Boolean(profile?.verifiedAt) : null,
    created_at: user.createdAt.toISOString(),
    last_login_at: iso(user.lastLoginAt),
  };
}

export function toChild(user: UserRow): Child {
  return {
    id: user.id,
    display_name: user.displayName,
    grade_level: user.gradeLevel,
    username: user.username,
    sign_in_method: user.pictureHash ? "pictures" : user.passwordHash ? "password" : null,
  };
}

export function toSession(session: SessionRow, currentSessionId: string): Session {
  return {
    id: session.id,
    current: session.id === currentSessionId,
    device: session.userAgent,
    ip_address: session.ipAddress,
    created_at: session.createdAt.toISOString(),
    last_seen_at: iso(session.lastSeenAt),
  };
}

export function toLinkedAccount(account: OAuthAccountRow): LinkedAccount {
  return { provider: account.provider as OAuthProvider, email: account.email, linked_at: account.createdAt.toISOString() };
}
