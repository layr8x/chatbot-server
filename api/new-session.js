import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase.from("chat_sessions").insert({}).select().single();
  res.status(200).json({ sessionId: data.id });
}
