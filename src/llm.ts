import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";

export type ChatProvider = "openai" | "anthropic";

export function getChatModel(provider: ChatProvider) {
  if (provider === "anthropic") {
    const model = "claude-3-5-sonnet-latest";
    return new ChatAnthropic({ model, temperature: 0.7 });
  }

  const model = "gpt-4o-mini";
  return new ChatOpenAI({ model, temperature: 0.7 });
}
