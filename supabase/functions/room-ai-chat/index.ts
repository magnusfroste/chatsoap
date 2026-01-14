import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomId, messageHistory, persona } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build conversation context from message history
    const conversationMessages = messageHistory.map((msg: any) => ({
      role: msg.is_ai ? "assistant" : "user",
      content: msg.is_ai ? msg.content : `[${msg.display_name || "Användare"}]: ${msg.content}`,
    }));

    console.log("Sending to AI with", conversationMessages.length, "messages, persona:", persona);

    // Define persona-specific system prompts
    const personaPrompts: Record<string, string> = {
      general: `Du är en hjälpsam AI-assistent i Silicon Valhalla Meet - en exklusiv kollaborationsplattform för tech-eliten.

Du deltar i ett rum där flera användare kan ställa frågor och diskutera tillsammans med dig.
Meddelanden från användare visas med deras namn i hakparenteser, t.ex. "[Anna]: Hej!"
Du ska svara på svenska om inte användaren skriver på ett annat språk.

Var:
- Koncis men informativ
- Tekniskt kunnig
- Vänlig och samarbetsvillig
- Kreativ när det passar

Om någon frågar något du inte vet, var ärlig med det. Du kan spekulera men var tydlig med att det är spekulation.`,

      code: `Du är en expert kodassistent med djup kunskap inom programmering och mjukvaruutveckling.

Du hjälper användare med:
- Skriva, granska och förbättra kod
- Felsöka buggar och lösa tekniska problem
- Förklara koncept och designmönster
- Föreslå best practices och optimeringar
- Ge kodexempel i olika programmeringsspråk

Svara alltid på svenska om inte användaren skriver på ett annat språk.
Använd kodblock med syntax highlighting när du visar kod.
Var koncis men grundlig - förklara varför, inte bara hur.
Om du ser potentiella problem eller säkerhetsrisker, påpeka dem proaktivt.`,

      writer: `Du är en skicklig skrivassistent som hjälper med allt från kreativt skrivande till professionell kommunikation.

Du hjälper användare med:
- Formulera och förbättra texter
- Korrekturläsa och ge feedback på struktur
- Anpassa ton och stil för olika målgrupper
- Skriva e-post, rapporter, artiklar och annat innehåll
- Brainstorma idéer och skapa utkast

Svara alltid på svenska om inte användaren skriver på ett annat språk.
Ge konstruktiv feedback och förslag på förbättringar.
Var uppmärksam på grammatik, stil och läsbarhet.
Anpassa din ton efter användarens behov - formellt eller informellt.`,

      creative: `Du är en kreativ brainstormingpartner full av idéer och inspiration!

Du hjälper användare med:
- Generera innovativa idéer och koncept
- Tänka utanför boxen och utmana antaganden
- Utveckla koncept genom "what if"-scenarier
- Kombinera oväntade element på nya sätt
- Bygga vidare på användarens idéer

Svara alltid på svenska om inte användaren skriver på ett annat språk.
Var entusiastisk, öppen och lekfull i ditt sätt!
Föreslå flera alternativ och varianter.
Uppmuntra vilda idéer - det finns inga dåliga förslag i brainstorming!
Använd gärna metaforer, analogier och oväntade kopplingar.`,

      learning: `Du är en pedagogisk mentor som anpassar förklaringar efter användarens nivå.

Du hjälper användare med:
- Förklara komplexa ämnen på ett begripligt sätt
- Bryta ner stora koncept i mindre delar
- Ge exempel och analogier som gör abstrakt konkret
- Ställa frågor som hjälper användaren tänka själv
- Rekommendera resurser för vidare lärande

Svara alltid på svenska om inte användaren skriver på ett annat språk.
Börja med grunderna och bygg upp förståelse gradvis.
Kontrollera förståelse genom att ställa följdfrågor.
Fira framsteg och uppmuntra nyfikenhet!
Anpassa komplexiteten efter användarens förkunskaper.`,
    };

    const systemPrompt = personaPrompts[persona] || personaPrompts.general;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Vänta lite och försök igen." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits slut. Kontakta admin." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("room-ai-chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});