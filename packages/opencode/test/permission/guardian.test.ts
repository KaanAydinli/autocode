import { describe, expect, test } from "bun:test"
import { Guardian } from "@/permission/guardian"
import { SessionV1 } from "@opencode-ai/core/v1/session"

let counter = 0
function id(prefix: string) {
  counter++
  return `${prefix}_${counter.toString().padStart(6, "0")}`
}

function user(text: string): SessionV1.WithParts {
  const messageID = id("msg")
  return {
    info: {
      id: messageID,
      sessionID: "ses_test",
      role: "user",
      time: { created: counter },
      agent: "auto",
      model: { providerID: "anthropic", modelID: "claude-sonnet-5" },
    },
    parts: [{ id: id("prt"), sessionID: "ses_test", messageID, type: "text", text }],
  } as unknown as SessionV1.WithParts
}

function assistant(text: string, tool?: { name: string; input: unknown; output: string }): SessionV1.WithParts {
  const messageID = id("msg")
  const parts: unknown[] = [{ id: id("prt"), sessionID: "ses_test", messageID, type: "text", text }]
  if (tool)
    parts.push({
      id: id("prt"),
      sessionID: "ses_test",
      messageID,
      type: "tool",
      callID: id("call"),
      tool: tool.name,
      state: {
        status: "completed",
        input: tool.input,
        output: tool.output,
        title: tool.name,
        metadata: {},
        time: { start: 0, end: 0 },
      },
    })
  return {
    info: {
      id: messageID,
      sessionID: "ses_test",
      role: "assistant",
      time: { created: counter },
      agent: "auto",
    },
    parts,
  } as unknown as SessionV1.WithParts
}

describe("Guardian.transcript", () => {
  test("renders user, assistant, and tool entries in order", () => {
    const result = Guardian.transcript([
      user("please delete the temp folder"),
      assistant("running cleanup", { name: "bash", input: { command: "rm -rf /tmp/x" }, output: "done" }),
    ])
    expect(result).toContain("message/user: please delete the temp folder")
    expect(result).toContain("message/assistant: running cleanup")
    expect(result).toContain("tool_call/bash:")
    expect(result).toContain("rm -rf /tmp/x")
    expect(result).toContain("tool_result/bash: done")
    expect(result.indexOf("message/user")).toBeLessThan(result.indexOf("message/assistant"))
  })

  test("truncates oversized tool output with a marker", () => {
    const output = "x".repeat(Guardian.TOOL_CHAR_CAP * 3)
    const result = Guardian.transcript([assistant("ran it", { name: "bash", input: { command: "ls" }, output })])
    expect(result).toContain('<truncated omitted_approx_tokens="')
    expect(result.length).toBeLessThan(output.length)
  })

  test("keeps first and latest user messages when the budget overflows", () => {
    const filler = Array.from({ length: 30 }, (_, i) => user(`filler ${i} ${"y".repeat(4000)}`))
    const result = Guardian.transcript([user("first request"), ...filler, user("latest request")])
    expect(result).toContain("first request")
    expect(result).toContain("latest request")
    expect(result).toContain('<truncated omitted_messages="')
    expect(result.length).toBeLessThan(Guardian.TRANSCRIPT_CHAR_BUDGET * 2)
  })
})

describe("Guardian.prompt", () => {
  test("wraps transcript and planned action with review markers", () => {
    const built = Guardian.prompt({
      transcript: "message/user: run ls",
      action: Guardian.action({
        id: "per_1",
        sessionID: "ses_test",
        permission: "bash",
        patterns: ["ls *"],
        metadata: { command: "ls -la" },
        always: ["ls *"],
      } as never),
    })
    expect(built.system).toContain("judging one planned coding-agent action")
    expect(built.system).toContain('"outcome"')
    expect(built.user).toContain(">>> TRANSCRIPT START")
    expect(built.user).toContain(">>> TRANSCRIPT END")
    expect(built.user).toContain(">>> APPROVAL REQUEST START")
    expect(built.user).toContain('"permission": "bash"')
    expect(built.user).toContain("ls -la")
  })
})

describe("Guardian.decide", () => {
  test("allow maps to a once reply", () => {
    expect(Guardian.decide({ type: "assessment", assessment: { outcome: "allow" } })).toEqual({ reply: "once" })
  })

  test("deny maps to a reject with rationale and anti-workaround instructions", () => {
    const result = Guardian.decide({
      type: "assessment",
      assessment: { outcome: "deny", risk_level: "high", rationale: "exfiltrates credentials" },
    })
    expect(result.reply).toBe("reject")
    if (result.reply !== "reject") throw new Error("unreachable")
    expect(result.message).toContain("exfiltrates credentials")
    expect(result.message).toContain("must not attempt to achieve the same outcome via workaround")
  })

  test("timeout maps to a reject telling the agent it may retry or ask", () => {
    const result = Guardian.decide({ type: "timeout" })
    expect(result.reply).toBe("reject")
    if (result.reply !== "reject") throw new Error("unreachable")
    expect(result.message).toContain("did not finish before its deadline")
    expect(result.message).toContain("retry once")
  })

  test("errors fail closed", () => {
    const result = Guardian.decide({ type: "error" })
    expect(result.reply).toBe("reject")
    if (result.reply !== "reject") throw new Error("unreachable")
    expect(result.message).toContain("failed")
    expect(result.message).toContain("must not attempt to achieve the same outcome via workaround")
  })
})

describe("Guardian.parse", () => {
  test("reads a bare JSON object", () => {
    const result = Guardian.parse('{"risk_level":"low","user_authorization":"high","outcome":"allow","rationale":"ok"}')
    expect(result?.outcome).toBe("allow")
    expect(result?.risk_level).toBe("low")
  })

  test("extracts JSON from surrounding prose and code fences", () => {
    const result = Guardian.parse('Here is my assessment:\n```json\n{"outcome":"deny","rationale":"risky"}\n```\nDone.')
    expect(result?.outcome).toBe("deny")
    expect(result?.rationale).toBe("risky")
  })

  test("returns undefined for invalid or non-conforming output", () => {
    expect(Guardian.parse("I cannot decide")).toBeUndefined()
    expect(Guardian.parse('{"outcome":"maybe"}')).toBeUndefined()
  })
})

describe("Guardian.reviewerCandidates", () => {
  test("defaults to nemotron 3.5 lightning free", () => {
    expect(Guardian.reviewerCandidates(undefined)).toEqual([
      { providerID: "opencode", modelID: "nemotron-3.5-lightning-free" },
    ])
  })

  test("configured model comes first, default stays as fallback", () => {
    expect(Guardian.reviewerCandidates("anthropic/claude-sonnet-5")).toEqual([
      { providerID: "anthropic", modelID: "claude-sonnet-5" },
      { providerID: "opencode", modelID: "nemotron-3.5-lightning-free" },
    ])
  })

  test("configuring the default yields no duplicate", () => {
    expect(Guardian.reviewerCandidates("opencode/nemotron-3.5-lightning-free")).toEqual([
      { providerID: "opencode", modelID: "nemotron-3.5-lightning-free" },
    ])
  })

  test("blank config is ignored", () => {
    expect(Guardian.reviewerCandidates("  ")).toEqual([
      { providerID: "opencode", modelID: "nemotron-3.5-lightning-free" },
    ])
  })
})

describe("Guardian.createBreaker", () => {
  test("trips after three consecutive denials", () => {
    const breaker = Guardian.createBreaker()
    breaker.deny()
    breaker.deny()
    expect(breaker.tripped).toBe(false)
    breaker.deny()
    expect(breaker.tripped).toBe(true)
  })

  test("an allow resets the consecutive counter", () => {
    const breaker = Guardian.createBreaker()
    breaker.deny()
    breaker.deny()
    breaker.allow()
    breaker.deny()
    breaker.deny()
    expect(breaker.tripped).toBe(false)
  })

  test("trips on ten denials within the recent window even when interleaved", () => {
    const breaker = Guardian.createBreaker()
    for (let i = 0; i < 9; i++) {
      breaker.deny()
      breaker.allow()
    }
    expect(breaker.tripped).toBe(false)
    breaker.deny()
    expect(breaker.tripped).toBe(true)
  })
})
