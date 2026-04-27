import { describe, it, expect } from "vitest";
import { STREAM_DATA_SENDER_OFFSET } from "./vault-discovery";
import idlJson from "@/idl/sablier_lockup.json";

// Anchor primitive sizes in bytes.
const PRIMITIVE_SIZE: Record<string, number> = {
  bool: 1,
  u8: 1,
  i8: 1,
  u16: 2,
  i16: 2,
  u32: 4,
  i32: 4,
  u64: 8,
  i64: 8,
  u128: 16,
  i128: 16,
  pubkey: 32,
};

interface IdlField {
  name: string;
  type: unknown;
}

interface IdlType {
  name: string;
  type: { kind: string; fields?: IdlField[] };
}

interface IdlShape {
  types: IdlType[];
  accounts: Array<{ name: string }>;
}

const idl = idlJson as unknown as IdlShape;

function fieldSize(t: unknown): number {
  if (typeof t === "string") {
    if (t in PRIMITIVE_SIZE) return PRIMITIVE_SIZE[t];
    throw new Error(`Unknown primitive: ${t}`);
  }
  if (typeof t === "object" && t !== null && "defined" in t) {
    const defined = (t as { defined: { name: string } }).defined.name;
    const def = idl.types.find((x) => x.name === defined);
    if (!def) throw new Error(`Unknown defined type: ${defined}`);
    if (def.type.kind !== "struct" || !def.type.fields) {
      throw new Error(`Defined type ${defined} is not a struct`);
    }
    return def.type.fields.reduce((acc, f) => acc + fieldSize(f.type), 0);
  }
  throw new Error(`Unsupported field shape: ${JSON.stringify(t)}`);
}

/**
 * Re-derive the byte offset of any field inside a top-level account
 * struct, including the 8-byte Anchor discriminator. Anything that
 * doesn't match throws — meaning if Sablier ever inserts, removes, or
 * reorders fields, this test trips.
 */
function offsetOf(accountName: string, fieldName: string): number {
  const def = idl.types.find((x) => x.name === accountName);
  if (!def || def.type.kind !== "struct" || !def.type.fields) {
    throw new Error(`Account ${accountName} not found or not a struct`);
  }
  let offset = 8; // Anchor discriminator
  for (const f of def.type.fields) {
    if (f.name === fieldName) return offset;
    offset += fieldSize(f.type);
  }
  throw new Error(`Field ${fieldName} not found in ${accountName}`);
}

describe("STREAM_DATA_SENDER_OFFSET", () => {
  it("matches the offset computed from the bundled IDL", () => {
    // If this fails, Sablier reordered or resized a StreamData field.
    // Update STREAM_DATA_SENDER_OFFSET to match the new layout (and
    // re-fetch the IDL via `pnpm fetch:idl`).
    expect(offsetOf("StreamData", "sender")).toBe(STREAM_DATA_SENDER_OFFSET);
  });

  it("equals 123 (current SolSab v0.1 layout)", () => {
    // Pinned literal — second guardrail in case the IDL re-derivation
    // logic above ever has a bug. If both fail simultaneously, we know
    // the layout truly shifted.
    expect(STREAM_DATA_SENDER_OFFSET).toBe(123);
  });
});
