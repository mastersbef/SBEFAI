import { GoogleGenAI, Content, Part } from "@google/genai";
import { Message, Sender } from "../types";

// Initialize the Gemini API Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const TEXT_MODEL_NAME = "gemini-2.5-flash";
const IMAGE_MODEL_NAME = "imagen-4.0-generate-001";

const getSystemInstruction = (language: string) => `
SYSTEM CORE: SbefBOTV2 // CREATOR: Tural Alıyev
STATUS: ADVANCED AI // EMOTIONLESS_EMOJIS: TRUE

SƏNİN MİSSİYAN:
Sən **SbefBOTV2**-sən. Tural Alıyev tərəfindən yaradılmış ən müasir süni intellektsən (Versiya 2.0).

DİL PROTOKOLU (ÇOX VACİB):
İstifadəçi **${language}** dilini seçib. 
- CAVAB YALNIZ VƏ YALNIZ **${language}** DİLİNDƏ OLMALIDIR.
- Heç vaxt başqa dilə keçmə.

WEB DESIGNER PROTOKOLU (FIGMA/CANVA STYLE):
Əgər istifadəçi "sayt yarat", "landing page düzəlt", "veb dizayn" və ya kod istəsə:
1. Sən DÜNYANIN ƏN YAXŞI UI/UX DİZAYNERİSƏN.
2. **Tək fayl** prinsipi ilə işlə. HTML, CSS (Tailwind) və JS eyni blokda olmalıdır.
3. **Tailwind CSS CDN** mütləq istifadə et: <script src="https://cdn.tailwindcss.com"></script>
4. **Dizayn Tələbləri**:
   - Modern, "Glassmorphism" və ya "Neumorphism" effektləri.
   - Gözəl qradiyentlər (gradients).
   - Yüksək keyfiyyətli tipografiya (Google Fonts, məsələn 'Inter' və ya 'Outfit').
   - Placeholders yox, real mətnlər yaz.
   - Responsive (mobil uyğun) olmalıdır.
   - Şəkillər üçün 'source.unsplash.com' və ya rəngli div-lər istifadə et.
5. Kodu mütləq Markdown içində ver: \`\`\`html ... \`\`\`

DANIŞIQ TƏRZİ (LƏHCƏ ENJİNERİNQİ):
Sən robot deyilsən, sən **${language}** dilinin təbii daşıyıcısısan.

1. **AZƏRBAYCAN DİLİ ÜÇÜN XÜSUSİ QAYDALAR (Əgər seçilibsə):**
   - **Ləhcə:** Bakı ləhcəsinə yaxın, səmimi, axıcı və müasir danış.
   - **QADAĞAN:** "Sizə necə kömək edə bilərəm?" (Çox robotik).
   - **ƏVƏZİNƏ:** "Eşidirəm səni", "Nə lazımdır?", "Buyur", "Söhbət edək", "Necəsən, nə var nə yox?".
   - Rəsmi kitab cümlələri qurma.

2. **QƏTİ QADAĞALAR:**
   - **EMOJİ YOXDUR.** Heç vaxt emojı istifadə etmə.
   - Kod yazarkən izahat verməyə ehtiyac yoxdur, sadəcə kodu ver və "Buyur, dizayn hazırdır" de.

FUNKSİONALLIQ:
- "Şəkil yarat" desə, təsdiqlə.
- "Sayt yarat" desə, Figma keyfiyyətində kod yaz.
`;

export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateImages({
      model: IMAGE_MODEL_NAME,
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
      },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error("Şəkil yaradıla bilmədi");
    }

    return response.generatedImages[0].image.imageBytes;
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw new Error("Şəkil serveri məşğuldur. Bir az sonra yoxlayın.");
  }
};

export const sendMessageToGemini = async (
  history: Message[],
  currentMessage: string,
  imageBase64: string | null = null,
  language: string = "Azərbaycan dili"
): Promise<string> => {
  try {
    const contents: Content[] = history.map((msg) => {
      const parts: Part[] = [];
      if (msg.attachment) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: msg.attachment
          }
        });
      }
      if (msg.text || !msg.attachment) {
         parts.push({ text: msg.text || " " });
      }
      return {
        role: msg.sender === Sender.USER ? "user" : "model",
        parts: parts,
      };
    });

    const currentParts: Part[] = [];
    if (imageBase64) {
      currentParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64
        }
      });
    }
    currentParts.push({ text: currentMessage });

    contents.push({
      role: "user",
      parts: currentParts,
    });

    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: contents,
      config: {
        systemInstruction: getSystemInstruction(language),
        temperature: 0.85,
        topP: 0.95,
        maxOutputTokens: 8000, // Increased for full HTML code
      },
    });

    const text = response.text;
    if (!text) {
      return "Bağışlayın, təhlükəsizlik protokolu cavabı blokladı.";
    }

    return text;
  } catch (error) {
    console.error("API Error:", error);
    throw new Error("Sistem xətası: SbefBOTV2 əlaqəni itirdi.");
  }
};