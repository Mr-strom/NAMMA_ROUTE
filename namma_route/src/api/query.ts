import Anthropic from "@anthropic-ai/sdk";
import routes from "../data/routes.json";

export interface RouteResult {
  busNumber: string;
  boardingStop: string;
  boardingStopLat: number;
  boardingStopLng: number;
  alightStop: string;
  alightStopLat: number;
  alightStopLng: number;
  fare: number;
  duration: string;
  shakti: string;
  autoFare: number;
}

const fallbackResult: RouteResult = {
  busNumber: "500C",
  boardingStop: "Koramangala 4th Block",
  boardingStopLat: 12.9352,
  boardingStopLng: 77.6245,
  alightStop: "Majestic",
  alightStopLat: 12.9767,
  alightStopLng: 77.5713,
  fare: 15,
  duration: "35 mins",
  shakti: "Shakti eligible",
  autoFare: 210
};

export const queryRoute = async (from: string, to: string): Promise<RouteResult> => {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY as string | undefined;

  if (!apiKey) {
    return { ...fallbackResult, boardingStop: from || fallbackResult.boardingStop, alightStop: to || fallbackResult.alightStop };
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const system = `You are a Bengaluru transit routing assistant. Use the sample BMTC routes below as grounding context. Respond with JSON only.\n\n${JSON.stringify(routes, null, 2)}`;

  const userPrompt = `Find the best bus route from "${from}" to "${to}". Return only JSON with the shape: { busNumber, boardingStop, boardingStopLat, boardingStopLng, alightStop, alightStopLat, alightStopLng, fare, duration, shakti, autoFare }.`;

  const response = await client.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 400,
    system,
    messages: [{ role: "user", content: userPrompt }]
  });

  const text = response.content.find((block) => block.type === "text")?.text ?? "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Claude response was not valid JSON.");
  }

  const parsed = JSON.parse(text.slice(start, end + 1)) as RouteResult;

  return parsed;
};
