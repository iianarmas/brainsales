import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Converts a natural language phrase into a 1536-dimensional embedding vector
 * using OpenAI's text-embedding-3-small model.
 *
 * The returned array can be stored in a pgvector column and used for cosine
 * similarity search via the match_intents RPC function.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text.toLowerCase().trim(),
    });
    return response.data[0].embedding;
}
