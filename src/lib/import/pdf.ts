import { extractText, getDocumentProxy } from "unpdf";

// Serverless-friendly PDF text extraction (pdf.js under the hood).
export async function extractPdfText(buffer: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(buffer);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
