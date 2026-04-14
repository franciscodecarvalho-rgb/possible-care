import { useCallback, useState } from "react";
import { Upload, X, FileText, AlertCircle } from "lucide-react";

interface FileDropzoneProps {
  label: string;
  maxFiles: number;
  files: File[];
  onFilesChange: (files: File[]) => void;
  error?: string;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const FileDropzone = ({ label, maxFiles, files, onFilesChange, error }: FileDropzoneProps) => {
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const validateAndAdd = useCallback(
    (newFiles: FileList | File[]) => {
      setFileError(null);
      const arr = Array.from(newFiles);

      for (const f of arr) {
        if (f.type !== "application/pdf") {
          setFileError("Apenas arquivos .pdf são aceitos.");
          return;
        }
        if (f.size > MAX_SIZE) {
          setFileError(`"${f.name}" excede o limite de 10MB.`);
          return;
        }
      }

      const combined = [...files, ...arr].slice(0, maxFiles);
      onFilesChange(combined);
    },
    [files, maxFiles, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      validateAndAdd(e.dataTransfer.files);
    },
    [validateAndAdd]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) validateAndAdd(e.target.files);
      e.target.value = "";
    },
    [validateAndAdd]
  );

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const displayError = error || fileError;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : displayError
            ? "border-destructive/50 bg-destructive/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        <input
          type="file"
          accept=".pdf"
          multiple={maxFiles > 1}
          onChange={handleInputChange}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <Upload className={`mb-2 h-8 w-8 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
        <p className="text-sm font-medium text-foreground">
          Arraste e solte {maxFiles > 1 ? "os arquivos" : "o arquivo"} aqui
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          ou clique para selecionar • PDF • máx. 10MB
          {maxFiles > 1 && ` • até ${maxFiles} arquivos`}
        </p>
      </div>

      {displayError && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {displayError}
        </p>
      )}

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="truncate max-w-[200px]">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024 / 1024).toFixed(1)} MB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FileDropzone;
