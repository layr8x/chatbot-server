import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  const { sessionId, message } = JSON.parse(req.body);

  await supabase.from("chat_messages").insert({ session_id: sessionId, role: "user", content: message });

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const systemMessage = {
    role: "system",
    content: "너는 따뜻한 심리상담 챗봇이야. 위기 시 1393 등 도움 채널을 안내해줘."
  };

  const messages = [systemMessage, ...(history || []), { role: "user", content: message }];

  const reply = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages
  });

  const answer = reply.choices[0].message.content;

  await supabase.from("chat_messages").insert({ session_id: sessionId, role: "assistant", content: answer });

  res.status(200).json({ reply: answer });
}
