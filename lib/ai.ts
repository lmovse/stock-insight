interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AIResponse {
  content: string;
}

interface AIOptions {
  baseURL: string;
  apiKey: string;
  model: string;
}

export function buildPromptMessages(
  promptTemplate: string,
  stockCode: string,
  dateRange: string,
  klineData: string
): AIMessage[] {
  const userContent = promptTemplate
    .replace("{{stockCode}}", stockCode)
    .replace("{{dateRange}}", dateRange)
    .replace("{{klineData}}", klineData);

  return [
    { role: "system", content: userContent },
    {
      role: "user",
      content: `股票代码: ${stockCode}\n日期区间: ${dateRange}\nK线数据:\n${klineData}`,
    },
  ];
}

export async function callAI(
  messages: AIMessage[],
  options: AIOptions,
  signal?: AbortSignal
): Promise<AIResponse> {
  const url = `${options.baseURL}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI call failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return { content: data.choices?.[0]?.message?.content ?? "" };
}

export function formatKLineData(
  data: Array<{ date: number; open: number; high: number; low: number; close: number; volume: number }>
): string {
  const header = "日期,开,高,低,收,成交量";
  const rows = data.map(
    (d) =>
      `${d.date},${d.open},${d.high},${d.low},${d.close},${d.volume}`
  );
  return [header, ...rows].join("\n");
}
