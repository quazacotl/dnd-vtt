export interface NamedRef {
    id: string
    name: string
}
export interface ParseContext {
    actorId: string
    actors: NamedRef[]
    targets: NamedRef[]
    weapons: NamedRef[]
}
export type ParseResult =
    | {kind: 'intent'; actorId: string; targetId: string; weaponId: string}
    | {
          kind: 'clarification'
          question: string
          options: NamedRef[]
          actorId: string
          weaponId: string
      }
    | {kind: 'unsupported'; reason: string}
export interface IntentParser {
    parse(text: string, context: ParseContext, signal: AbortSignal): Promise<ParseResult>
}
export interface ConnectionSettings {
    baseUrl: string
    model: string
    parserMode: 'local' | 'llm'
    rememberKey: boolean
}
