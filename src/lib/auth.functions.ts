import { createServerFn } from "@tanstack/react-start";

async function pbkdf2(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  const keyMat = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMat,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSaltHex(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normUsername(first: string, last: string): string {
  return `${first.trim().toLowerCase()}.${last.trim().toLowerCase()}`.replace(
    /[^a-z0-9.]/g,
    "",
  );
}

export type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
};

export const signupUser = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { firstName: string; lastName: string; password: string }) => {
      const firstName = data.firstName?.trim();
      const lastName = data.lastName?.trim();
      const password = data.password ?? "";
      if (!firstName || firstName.length > 50) throw new Error("Invalid first name");
      if (!lastName || lastName.length > 50) throw new Error("Invalid last name");
      if (password.length < 6 || password.length > 200)
        throw new Error("Password must be at least 6 characters");
      return { firstName, lastName, password };
    },
  )
  .handler(async ({ data }) => {
    console.log('[auth] signupUser handler start', { firstName: data.firstName, lastName: data.lastName });
    const { dbAdmin } = await import("@/integrations/localdb/client.server");
    const admin = dbAdmin as unknown as {
      from: (t: string) => {
        insert: (v: Record<string, unknown>) => {
          select: (c: string) => { single: () => Promise<{ data: any; error: any }> };
        };
      };
    };
    const username = normUsername(data.firstName, data.lastName);
    if (!username) throw new Error("Invalid name");

    const salt = randomSaltHex();
    const password_hash = await pbkdf2(data.password, salt);

    const { data: inserted, error } = await admin
      .from("app_users")
      .insert({
        first_name: data.firstName,
        last_name: data.lastName,
        username,
        password_hash,
        salt,
      })
      .select("id, first_name, last_name, username")
      .single();

    console.log('[auth] signupUser inserted', { inserted, error });

    if (error) {
      if (error.code === "23505") throw new Error("That name is already registered. Please log in.");
      console.error(error);
      throw new Error("Signup failed");
    }

    return {
      id: inserted.id,
      firstName: inserted.first_name,
      lastName: inserted.last_name,
      username: inserted.username,
    } satisfies SessionUser;
  });

export const loginUser = createServerFn({ method: "POST" })
  .inputValidator((data: { firstName: string; lastName: string; password: string }) => {
    const firstName = data.firstName?.trim();
    const lastName = data.lastName?.trim();
    const password = data.password ?? "";
    if (!firstName || !lastName || !password) throw new Error("Missing credentials");
    return { firstName, lastName, password };
  })
  .handler(async ({ data }) => {
    console.log('[auth] loginUser handler start', { firstName: data.firstName, lastName: data.lastName });
    const { dbAdmin } = await import("@/integrations/localdb/client.server");
    const admin = dbAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, v: string) => { maybeSingle: () => Promise<{ data: any; error: any }> };
        };
      };
    };
    const username = normUsername(data.firstName, data.lastName);
    const { data: row, error } = await admin
      .from("app_users")
      .select("id, first_name, last_name, username, password_hash, salt")
      .eq("username", username)
      .maybeSingle();

    console.log('[auth] loginUser lookup', { row, error });
    if (error) {
      console.error(error);
      throw new Error("Login failed");
    }
    if (!row) throw new Error("No account found. Please sign up.");
    const candidate = await pbkdf2(data.password, row.salt);
    if (candidate !== row.password_hash) throw new Error("Incorrect password");
    const result = {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      username: row.username,
    } satisfies SessionUser;
    console.log('[auth] loginUser return', result.username);
    return result;
  });

