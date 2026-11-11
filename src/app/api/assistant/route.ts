import { z } from "zod";
import { json, limitByIp, parseBody, route } from "@/lib/server/api";
import { assistantReply } from "@/lib/server/assistant";

const schema = z.object({ question: z.string().trim().min(1, "Bitte stellen Sie Ihre Frage").max(500, "Frage zu lang (maximal 500 Zeichen)") });

/** POST /api/assistant — réponse de l'assistant du site (rien n'est enregistré). */
export const POST = route("POST /api/assistant", async (req: Request) => {
  limitByIp(req, "assistant", 60);
  const { question } = await parseBody(req, schema);
  return json(await assistantReply(question));
});
