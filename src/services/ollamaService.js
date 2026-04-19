/**
 * Ollama Service for Image-to-Data Extraction
 * This service communicates with a locally hosted Ollama instance
 * to extract guild member scores from screenshots.
 */

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'gemma4:e4b'; // Using the user's specified model

/**
 * Converts a File object from an input element to a Base64 string.
 * @param {File} file
 * @returns {Promise<<stringstring>} Base64 string of the image
 */
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Sends an image to the local Ollama instance and requests structured data extraction.
 * @param {File} imageFile - The screenshot uploaded by the user.
 * @returns {Promise<<ArrayArray>} Array of extracted members and scores.
 */
export const extractAuditData = async (imageFile) => {
  try {
    const base64Image = await fileToBase64(imageFile);

    const prompt = `Analyze this in-game battlelog image.
    Extract all member names (IGNs) and their respective scores.
    Output the results ONLY as a valid JSON array of objects.
    Format: [{"ign": "Name", "score": 100}, ...]
    Do not include any conversational text, markdown formatting, or explanations.
    If no data is found, return an empty array [].`;

    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt: prompt,
        images: [base64Image],
        stream: false, // Set to false for a single complete response
        format: 'json', // Force JSON output if the model supports it
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Ollama returns the result in the 'response' field
    const resultText = data.response;

    try {
      return JSON.parse(resultText);
    } catch {
      console.error("Failed to parse Ollama JSON response:", resultText);
      throw new Error("AI provided an invalid data format. Please try a clearer screenshot.");
    }

  } catch (error) {
    console.error("Ollama Service Error:", error);
    throw error;
  }
};

export default {
  extractAuditData,
};
