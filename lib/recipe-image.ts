type RecipeImageSource = {
  title: string;
  summary: string;
  ingredients: Array<{ quantidade: string; unidade: string; nome: string }>;
};

const DEFAULT_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-lite-image";
const RECIPE_IMAGE_TIMEOUT_MS = 6_000;

function normalizeModelNameForApi(model: string): string {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function getImageMimeType(imageData: unknown): string | undefined {
  if (!imageData || typeof imageData !== "object") return undefined;
  if ("mimeType" in imageData && typeof imageData.mimeType === "string") return imageData.mimeType;
  if ("mime_type" in imageData && typeof imageData.mime_type === "string") return imageData.mime_type;
  return undefined;
}

function recipeImagePrompt(recipe: RecipeImageSource): string {
  const ingredients = recipe.ingredients
    .slice(0, 12)
    .map((ingredient) => `${ingredient.quantidade} ${ingredient.unidade} ${ingredient.nome}`.trim())
    .join(", ");

  return [
    "Generate one appealing, realistic food photograph of the finished recipe below.",
    "Show the complete plated dish ready to eat, with natural lighting and a clean home kitchen setting.",
    "The image must contain no text, labels, logos, people, or extra dishes.",
    `Recipe: ${recipe.title}`,
    `Description: ${recipe.summary}`,
    `Ingredients: ${ingredients}`,
  ].join("\n");
}

export async function callGeminiImage(recipe: RecipeImageSource): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const modelPath = normalizeModelNameForApi(DEFAULT_IMAGE_MODEL);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECIPE_IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: recipeImagePrompt(recipe) }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) return null;

    const payload = await response.json();
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return null;

    const imagePart = parts.find((part: { inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }) => {
      const imageData = part.inlineData ?? part.inline_data;
      const mimeType = getImageMimeType(imageData);
      return Boolean(imageData?.data && typeof mimeType === "string" && mimeType.startsWith("image/"));
    });

    const imageData = imagePart?.inlineData ?? imagePart?.inline_data;
    const mimeType = getImageMimeType(imageData);
    const data = imageData?.data;
    if (!mimeType || !data || !/^[A-Za-z0-9+/=]+$/.test(data)) return null;

    return `data:${mimeType};base64,${data}`;
  } finally {
    clearTimeout(timeout);
  }
}
