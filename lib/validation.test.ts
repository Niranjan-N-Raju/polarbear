import { describe, it, expect } from "vitest";
import {
  loginBodySchema,
  createUserBodySchema,
  createStoreBodySchema,
  passwordSchema,
  emailSchema,
  parseBodyWithLimit,
} from "@/lib/validation";

describe("loginBodySchema", () => {
  it("accepts valid login data", () => {
    const result = loginBodySchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty email", () => {
    const result = loginBodySchema.safeParse({ email: "", password: "pass" });
    expect(result.success).toBe(false);
  });

  it("rejects missing password", () => {
    const result = loginBodySchema.safeParse({ email: "test@example.com" });
    expect(result.success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("rejects short passwords", () => {
    const result = passwordSchema.safeParse("Short1!");
    expect(result.success).toBe(false);
  });

  it("rejects passwords without uppercase", () => {
    const result = passwordSchema.safeParse("alllowercase1!");
    expect(result.success).toBe(false);
  });

  it("rejects passwords without digits", () => {
    const result = passwordSchema.safeParse("NoDigitsHere!!");
    expect(result.success).toBe(false);
  });

  it("rejects passwords without special chars", () => {
    const result = passwordSchema.safeParse("NoSpecial1234A");
    expect(result.success).toBe(false);
  });

  it("accepts strong passwords", () => {
    const result = passwordSchema.safeParse("StrongP@ss1234");
    expect(result.success).toBe(true);
  });
});

describe("emailSchema", () => {
  it("accepts valid emails", () => {
    const result = emailSchema.safeParse("User@Example.COM");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("user@example.com");
    }
  });

  it("rejects invalid emails", () => {
    expect(emailSchema.safeParse("notanemail").success).toBe(false);
    expect(emailSchema.safeParse("@example.com").success).toBe(false);
    expect(emailSchema.safeParse("test@").success).toBe(false);
  });

  it("rejects oversized emails", () => {
    const longEmail = "a".repeat(250) + "@b.c";
    expect(emailSchema.safeParse(longEmail).success).toBe(false);
  });
});

describe("createUserBodySchema", () => {
  it("validates a valid user creation body", () => {
    const result = createUserBodySchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "Str0ngP@ssword!",
      role: "employee",
      franchiseIds: ["abc123"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects name exceeding max length", () => {
    const result = createUserBodySchema.safeParse({
      name: "A".repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

describe("createStoreBodySchema", () => {
  it("validates valid store data", () => {
    const result = createStoreBodySchema.safeParse({
      name: "My Store",
      storeCode: "MS001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects long store codes", () => {
    const result = createStoreBodySchema.safeParse({
      name: "My Store",
      storeCode: "A".repeat(21),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing store code", () => {
    const result = createStoreBodySchema.safeParse({
      name: "My Store",
    });
    expect(result.success).toBe(false);
  });
});

describe("parseBodyWithLimit", () => {
  it("rejects body exceeding size limit via content-length header", async () => {
    const headers = new Headers({ "content-length": "200000" });
    const req = new Request("http://localhost/test", {
      method: "POST",
      headers,
      body: "{}",
    });
    const result = await parseBodyWithLimit(req, 100_000);
    expect(result).toBeNull();
  });

  it("parses valid JSON within limits", async () => {
    const body = JSON.stringify({ key: "value" });
    const req = new Request("http://localhost/test", {
      method: "POST",
      body,
    });
    const result = await parseBodyWithLimit(req, 100_000);
    expect(result).toEqual({ key: "value" });
  });
});
