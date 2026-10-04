// AI recepcioner: jedna poruka klijenta → odgovor, uz pozive alata po potrebi.
// Ne zavisi od kanala — web chat, Instagram, WhatsApp i (kasnije) glas zovu istu funkciju.
import OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { listServices } from "../services/catalog";
import type { Salon } from "../services/salons";
import { listStaff } from "../services/staff";
import {
  appendMessages,
  type Channel,
  countUserMessages,
  getOrCreateConversation,
  loadMessages,
} from "./conversations";
import { buildInstructions } from "./prompt";
import { extractTimes, openAiToolDefinitions, runTool, type ToolContext } from "./tools";

const MAX_TOOL_ROUNDS = 6;
const MAX_USER_MESSAGES = 60;
const HISTORY_LIMIT = 30;

const CHANNEL_LABEL: Record<Channel, string> = {
  chat: "chat na web stranici salona",
  instagram: "Instagram poruke",
  messenger: "Facebook Messenger",
  whatsapp: "WhatsApp",
  viber: "Viber",
  voice: "telefonski poziv (odgovori kratko, bez emotikona i formatiranja)",
};

export class AgentUnavailableError extends Error {}

let client: OpenAI | null = null;
function openai() {
  if (!process.env.OPENAI_API_KEY) throw new AgentUnavailableError("OPENAI_API_KEY nije postavljen.");
  client ??= new OpenAI();
  return client;
}

export interface AgentReply {
  conversationId: string;
  reply: string;
  status: "open" | "handoff" | "closed";
  booked: boolean;
}

export async function respond(input: {
  salon: Salon;
  channel: Channel;
  /** ID niti na kanalu (za web chat: nasumičan token iz preglednika). */
  externalId: string;
  text: string;
  now?: Date;
}): Promise<AgentReply> {
  const api = openai();
  const { salon, channel } = input;
  const now = input.now ?? new Date();
  const conversation = await getOrCreateConversation(salon.id, channel, input.externalId);

  if ((await countUserMessages(conversation.id)) >= MAX_USER_MESSAGES) {
    return {
      conversationId: conversation.id,
      reply: `Ovaj razgovor je predug za automatske odgovore. Molimo pozovite salon${salon.phone ? ` na ${salon.phone}` : ""}.`,
      status: conversation.status,
      booked: false,
    };
  }

  const [services, staff, history] = await Promise.all([
    listServices(salon.id),
    listStaff(salon.id),
    loadMessages(conversation.id),
  ]);
  const ctx: ToolContext = {
    salon,
    conversationId: conversation.id,
    channel,
    staffName: new Map(staff.map((s) => [s.id, s.name])),
    // Samo ono što je recepcioner zaista napisao klijentu može biti upisano
    offeredTimes: new Set(history.filter((m) => m.role === "assistant").flatMap((m) => extractTimes(m.content))),
  };

  const instructions = buildInstructions({ salon, services, staff, now, channelLabel: CHANNEL_LABEL[channel] });
  const items: ResponseInputItem[] = [
    ...history
      .filter((m) => m.role !== "tool" && m.content)
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: input.text },
  ];

  const toolLog: Parameters<typeof appendMessages>[1] = [];
  let reply = "";
  let booked = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await api.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions,
      input: items,
      tools: openAiToolDefinitions(),
      // Bez spremanja kod OpenAI-ja; razmišljanje modela vraćamo šifrovano unutar istog poteza
      store: false,
      include: ["reasoning.encrypted_content"],
      ...(process.env.OPENAI_REASONING_EFFORT !== "none" && {
        reasoning: { effort: (process.env.OPENAI_REASONING_EFFORT as "low" | "medium" | "high") || "low" },
      }),
    });

    items.push(...(response.output as ResponseInputItem[]));
    const calls = response.output.filter((o) => o.type === "function_call");
    if (!calls.length) {
      reply = response.output_text.trim();
      break;
    }

    for (const call of calls) {
      const { args, result } = await runTool(ctx, call.name, call.arguments);
      const r = result as { booked?: boolean; rescheduled?: boolean };
      if (r?.booked || r?.rescheduled) booked = true;
      items.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
      toolLog.push({ role: "tool", toolName: call.name, toolArgs: args, toolResult: result });
    }
  }

  if (!reply) {
    reply = `Izvinite, trenutno ne mogu završiti ovaj upit. Molimo pozovite salon${salon.phone ? ` na ${salon.phone}` : ""}.`;
  }

  await appendMessages(conversation.id, [
    { role: "user", content: input.text },
    ...toolLog,
    { role: "assistant", content: reply },
  ]);

  const handedOff = toolLog.some((t) => t.toolName === "handoff_to_staff");
  return {
    conversationId: conversation.id,
    reply,
    status: handedOff ? "handoff" : conversation.status,
    booked,
  };
}
