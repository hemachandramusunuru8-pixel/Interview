import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appBaseUrl } from "./base-url";

const saved = { app: process.env.APP_BASE_URL, url: process.env.URL };

beforeEach(() => {
  delete process.env.APP_BASE_URL;
  delete process.env.URL;
});
afterEach(() => {
  if (saved.app === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = saved.app;
  if (saved.url === undefined) delete process.env.URL;
  else process.env.URL = saved.url;
});

describe("appBaseUrl", () => {
  it("prefers APP_BASE_URL", () => {
    process.env.APP_BASE_URL = "https://app.example.com";
    process.env.URL = "https://other.netlify.app";
    expect(appBaseUrl()).toBe("https://app.example.com");
  });

  it("falls back to the Netlify site URL", () => {
    process.env.URL = "https://interview-llb0.netlify.app";
    expect(appBaseUrl()).toBe("https://interview-llb0.netlify.app");
  });

  it("falls back to localhost for local development", () => {
    expect(appBaseUrl()).toBe("http://localhost:3000");
  });

  it("removes a trailing slash so links are not doubled", () => {
    process.env.APP_BASE_URL = "https://app.example.com/";
    expect(appBaseUrl()).toBe("https://app.example.com");
  });
});
