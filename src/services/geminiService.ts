import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export interface DeviceInsight {
  deviceId: string;
  classification: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  observation: string;
}

export const analyzeDevices = async (devices: any[]): Promise<DeviceInsight[]> => {
  if (devices.length === 0) return [];

  const deviceData = devices.map(d => ({
    id: d.id,
    type: d.type,
    model: d.model,
    distance: d.distance.toFixed(1),
    rssi: d.rssi,
    isTarget: d.isTarget,
    isHome: d.isHome
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: `Analyze the following BLE device telemetry and identify anomalies or points of interest. 
          Classification tags should be concise (e.g. "Personal Asset", "IoT Hub", "Unidentified Tracker").
          Risk levels: LOW (Home/Static), MEDIUM (Unknown Move), HIGH (Target Move), CRITICAL (Rapid Proximity).
          
          Data: ${JSON.stringify(deviceData)}` }]
        }
      ],
      config: {
        systemInstruction: "You are an advanced SIGINT (Signals Intelligence) analyzer. Your goal is to provide tactical insights into BLE device traffic. Return a JSON array of insights.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              deviceId: { type: Type.STRING },
              classification: { type: Type.STRING },
              riskLevel: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
              observation: { type: Type.STRING }
            },
            required: ["deviceId", "classification", "riskLevel", "observation"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    console.error("AI Analysis failed:", error);
    // Re-throw so the caller can detect 429/Resource Exhausted
    throw error;
  }
};
