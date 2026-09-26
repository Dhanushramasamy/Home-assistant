import { supabase } from "./supabaseClient";
import { hashPassword, isPasswordHash, verifyPassword } from "./auth/password";

// Server-only: used by the /api/auth and /api/users routes. The browser never
// reads the users table or sees a password (plain or hashed).

const USER_TABLE = "user_PRB_home_assistant";

export interface UserAccount {
  id?: string;
  username: string;
  role: "admin" | "user";
  created_at?: string;
}

type Role = "admin" | "user";

function roleOf(row: { username: string; role?: unknown }): Role {
  if (row.role === "admin" || row.role === "user") return row.role;
  // Before supabase/add_user_role.sql adds the column, DhanushRaja is the admin.
  return row.username.toLowerCase() === "dhanushraja" ? "admin" : "user";
}

export async function loginUser(
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; username: string; role: Role; message: string }> {
  const cleanUsername = usernameInput.trim();
  const cleanPassword = passwordInput.trim();
  const fail = (message: string) => ({ success: false, username: "", role: "user" as Role, message });

  if (!cleanUsername || !cleanPassword) return fail("Please enter both username and password.");

  const { data: row, error } = await supabase
    .from(USER_TABLE)
    .select("*")
    .ilike("username", cleanUsername)
    .maybeSingle();

  if (error) return fail("Sign-in is unavailable right now. Please try again.");
  if (!row || typeof row.password !== "string") return fail("Invalid username or password.");

  let ok: boolean;
  if (isPasswordHash(row.password)) {
    ok = await verifyPassword(cleanPassword, row.password);
  } else {
    // Old plain-text password: compare once, then replace it with a hash.
    ok = row.password === cleanPassword;
    if (ok) {
      await supabase.from(USER_TABLE).update({ password: await hashPassword(cleanPassword) }).eq("id", row.id);
    }
  }
  if (!ok) return fail("Invalid username or password.");

  return { success: true, username: row.username, role: roleOf(row), message: `Welcome, ${row.username}!` };
}

export async function createUserAccount(
  usernameInput: string,
  passwordInput: string,
  role: Role = "user"
): Promise<{ success: boolean; message: string }> {
  const cleanUsername = usernameInput.trim();
  const cleanPassword = passwordInput.trim();

  if (!cleanUsername || !cleanPassword) return { success: false, message: "Username and password required." };
  if (cleanPassword.length < 6) return { success: false, message: "Password must be at least 6 characters." };

  try {
    // Usernames are matched case-insensitively at login, so block duplicates here.
    const { data: existing } = await supabase
      .from(USER_TABLE)
      .select("id")
      .ilike("username", cleanUsername)
      .maybeSingle();
    if (existing) return { success: false, message: `User '${cleanUsername}' already exists.` };

    const password = await hashPassword(cleanPassword);
    const { error } = await supabase.from(USER_TABLE).insert([{ username: cleanUsername, password, role }]);

    if (error) {
      // The users table has no `role` column yet (supabase/add_user_role.sql adds it).
      if (error.code === "PGRST204" && error.message.includes("role")) {
        if (role === "admin") {
          return {
            success: false,
            message: "Admin users need the role column. Run supabase/add_user_role.sql in Supabase, then try again.",
          };
        }
        const retry = await supabase.from(USER_TABLE).insert([{ username: cleanUsername, password }]);
        if (retry.error) return { success: false, message: "Could not create the user. Please try again." };
        return { success: true, message: `Created user '${cleanUsername}'.` };
      }
      return { success: false, message: "Could not create the user. Please try again." };
    }

    return { success: true, message: `Created user '${cleanUsername}'${role === "admin" ? " (administrator)" : ""}.` };
  } catch {
    return { success: false, message: "Could not reach the database. Please try again." };
  }
}

/** Changes a user's own password after checking the current one. */
export async function changePassword(
  username: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  if (newPassword.trim().length < 6) return { success: false, message: "New password must be at least 6 characters." };

  const check = await loginUser(username, currentPassword);
  if (!check.success) return { success: false, message: "Current password is incorrect." };

  const { error } = await supabase
    .from(USER_TABLE)
    .update({ password: await hashPassword(newPassword.trim()) })
    .ilike("username", username);
  if (error) return { success: false, message: "Could not change the password. Please try again." };
  return { success: true, message: "Password changed." };
}
