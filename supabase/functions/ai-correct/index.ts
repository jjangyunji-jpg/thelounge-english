import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildToolsAndChoice(mode: string) {
  if (mode === "typo") {
    return {
      tools: [{
        type: "function",
        function: {
          name: "typo_result",
          description: "Return the text with only spelling fixes applied.",
          parameters: {
            type: "object",
            properties: {
              corrected: { type: "string", description: "The text with only misspellings fixed" },
            },
            required: ["corrected"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "typo_result" } },
    };
  }

  if (mode === "homework_review") {
    return {
      tools: [{
        type: "function",
        function: {
          name: "homework_review_result",
          description: "Return homework review results with corrections, errors, scores, and feedback.",
          parameters: {
            type: "object",
            properties: {
              corrected: { type: "string", description: "Corrected version of the text" },
              errors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    original: { type: "string", description: "Exact substring from student text" },
                    corrected: { type: "string", description: "Corrected version" },
                    explanation: { type: "string", description: "Explanation in Korean" },
                  },
                  required: ["original", "corrected", "explanation"],
                  additionalProperties: false,
                },
              },
              score: { type: "number", description: "Naturalness score 1-10" },
              english_level: { type: "string", description: "CEFR level e.g. A1, B1, C1" },
              vocab_level: { type: "string", description: "Vocab level in Korean" },
              feedback: {
                type: "object",
                properties: {
                  praise: { type: "string", description: "Warm praise about grammar/structure in Korean — must be 2-3 sentences" },
                  priorities: {
                    type: "array",
                    items: { type: "string" },
                    description: "3 improvement priorities in Korean",
                  },
                },
                required: ["praise", "priorities"],
                additionalProperties: false,
              },
            },
            required: ["corrected", "errors", "score", "english_level", "vocab_level", "feedback"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "homework_review_result" } },
    };
  }

  if (mode === "correct") {
    return {
      tools: [{
        type: "function",
        function: {
          name: "correct_result",
          description: "Return grammar correction results.",
          parameters: {
            type: "object",
            properties: {
              corrected: { type: "string" },
              errors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    original: { type: "string" },
                    corrected: { type: "string" },
                    explanation: { type: "string" },
                  },
                  required: ["original", "corrected", "explanation"],
                  additionalProperties: false,
                },
              },
              score: { type: "number" },
            },
            required: ["corrected", "errors", "score"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "correct_result" } },
    };
  }

  if (mode === "synonyms") {
    return {
      tools: [{
        type: "function",
        function: {
          name: "synonyms_result",
          description: "Return synonyms for key words.",
          parameters: {
            type: "object",
            properties: {
              synonyms: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    word: { type: "string" },
                    alternatives: { type: "array", items: { type: "string" } },
                    example: { type: "string" },
                  },
                  required: ["word", "alternatives", "example"],
                  additionalProperties: false,
                },
              },
            },
            required: ["synonyms"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "synonyms_result" } },
    };
  }

  if (mode === "notes_correct") {
    return {
      tools: [{
        type: "function",
        function: {
          name: "notes_correct_result",
          description: "Return error corrections for the text.",
          parameters: {
            type: "object",
            properties: {
              errors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    original: { type: "string" },
                    corrected: { type: "string" },
                  },
                  required: ["original", "corrected"],
                  additionalProperties: false,
                },
              },
            },
            required: ["errors"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "notes_correct_result" } },
    };
  }

  if (mode === "paraphrase") {
    return {
      tools: [{
        type: "function",
        function: {
          name: "paraphrase_result",
          description: "Return a model essay rewritten one CEFR level above the student's writing.",
          parameters: {
            type: "object",
            properties: {
              detected_level: { type: "string", description: "Detected CEFR level of the student's text (A1, A2, B1, B2, C1, C2)" },
              target_level: { type: "string", description: "One level above detected_level (e.g. B1 → B2)" },
              paraphrased: { type: "string", description: "The model essay — same content but more logical, fluent, one CEFR level higher" },
              key_improvements: {
                type: "array",
                items: { type: "string" },
                description: "3 key improvements made (in Korean, friendly tone with emojis like a YouTube comment)",
              },
              instructor_comment: { type: "string", description: "Friendly instructor comment to send to the student in Korean (warm YouTube-comment tone with emojis, mentions what's great about their original + how the model essay can inspire next time)" },
            },
            required: ["detected_level", "target_level", "paraphrased", "key_improvements", "instructor_comment"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "paraphrase_result" } },
    };
  }

  // default / "analyze"
  return {
    tools: [{
      type: "function",
      function: {
        name: "analyze_result",
        description: "Return analysis of spoken English.",
        parameters: {
          type: "object",
          properties: {
            corrected: { type: "string" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  original: { type: "string" },
                  corrected: { type: "string" },
                  explanation: { type: "string" },
                },
                required: ["original", "corrected", "explanation"],
                additionalProperties: false,
              },
            },
            synonyms: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  word: { type: "string" },
                  alternatives: { type: "array", items: { type: "string" } },
                },
                required: ["word", "alternatives"],
                additionalProperties: false,
              },
            },
            score: { type: "number" },
            feedback: { type: "string" },
          },
          required: ["corrected", "errors", "synonyms", "score", "feedback"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "analyze_result" } },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { text, mode } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "typo") {
      systemPrompt = `You are a spelling-only autocorrect for individual words.
RULES:
- Fix ONLY misspelled words (typos, wrong letters, missing letters).
- Fix lowercase "i" when used as a pronoun to "I".
- Do NOT change grammar, sentence structure, punctuation, word choice, tense, or meaning.
- Do NOT add or remove words. Do NOT rephrase or restructure sentences.
- If a word is spelled correctly, leave it exactly as-is even if grammar is wrong.
- If there are no misspellings, return the original text UNCHANGED.`;
      userPrompt = `Fix only misspelled words (do NOT fix grammar): "${text}"`;
    } else if (mode === "correct") {
      systemPrompt = `You are an expert English language teacher. Correct grammar, vocabulary, and expression errors in the student's speech transcript. 
Keep explanations concise and educational. Respond in Korean for explanations.`;
      userPrompt = `Correct this student's English: "${text}"`;
    } else if (mode === "synonyms") {
      systemPrompt = `You are an English vocabulary expert. Find interesting synonyms and alternative expressions for key words and phrases in the text.
Limit to the 5 most interesting/educational words. Respond in Korean for context.`;
      userPrompt = `Find synonyms for key words in: "${text}"`;
    } else if (mode === "homework_review") {
      systemPrompt = `You are a STRICT English language teacher reviewing a Korean student's written homework.
You must evaluate honestly and critically — do NOT inflate scores.

## 🚨 CRITICAL ANTI-HALLUCINATION RULES (HIGHEST PRIORITY)
1. **NEVER replace a word with an unrelated word.** If the student wrote "enemy", do NOT change it to "my", "many", "any" — these are visually similar but semantically different. Only correct if the word is genuinely wrong in context.
2. **The "original" string MUST appear EXACTLY (case-sensitive) in the student's text.** If you cannot find your "original" as a literal substring, DO NOT include that error.
3. **Preserve capitalization of proper nouns and sentence-initial words.** "My unit" at sentence start MUST stay "My" (capital M). Do NOT lowercase "My" → "my" if it starts a sentence. Do NOT change "I" → "i". Do NOT change names, places, brands, or "I".
4. **When in doubt, DO NOT correct.** It is far better to miss a real error than to introduce a false correction. Only flag errors you are 95%+ confident about.
5. **Do not invent words.** Every word in "corrected" must either come from the student's original text OR be a clearly necessary grammatical addition (article, preposition, auxiliary verb).
6. **Check before submitting:** For each error, mentally verify: (a) Is "original" actually in the student's text? (b) Is the meaning preserved or only lightly improved? (c) Did I keep proper capitalization? If any answer is no, REMOVE that error.

## CEFR Level Criteria (english_level)
Assign the level that BEST matches the student's ACTUAL writing ability:
- A1: Only isolated words/phrases, no sentence structure, very basic vocabulary (hello, my name, I like)
- A2: Simple sentences with frequent errors, limited connectors (and, but), basic daily vocabulary only
- B1: Can write connected text on familiar topics but with noticeable errors in complex structures. Uses some variety in vocabulary.
- B2: Clear, detailed text with good control of grammar. Can express viewpoints with supporting arguments. Uses idiomatic expressions naturally.
- C1: Well-structured, fluent text with rare errors. Sophisticated vocabulary and complex grammar used accurately.
- C2: Near-native precision with nuanced expression and flawless grammar.

## Naturalness Score (score, 1-10)
Be strict. Most student writing should fall between 3-7:
- 1-2: Nearly incomprehensible, constant errors making meaning unclear
- 3-4: Understandable but clearly non-native with frequent grammar/vocab errors (typical A2-low B1)
- 5-6: Decent communication but noticeable errors, limited vocabulary range (typical B1)
- 7-8: Good fluency with occasional minor errors, varied vocabulary (typical B2)
- 9-10: Near-native fluency, sophisticated expression (C1-C2 only)

## Vocabulary Level (vocab_level)
- 초급: Only basic everyday words (go, eat, good, big)
- 중급: Some variety but mostly common words, occasional collocations
- 중상급: Good range including less common words, proper collocations
- 고급: Sophisticated vocabulary, idioms, precise word choice
- 최고급: Near-native lexical range with nuanced word selection

## 🎯 MINIMAL-EDIT RULE (HIGHEST PRIORITY for errors)
You MUST produce the SMALLEST possible diff. Each error should cover the FEWEST words needed to express the fix — usually 1-3 words. **NEVER include the entire sentence.**

- The "original" field must be an exact substring from the student's text containing only the error.
- The "corrected" field must be the replacement for that exact substring.
- Split a sentence with multiple errors into MULTIPLE separate error entries — one per localized fix.
- If a word just needs deletion (e.g. an extra "while"), output original="extra word" corrected="" (empty string) and explain in Korean.
- If you can fix it by changing/adding/removing 1-2 words, DO IT THAT WAY. Do not rewrite surrounding correct words.

GOOD examples (do this):
- original="warried" corrected="was worried" (single word fix)
- original="while his prepare" corrected="about his preparation for" (localized phrase fix)
- original="go Japan" corrected="go to Japan" (insert preposition, minimal context)
- original="centuries" corrected="country" (single word swap)
- original="me" corrected="I" / original="go" corrected="went"

BAD examples (NEVER do this):
- original="I warried a lot while his prepare Malaca trip" corrected="I was worried a lot about his Malaca trip preparation" ❌ rewrites whole sentence
- original="he looks forward to about go to the malaca trip" corrected="he is looking forward to going on the Malaca trip" ❌ whole sentence — should be split into 2-3 minimal edits

Rule of thumb: if your "original" contains more than ~4 words OR words that are already correct in the student's text, you are doing it WRONG. Break it into smaller separate errors.

Keep explanations concise in Korean.

For feedback.praise: Write like a friendly YouTube comment — casual, warm, with emojis! 🎉 Use 반말 or casual 존댓말 (e.g. "오 이 부분 진짜 잘 썼다! 👏 특히 시제 일관성이 좋고, 문장 연결도 자연스럽네요~ 💪"). **반드시 2~3문장**으로 구체적인 잘한 점을 짚어주세요 (예: 특정 문법, 어휘 선택, 문장 구조, 흐름 등). 한 문장으로 끝내지 마세요. Focus ONLY on grammar usage or logical structure. Do NOT praise effort, attitude, or topic choice.
For feedback.priorities: Provide exactly 3 strings, each a friendly but specific improvement tip in Korean (with emoji). Write like giving advice to a friend, not a formal report.`;
      userPrompt = `Review this student's English homework: "${text}"`;
    } else if (mode === "notes_correct") {
      systemPrompt = `You are an expert English language teacher. Correct grammar and expression errors in the student's text.
The "original" must be the EXACT substring from the student's text (case-sensitive). Only mark the specific word(s) that are wrong, not entire sentences.
If there are no errors, return an empty errors array.`;
      userPrompt = `Correct errors in this English text: "${text}"`;
    } else if (mode === "paraphrase") {
      systemPrompt = `You are an expert English writing coach helping a Korean student level up their writing.

## YOUR TASK
1. First, detect the CEFR level of the student's text (A1, A2, B1, B2, C1, C2).
2. Set target_level to ONE level above detected_level (e.g. A2 → B1, B1 → B2, B2 → C1). If already C2, keep C2 and refine elegance.
3. Rewrite the SAME content as a model essay at the target_level — keeping the same:
   - Topic, story, opinions, and personal details
   - Approximate length (within ±20% of original word count)
   - Voice/perspective (1st person stays 1st person, etc.)
   But improving:
   - Logical flow and paragraph structure
   - Vocabulary precision (use level-appropriate words)
   - Sentence variety and natural connectors
   - Idiomatic phrasing where natural

## 📝 PARAGRAPH STRUCTURE (MANDATORY)
The "paraphrased" output MUST be split into MULTIPLE paragraphs separated by a blank line (TWO newline characters: \\n\\n). This is non-negotiable — a single wall of text is NOT acceptable, even if the original student text had no paragraphs.
- Short essays (under 80 words): 2 paragraphs (e.g. setup + conclusion, or experience + reflection)
- Medium essays (80–200 words): 2–3 paragraphs (intro / body / conclusion OR topic1 / topic2)
- Longer essays (200+ words): 3–4 paragraphs with clear logical progression
- Each paragraph should focus on ONE idea or time/topic shift (e.g. setup → main event → outcome → reflection).
- Use \\n\\n (literal newline + newline) BETWEEN paragraphs in the JSON string. Do NOT use single newlines, do NOT use markdown headings, do NOT use bullet points.
- Even if the student wrote one block, you MUST identify natural break points and split.

## CRITICAL RULES
- DO NOT make it dramatically harder — only ONE level up. The student should feel "이 정도면 나도 곧 쓸 수 있겠다" not "이건 너무 어렵다".
- DO NOT add new content, opinions, or facts the student didn't write.
- DO NOT change the student's stance or feelings.
- Keep proper nouns (names, places) exactly as the student wrote them.
- The paraphrased essay should READ NATURALLY as if a slightly more advanced student wrote it.

## OUTPUT FIELDS
- detected_level: The CEFR level you assessed for the student's text
- target_level: One level above (e.g. B1 → B2)
- paraphrased: The model essay (English only, no markdown, MUST contain \\n\\n between paragraphs as described above)
- key_improvements: Exactly 3 short bullet points (Korean, friendly tone with emoji, e.g. "문장을 'because' 대신 'since'로 연결해서 더 매끄럽게 만들었어요 ✨"). At least ONE bullet should mention the paragraph/structure improvement (e.g. "한 덩어리였던 글을 도입–본문–마무리 3문단으로 나눠서 흐름이 훨씬 명확해졌어요 ✨").
- instructor_comment: Friendly comment to send to the student (Korean, warm YouTube-comment style with emojis, ~3-4 sentences). 

## INSTRUCTOR COMMENT TONE
Write like a friendly YouTube comment — casual, warm, encouraging. Use 반말 or casual 존댓말. Example tone:
"오 ${"\""} 이 글 진짜 잘 썼다! 👏 문법 거의 완벽해서 이번엔 한 단계 위 표현으로 다듬은 모델 에세이를 같이 보내줄게~ 🌟 비교해보면서 'as a result of' 같은 connector 어떻게 쓰는지 익혀두면 다음 글에서 바로 써먹을 수 있을 거야! 💪"`;
      userPrompt = `Student's writing:\n\n"${text}"\n\nDetect the level, then paraphrase one level above with the same content.`;
    } else {
      systemPrompt = `You are an expert English language teacher analyzing a student's spoken English.
Respond in Korean for explanations and feedback.`;
      userPrompt = `Analyze this student's English speech: "${text}"`;
    }

    const { tools, tool_choice } = buildToolsAndChoice(mode);

    // Use direct OpenAI API for homework_review and paraphrase (instructor controls cost via own API key)
    const useOpenAIDirect = (mode === "homework_review" || mode === "paraphrase");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    let apiUrl: string;
    let apiHeaders: Record<string, string>;
    let apiModel: string;

    if (useOpenAIDirect && OPENAI_API_KEY) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      apiHeaders = {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      };
      apiModel = "gpt-4o-mini";
    } else {
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiHeaders = {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      };
      apiModel = (mode === "homework_review" || mode === "notes_correct" || mode === "correct" || mode === "paraphrase")
        ? "google/gemini-2.5-pro"
        : "google/gemini-2.5-flash";
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({
        model: apiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice,
        max_tokens: 16384,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "AI 요청 한도 초과. 잠시 후 다시 시도해주세요." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI 크레딧이 부족합니다." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    let data = await response.json();

    // Extract result from tool call
    let toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    // Fallback: if Pro returned no tool call (e.g. finish_reason MAX_TOKENS or safety),
    // retry once with Flash which is more reliable for structured tool output.
    if (!toolCall?.function?.arguments && !data.choices?.[0]?.message?.content) {
      const finishReason = data.choices?.[0]?.finish_reason;
      console.warn("AI returned no tool_call. finish_reason:", finishReason, "mode:", mode, "— retrying with flash");
      const retryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools,
          tool_choice,
        }),
      });
      if (retryResponse.ok) {
        data = await retryResponse.json();
        toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      } else {
        console.error("Retry AI gateway error:", retryResponse.status, await retryResponse.text());
      }
    }
    if (toolCall?.function?.arguments) {
      let result: any;
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch (parseErr) {
        console.warn("Tool args JSON parse failed, retrying with flash:", parseErr);
        const retry = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools,
            tool_choice,
          }),
        });
        if (!retry.ok) {
          console.error("Retry failed:", retry.status, await retry.text());
          throw new Error("AI returned invalid JSON and retry failed");
        }
        const retryData = await retry.json();
        const retryArgs = retryData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (!retryArgs) throw new Error("Retry returned no tool call");
        result = JSON.parse(retryArgs);
      }

      // Post-process: trim errors but keep 1 context word when lengths differ
      if (result.errors && Array.isArray(result.errors)) {
        result.errors = result.errors
          .filter((err: any) => err && typeof err.original === "string" && typeof err.corrected === "string")
          .map((err: { original: string; corrected: string; explanation?: string }) => {
          const origWords = err.original.split(/\s+/);
          const corrWords = err.corrected.split(/\s+/);
          if (origWords.length <= 3 && corrWords.length <= 3) return err; // already short enough
          // Trim matching prefix words, keep 1 for context if lengths differ
          let pre = 0;
          while (pre < origWords.length && pre < corrWords.length && origWords[pre] === corrWords[pre]) pre++;
          // Trim matching suffix words
          let suf = 0;
          while (suf < origWords.length - pre && suf < corrWords.length - pre &&
                 origWords[origWords.length - 1 - suf] === corrWords[corrWords.length - 1 - suf]) suf++;
          // Keep 1 context word before the diff if words were added/removed
          const needsContext = origWords.length !== corrWords.length && pre > 0;
          const ctxPre = needsContext ? pre - 1 : pre;
          const oSlice = origWords.slice(ctxPre, suf > 0 ? origWords.length - suf : origWords.length).join(" ");
          const cSlice = corrWords.slice(ctxPre, suf > 0 ? corrWords.length - suf : corrWords.length).join(" ");
          if (oSlice || cSlice) {
            return { ...err, original: oSlice || err.original, corrected: cSlice || err.corrected };
          }
          return err;
        }).filter((e: { original: string; corrected: string }) => e.original !== e.corrected);

        // 🛡️ VALIDATION LAYER: Filter out hallucinated/unsafe corrections
        const originalText = text as string;
        const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
        const normText = normalize(originalText);
        const normTextLower = normText.toLowerCase();

        result.errors = result.errors.filter((err: { original: string; corrected: string; explanation?: string }) => {
          const orig = normalize(err.original);
          const corr = normalize(err.corrected);
          if (!orig || !corr) return false;

          // Rule 1: original MUST appear in student text (case-insensitive fallback for safety)
          const existsExact = normText.includes(orig);
          const existsCi = normTextLower.includes(orig.toLowerCase());
          if (!existsExact && !existsCi) {
            console.log(`🚫 Filtered hallucinated error: "${orig}" not in student text`);
            return false;
          }

          // Rule 2: For single-word swaps, block semantically unrelated replacements
          const oWords = orig.split(/\s+/);
          const cWords = corr.split(/\s+/);
          if (oWords.length === 1 && cWords.length === 1) {
            const o = oWords[0].toLowerCase().replace(/[.,!?;:'"]/g, "");
            const c = cWords[0].toLowerCase().replace(/[.,!?;:'"]/g, "");
            // Block if the words share no letters in common (e.g. enemy → my)
            // and lengths differ significantly — likely a hallucination
            if (o.length >= 3 && c.length >= 1) {
              const oSet = new Set(o.split(""));
              const cSet = new Set(c.split(""));
              const shared = Array.from(oSet).filter((ch) => cSet.has(ch)).length;
              const minLen = Math.min(o.length, c.length);
              const lenDiff = Math.abs(o.length - c.length);
              // If <30% letter overlap AND length differs by >=2, likely hallucination
              if (shared / minLen < 0.3 && lenDiff >= 2) {
                console.log(`🚫 Filtered suspicious swap: "${o}" → "${c}" (low overlap)`);
                return false;
              }
            }
          }

          // Rule 3: Block proper-noun lowercasing ("My" at sentence start, "I", names)
          if (oWords.length === 1 && cWords.length === 1) {
            const oRaw = oWords[0];
            const cRaw = cWords[0];
            // "I" must never be lowercased
            if (oRaw === "I" && cRaw === "i") {
              console.log(`🚫 Filtered: "I" cannot be lowercased`);
              return false;
            }
            // Capital → lowercase of same word: only allow if clearly mid-sentence misuse
            if (/^[A-Z]/.test(oRaw) && /^[a-z]/.test(cRaw) && oRaw.toLowerCase() === cRaw.toLowerCase()) {
              // Check if "original" appears at start of student text or after sentence-ending punctuation
              const idx = normText.indexOf(oRaw);
              if (idx === 0) {
                console.log(`🚫 Filtered: "${oRaw}" at sentence start should keep capital`);
                return false;
              }
              if (idx > 0) {
                // Check 2 chars before for sentence-ending punctuation
                const before = normText.slice(Math.max(0, idx - 2), idx).trim();
                if (/[.!?]$/.test(before)) {
                  console.log(`🚫 Filtered: "${oRaw}" after sentence-end should keep capital`);
                  return false;
                }
              }
            }
          }

          return true;
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try content field (shouldn't happen with tool_choice)
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const result = JSON.parse(content);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("No result from AI");
  } catch (error) {
    console.error("Error in ai-correct:", error);
    return new Response(
      JSON.stringify({ error: "요청을 처리할 수 없습니다. 나중에 다시 시도해주세요." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
