import { supabase } from "./supabaseClient";

export interface UserAccount {
  id?: string;
  username: string;
  password?: string;
  created_at?: string;
}

export async function loginOrRegisterUser(
  username: string,
  password?: string
): Promise<{ success: boolean; username: string; message: string }> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) {
    return { success: false, username: "", message: "Username is required." };
  }

  try {
    // 1. Check if user exists in user_PRB_home_assistant
    const { data: existingUser, error: findError } = await supabase
      .from("user_PRB_home_assistant")
      .select("*")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (findError && findError.code !== "PGRST116") {
      console.warn("Supabase query error:", findError);
    }

    if (existingUser) {
      // User exists, verify password if provided
      if (password && existingUser.password && existingUser.password !== password) {
        return { success: false, username: cleanUsername, message: "Invalid password." };
      }
      return { success: true, username: cleanUsername, message: `Welcome back, ${cleanUsername}!` };
    }

    // 2. Register new user into user_PRB_home_assistant
    const { error: insertError } = await supabase
      .from("user_PRB_home_assistant")
      .insert([
        {
          username: cleanUsername,
          password: password || "123456",
        },
      ]);

    if (insertError) {
      console.warn("Supabase user creation notice:", insertError);
    }

    return {
      success: true,
      username: cleanUsername,
      message: `Account created for ${cleanUsername}!`,
    };
  } catch (err) {
    console.warn("User auth fallback:", err);
    return {
      success: true,
      username: cleanUsername,
      message: `Logged in as ${cleanUsername}`,
    };
  }
}
