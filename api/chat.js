// api/chat.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID; // sk-proj- 키면 꼭 필요
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (!OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: "Supabase env missing" });
    if (OPENAI_API_KEY.startsWith("sk-proj-") && !OPENAI_PROJECT_ID) {
      return res.status(500).json({ error: "OPENAI_PROJECT_ID missing for sk-proj- keys" });
    }

    // 안전한 바디 파싱
    let payload = {};
    try {
      const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      payload = JSON.parse(raw || "{}");
    } catch {
      return res.status(400).json({ error: "Bad Request: JSON body required" });
    }
    const sessionId = String(payload.sessionId || "");
    const message = String(payload.message || "");
    if (!sessionId || !message) return res.status(400).json({ error: "sessionId and message are required" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 사용자 메시지 저장
    const ins1 = await supabase.from("chat_messages").insert({ session_id: sessionId, role: "user", content: message });
    if (ins1.error) throw ins1.error;

    // 히스토리 조회
    const hist = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(30);
    if (hist.error) throw hist.error;

    // OpenAI REST 호출 (프로젝트 헤더 포함)
    const headers = {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    };
    if (OPENAI_PROJECT_ID) headers["OpenAI-Project"] = OPENAI_PROJECT_ID;

    const oa = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "너는 공감형 심리상담 안내 챗봇. 위험 신호시 1393 등 안내. 진단은 하지 않음. 짧고 따뜻하게." },
          ...(hist.data || []),
          { role: "user", content: message }
        ],
        temperature: 0.3
      })
    });

    const data = await oa.json();
    if (!oa.ok) {
      // ❗ OpenAI가 준 에러를 그대로 보여줌: 어디가 문제인지 즉시 확인 가능
      return res.status(502).json({ error: "openai_error", detail: data });
    }

    const reply = data?.choices?.[0]?.message?.content || "";
    const ins2 = await supabase
      .from("chat_messages")
      .insert({ session_id: sessionId, role: "assistant", content: reply });
    if (ins2.error) throw ins2.error;

    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
