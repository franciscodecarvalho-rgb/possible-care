import { supabase } from "@/integrations/supabase/client";
import { pdfToBase64Images } from "./pdfExtractor";

type ProgressCallback = (msg: string) => void;

export async function extractFromFiles(
  files: File[],
  promptText: string,
  onProgress?: ProgressCallback
): Promise<any> {
  onProgress?.("Lendo documentos...");

  const allImages: string[] = [];
  for (const file of files) {
    const imgs = await pdfToBase64Images(file);
    allImages.push(...imgs);
  }

  onProgress?.("Extraindo dados financeiros...");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const { data, error } = await supabase.functions.invoke("extract-pdf", {
      body: { images: allImages, promptText },
    });

    if (error) throw new Error(error.message || "Erro na extração");
    if (data?.error) throw new Error(data.error);

    onProgress?.("Processamento concluído.");
    return data.extracted;
  } finally {
    clearTimeout(timeout);
  }
}
