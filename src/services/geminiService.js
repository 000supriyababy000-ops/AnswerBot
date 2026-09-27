const { GoogleGenAI } = require('@google/genai');

const GEMINI_MODEL = 'gemini-3.8-flash';

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_google_gemini_api_key_here') {
    throw new Error(
      'Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file.'
    );
  }

  return new GoogleGenAI({
    apiKey,
  });
};

/**
 * Wait helper
 */
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Generate content with automatic retry for temporary Gemini errors.
 */
const generateWithRetry = async (ai, request, maxRetries = 3) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(request);
    } catch (error) {
      lastError = error;

      const errorMessage = error?.message || '';

      const isTemporaryError =
        errorMessage.includes('503') ||
        errorMessage.includes('UNAVAILABLE') ||
        errorMessage.includes('high demand') ||
        errorMessage.includes('429') ||
        errorMessage.includes('RESOURCE_EXHAUSTED');

      if (!isTemporaryError || attempt === maxRetries) {
        throw error;
      }

      // 5 seconds, 10 seconds, 20 seconds
      const delay = 5000 * Math.pow(2, attempt);

      console.log(
        `Gemini temporarily unavailable. Retry ${attempt + 1}/${maxRetries} in ${delay / 1000} seconds...`
      );

      await sleep(delay);
    }
  }

  throw lastError;
};

/**
 * Generate an AI answer for a user's question
 */
const generateAnswer = async (question) => {
  try {
    const ai = getClient();

    const response = await generateWithRetry(ai, {
      model: GEMINI_MODEL,

      contents: `You are a helpful assistant.

Provide a clear, concise, and direct answer to the following question.

Do not include introductory phrases such as:
"Sure, here is the answer"
"Of course"
"Certainly"

Return only the answer.

Question:
${question}`,
    });

    if (!response || !response.text) {
      throw new Error('No response text received from Gemini API');
    }

    return response.text.trim();
  } catch (error) {
    console.error(
      'Error in geminiService.generateAnswer:',
      error
    );

    throw new Error(
      `AI Answer Generation failed: ${error.message}`
    );
  }
};

/**
 * Generate a single FAQ question and answer
 */
const generateFAQ = async (topic) => {
  try {
    const ai = getClient();

    const response = await generateWithRetry(ai, {
      model: GEMINI_MODEL,

      contents: `Generate a single frequently asked question (FAQ) and its comprehensive answer about the following topic:

${topic}`,

      config: {
        responseMimeType: 'application/json',

        responseSchema: {
          type: 'OBJECT',

          properties: {
            question: {
              type: 'STRING',
              description:
                'A clear and common question a user would ask about the topic.',
            },

            answer: {
              type: 'STRING',
              description:
                'A detailed, helpful, and accurate answer to the question.',
            },
          },

          required: ['question', 'answer'],
        },
      },
    });

    if (!response || !response.text) {
      throw new Error(
        'No response received from Gemini API'
      );
    }

    const faqPair = JSON.parse(response.text);

    return faqPair;
  } catch (error) {
    console.error(
      'Error in geminiService.generateFAQ:',
      error
    );

    throw new Error(
      `AI FAQ Generation failed: ${error.message}`
    );
  }
};

module.exports = {
  generateAnswer,
  generateFAQ,
};