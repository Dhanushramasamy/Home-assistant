import { supabase } from "./supabaseClient";

export interface UserAccount {
  id?: string;
  username: string;
  password?: string;
  role: "admin" | "user";
  created_at?: string;
}

export const ADMIN_USER: UserAccount = {
  username: "DhanushRaja",
  password: "Admin123",
  role: "admin",
};

/**
 * Ensures Admin DhanushRaja account exists inside Supabase DB table user_PRB_home_assistant
 */
async function ensureAdminInDatabase(): Promise<void> {
  try {
    const { data } = await supabase
      .from("user_PRB_home_assistant")
      .select("*")
      .ilike("username", "DhanushRaja")
      .maybeSingle();

    if (!data) {
      await supabase.from("user_PRB_home_assistant").insert([
        {
          username: "DhanushRaja",
          password: "Admin123",
          role: "admin",
        },
      ]);
    }
  } catch (err) {
    console.warn("Supabase admin seeding notice:", err);
  }
}

export async function loginUser(
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; username: string; role: "admin" | "user"; message: string }> {
  const cleanUsername = usernameInput.trim();
  const cleanPassword = passwordInput.trim();

  if (!cleanUsername || !cleanPassword) {
    return {
      success: false,
      username: "",
      role: "user",
      message: "Please enter both username and password.",
    };
  }

  // Ensure admin user is seeded in Supabase DB table
  await ensureAdminInDatabase();

  // 1. Query Supabase database table user_PRB_home_assistant directly
  try {
    const { data: dbUser, error } = await supabase
      .from("user_PRB_home_assistant")
      .select("*")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (!error && dbUser) {
      if (dbUser.password === cleanPassword) {
        const userRole =
          dbUser.role === "admin" || cleanUsername.toLowerCase() === "dhanushraja"
            ? "admin"
            : "user";
        return {
          success: true,
          username: dbUser.username,
          role: userRole,
          message: `Welcome, ${dbUser.username}!`,
        };
      } else {
        return {
          success: false,
          username: cleanUsername,
          role: "user",
          message: "Incorrect password.",
        };
      }
    }
  } catch (err) {
    console.warn("Supabase DB auth query error:", err);
  }

  // 2. Fallback check for DhanushRaja / Admin123 if DB is temporarily unreachable
  if (
    cleanUsername.toLowerCase() === "dhanushraja" &&
    cleanPassword === "Admin123"
  ) {
    return {
      success: true,
      username: "DhanushRaja",
      role: "admin",
      message: "Welcome back, Admin DhanushRaja!",
    };
  }

  return {
    success: false,
    username: cleanUsername,
    role: "user",
    message: "Invalid credentials.",
  };
}

export async function createUserAccount(
  usernameInput: string,
  passwordInput: string,
  role: "admin" | "user" = "user"
): Promise<{ success: boolean; message: string }> {
  const cleanUsername = usernameInput.trim();
  const cleanPassword = passwordInput.trim();

  if (!cleanUsername || !cleanPassword) {
    return { success: false, message: "Username and password required." };
  }

  try {
    const { error } = await supabase.from("user_PRB_home_assistant").insert([
      {
        username: cleanUsername,
        password: cleanPassword,
        role,
      },
    ]);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: `Created user '${cleanUsername}' (${role}) in Supabase database.` };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}
