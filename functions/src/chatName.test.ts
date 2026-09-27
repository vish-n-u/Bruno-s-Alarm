import assert from "node:assert/strict";
import { test } from "node:test";
import { chatNameFor, displayNameForUid } from "./chatName";

// This exact bug shipped once already: an earlier shell edit silently turned the control-
// character and whitespace regexes into literal raw bytes instead of text escapes, which
// stripped spaces and repeated "s" characters out of every name that had them. This suite
// exists specifically so that can't happen again unnoticed.

test("a normal multi-word name passes through unchanged", () => {
  assert.equal(chatNameFor("uid1", "Jessica Moss"), "Jessica Moss");
});

test("control characters are stripped", () => {
  assert.equal(chatNameFor("uid1", "Bad\u0000Name\u007f"), "BadName");
});

test("repeated whitespace collapses to a single space, not to nothing", () => {
  assert.equal(chatNameFor("uid1", "Jess   ica"), "Jess ica");
});

test("a name that's only whitespace/control characters falls back", () => {
  assert.equal(chatNameFor("uid1", "\u0000\u0000  "), displayNameForUid("uid1"));
});

test("a reserved/impersonating name falls back to the anonymous name", () => {
  assert.equal(chatNameFor("uid1", "bruno"), displayNameForUid("uid1"));
  assert.equal(chatNameFor("uid1", "Admin"), displayNameForUid("uid1"));
});

test("a reserved word as part of a longer word is NOT treated as impersonation", () => {
  // \b word-boundary anchors mean "brunofan" or "modern" shouldn't be caught by the
  // "mod"/"bruno" entries — only whole-word matches should.
  assert.equal(chatNameFor("uid1", "brunofan123"), "brunofan123");
  assert.equal(chatNameFor("uid1", "Modern Art"), "Modern Art");
});

test("a profane name falls back to the anonymous name", () => {
  assert.equal(chatNameFor("uid1", "fuck"), displayNameForUid("uid1"));
});

test("a non-string or missing name falls back to the anonymous name", () => {
  assert.equal(chatNameFor("uid1", undefined), displayNameForUid("uid1"));
  assert.equal(chatNameFor("uid1", 42), displayNameForUid("uid1"));
});

test("a name longer than the limit is truncated, not rejected", () => {
  const long = "A".repeat(40);
  assert.equal(chatNameFor("uid1", long), "A".repeat(24));
});

test("displayNameForUid is deterministic for the same uid", () => {
  assert.equal(displayNameForUid("same-uid"), displayNameForUid("same-uid"));
});
