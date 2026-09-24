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

  // 1. Check Admin Credentials (DhanushRaja / Admin123)
  if (
    cleanUsername.toLowerCase() === ADMIN_USER.username.toLowerCase() &&
    cleanPassword === ADMIN_USER.password
  ) {
    // Upsert into user_PRB_home_assistant table to ensure admin exists in DB
    try {
      await supabase
        .from("user_PRB_home_assistant")
        .upsert([{ username: "DhanushRaja", password: "Admin123", role: "admin" }], {
          onConflict: "username",
        });
    } catch {}

    return {
      success: true,
      username: "DhanushRaja",
      role: "admin",
      message: "Welcome back, Admin DhanushRaja!",
    };
  }

  // 2. Query Supabase database for regular user / custom admin
  try {
    const { data: dbUser, error } = await supabase
      .from("user_PRB_home_assistant")
      .select("*")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (!error && dbUser) {
      if (dbUser.password === cleanPassword) {
        const userRole = dbUser.role === "admin" || cleanUsername.toLowerCase() === "dhanushraja" ? "admin" : "user";
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
          message: "Incorrect password. Please try again.",
        };
      }
    }
  } catch (err) {
    console.warn("DB Auth notice:", err);
  }

  // Standard user default login fallback for parents
  return {
    success: true,
    username: cleanUsername,
    role: "user",
    message: `Logged in as ${cleanUsername}`,
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

    return { success: true, message: `Created user '${cleanUsername}' (${role}).` };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}
