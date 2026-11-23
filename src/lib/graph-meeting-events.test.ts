import {
  constants,
  createCipheriv,
  createHmac,
  generateKeyPairSync,
  publicEncrypt,
  randomBytes,
} from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decryptMeetingCallEvent } from "./graph-meeting-events";

const originalCertificateId = process.env.GRAPH_WEBHOOK_CERTIFICATE_ID;
const originalPrivateKey = process.env.GRAPH_WEBHOOK_PRIVATE_KEY;

afterEach(() => {
  if (originalCertificateId === undefined) delete process.env.GRAPH_WEBHOOK_CERTIFICATE_ID;
  else process.env.GRAPH_WEBHOOK_CERTIFICATE_ID = originalCertificateId;
  if (originalPrivateKey === undefined) delete process.env.GRAPH_WEBHOOK_PRIVATE_KEY;
  else process.env.GRAPH_WEBHOOK_PRIVATE_KEY = originalPrivateKey;
});

function encryptedCallEnded() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const symmetricKey = randomBytes(32);
  const event = { id: "notification-1", eventType: "callEnded" as const, eventDateTime: "2030-06-01T10:30:00.000Z" };
  const cipher = createCipheriv("aes-256-cbc", symmetricKey, symmetricKey.subarray(0, 16));
  const data = Buffer.concat([cipher.update(JSON.stringify(event), "utf8"), cipher.final()]);
  const dataKey = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" },
    symmetricKey,
  );
  process.env.GRAPH_WEBHOOK_CERTIFICATE_ID = "cert-1";
  process.env.GRAPH_WEBHOOK_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  return {
    event,
    content: {
      data: data.toString("base64"),
      dataKey: dataKey.toString("base64"),
      dataSignature: createHmac("sha256", symmetricKey).update(data).digest("base64"),
      encryptionCertificateId: "cert-1",
    },
  };
}

describe("decryptMeetingCallEvent", () => {
  it("authenticates and decrypts a callEnded rich notification", () => {
    const { event, content } = encryptedCallEnded();
    expect(decryptMeetingCallEvent(content)).toEqual(event);
  });

  it("rejects a tampered encrypted payload", () => {
    const { content } = encryptedCallEnded();
    content.data = Buffer.from("tampered").toString("base64");
    expect(() => decryptMeetingCallEvent(content)).toThrow("signature is invalid");
  });
});
