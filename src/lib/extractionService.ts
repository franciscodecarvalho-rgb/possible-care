import { supabase } from "@/integrations/supabase/client";
import { pdfToBase64Images } from "./pdfExtractor";

type ProgressCallback = (msg: string) => void;

export async function extractFromFiles(
  files: File[],
  promptText: string,
  onProgress?: ProgressCallback
): Promise<any> {
  // Etapa 1: Conversão PDF → imagens
  onProgress?.("Convertendo PDFs em imagens...");
  let allImages: string[];
  try {
    allImages = [];
    for (const file of files) {
      const imgs = await pdfToBase64Images(file);
      allImages.push(...imgs);
    }
  } catch (err: any) {
    console.error("Erro ao converter PDF para imagens:", err);
    throw new Error(`Erro ao converter PDF: ${err?.message || String(err)}`);
  }

  // Etapa 2: Chamada à API de extração
  onProgress?.("Extraindo dados financeiros via IA...");
  let data: any;
  try {
    const result = await supabase.functions.invoke("extract-pdf", {
      body: { images: allImages, promptText },
    });

    if (result.error) {
      throw new Error(result.error.message || JSON.stringify(result.error));
    }
    data = result.data;
  } catch (err: any) {
    console.error("Erro na chamada à API de extração:", err);
    throw new Error(`Erro na API: ${err?.message || String(err)}`);
  }

  // Verificar erro retornado pela edge function
  if (data?.error) {
    console.error("Erro retornado pela edge function:", data.error);
    throw new Error(`Erro na API: ${data.error}`);
  }

  // Etapa 3: Validar dados extraídos
  try {
    const extracted = data?.extracted;
    if (!extracted) {
      throw new Error("Resposta da API não contém dados extraídos (campo 'extracted' ausente)");
    }
    if (extracted.raw_text) {
      console.warn("IA retornou texto bruto em vez de JSON estruturado:", extracted.raw_text);
      throw new Error(`IA não retornou JSON válido. Resposta: ${extracted.raw_text.substring(0, 200)}...`);
    }
    onProgress?.("Processamento concluído.");
    return extracted;
  } catch (err: any) {
    console.error("Erro ao interpretar dados extraídos:", err);
    throw new Error(`Erro ao interpretar dados extraídos: ${err?.message || String(err)}`);
  }
}
