import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { PermissionV1 } from "@opencode-ai/core/v1/permission"
import { Context, Effect, Layer, Schema, Stream } from "effect"
import { streamText } from "ai"
import { Guardian } from "./guardian"
import { Permission } from "@/permission"
import { Auth } from "@/auth"
import { Provider } from "@/provider/provider"
import { ProviderTransform } from "@/provider/transform"
import { Session } from "@/session/session"
import { InstanceStore } from "@/project/instance-store"
import { EventV2Bridge } from "@/event-v2-bridge"
import { SessionID } from "@/session/schema"

// Automated permission reviewer: sessions running the "auto" agent get their
// permission requests judged by the session's chat model instead of prompting the user.
export interface Interface {
  readonly agent: string
}

export class Service extends Context.Service<Service, Interface>()("@opencode/PermissionGuardian") {}

export const AGENT = "auto"

export class UnparsableAssessmentError extends Schema.TaggedErrorClass<UnparsableAssessmentError>()(
  "PermissionGuardian.UnparsableAssessmentError",
  { requestID: PermissionV1.ID },
) {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const events = yield* EventV2Bridge.Service
    const permission = yield* Permission.Service
    const provider = yield* Provider.Service
    const session = yield* Session.Service
    const store = yield* InstanceStore.Service
    const auth = yield* Auth.Service
    const breakers = new Map<string, ReturnType<typeof Guardian.createBreaker>>()
    const reviewed = new Set<PermissionV1.ID>()

    const assess = Effect.fn("PermissionGuardian.assess")(function* (request: PermissionV1.Request) {
      const messages = yield* session.messages({ sessionID: SessionID.make(request.sessionID) })
      const lastUser = messages.findLast((message) => message.info.role === "user")
      const ref =
        lastUser?.info.role === "user"
          ? { providerID: lastUser.info.model.providerID, modelID: lastUser.info.model.modelID }
          : yield* provider.defaultModel()
      const model = yield* provider.getModel(ref.providerID, ref.modelID)
      const language = yield* provider.getLanguage(model)
      const built = Guardian.prompt({
        transcript: Guardian.transcript(messages),
        action: Guardian.action(request),
      })
      // OpenAI OAuth models reject system messages and require store: false plus
      // streaming; mirror Agent.generate.
      const authInfo = yield* auth.get(ref.providerID).pipe(Effect.orDie)
      const isOpenaiOauth = ref.providerID === "openai" && authInfo?.type === "oauth"
      const text = yield* Effect.promise(async () => {
        const result = streamText({
          model: language,
          messages: [
            ...(isOpenaiOauth ? [] : [{ role: "system" as const, content: built.system }]),
            { role: "user" as const, content: built.user },
          ],
          ...(isOpenaiOauth
            ? {
                providerOptions: ProviderTransform.providerOptions(model, {
                  instructions: built.system,
                  store: false,
                }),
              }
            : {}),
          onError: () => {},
        })
        for await (const part of result.fullStream) {
          if (part.type === "error") throw part.error
        }
        return result.text
      })
      const assessment = Guardian.parse(text)
      if (!assessment) return yield* Effect.fail(new UnparsableAssessmentError({ requestID: request.id }))
      return assessment
    })

    const review = Effect.fn("PermissionGuardian.review")(function* (request: PermissionV1.Request) {
      const breaker = breakers.get(request.sessionID) ?? Guardian.createBreaker()
      breakers.set(request.sessionID, breaker)
      // Tripped breaker: stop auto-reviewing and let the pending request surface to the user.
      if (breaker.tripped) return

      const result: Guardian.ReviewResult = yield* assess(request).pipe(
        Effect.map((assessment) => ({ type: "assessment" as const, assessment })),
        Effect.timeout(Guardian.REVIEW_TIMEOUT_MS),
        Effect.catchTag("TimeoutError", () => Effect.succeed({ type: "timeout" as const })),
        Effect.catchCause((cause) => {
          const reason = cause.reasons?.[0]
          const defect = reason && "defect" in reason && typeof reason.defect === "object" ? reason.defect : undefined
          return Effect.logWarning("guardian review failed", {
            requestID: request.id,
            cause,
            statusCode: defect && "statusCode" in defect ? defect.statusCode : undefined,
            responseBody: defect && "responseBody" in defect ? defect.responseBody : undefined,
          }).pipe(Effect.as({ type: "error" as const }))
        }),
      )
      if (result.type === "assessment") {
        if (result.assessment.outcome === "deny") breaker.deny()
        if (result.assessment.outcome === "allow") breaker.allow()
      }
      const decision = Guardian.decide(result)
      yield* Effect.logInfo("guardian decision", {
        requestID: request.id,
        permission: request.permission,
        reply: decision.reply,
        ...(result.type === "assessment" ? { risk: result.assessment.risk_level } : { result: result.type }),
      })
      reviewed.add(request.id)
      yield* permission
        .replyOne({
          requestID: request.id,
          reply: decision.reply,
          ...(decision.reply === "reject" ? { message: decision.message } : {}),
        })
        // The user may have answered first; their reply wins.
        .pipe(Effect.catchTag("Permission.NotFoundError", () => Effect.void))
    })

    yield* events.subscribe(PermissionV1.Event.Asked).pipe(
      Stream.runForEach((event) => {
        if (event.data.agent !== AGENT) return Effect.void
        const directory = event.location?.directory
        if (!directory) return Effect.void
        return store
          .provide({ directory }, review(event.data))
          .pipe(
            Effect.catchCause((cause) => Effect.logError("guardian review crashed", { requestID: event.data.id, cause })),
            Effect.forkScoped,
            Effect.asVoid,
          )
      }),
      Effect.forkScoped({ startImmediately: true }),
    )

    // A reply the guardian did not produce is the user intervening; give the
    // session a fresh circuit-breaker budget.
    yield* events.subscribe(PermissionV1.Event.Replied).pipe(
      Stream.runForEach((event) =>
        Effect.sync(() => {
          if (reviewed.delete(event.data.requestID)) return
          breakers.get(event.data.sessionID)?.reset()
        }),
      ),
      Effect.forkScoped({ startImmediately: true }),
    )

    return Service.of({ agent: AGENT })
  }),
)

export const node = LayerNode.make({
  service: Service,
  layer: layer,
  deps: [EventV2Bridge.node, Permission.node, Provider.node, Session.node, InstanceStore.node, Auth.node],
})

export * as PermissionGuardian from "./guardian-service"
