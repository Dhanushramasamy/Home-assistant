"use client";

/** Browser-side sign-in calls. Passwords are only ever checked on the server. */
export async function signIn(
  username: string,
  password: string
): Promise<{ success: boolean; username: string; role: "admin" | "user"; message: string }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, username: "", role: "user", message: data.message || "Invalid username or password." };
    }
    return { success: true, username: data.username, role: data.role, message: "" };
  } catch {
    return { success: false, username: "", role: "user", message: "Could not reach the server. Please try again." };
  }
}
