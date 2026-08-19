"use client";

import { useState } from "react";
import { parsePortfolioCsv } from "@/lib/csv/parser";
import { usePortfolio } from "@/state/portfolio-context";

/**
 * Centraliza la lectura y parseo de un CSV de portafolio, y lo despacha al
 * contexto. El header y el dropzone comparten este hook para no duplicar
 * logica de importacion.
 */
export function useCsvImport() {
  const { dispatch } = usePortfolio();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importFile = async (file: File) => {
    setReading(true);
    setError(null);
    try {
      const raw = await file.text();
      const parsed = parsePortfolioCsv(raw);

      // Un CSV sin filas validas y con errores es un archivo invalido, no
      // un portafolio vacio: se conserva para mostrar el motivo del rechazo.
      if (parsed.lots.length === 0 && parsed.errors.length > 0) {
        setError("No valid rows found in the file.");
        dispatch({
          type: "import",
          payload: { lots: [], errors: parsed.errors, fileName: file.name },
        });
        return;
      }

      dispatch({
        type: "import",
        payload: {
          lots: parsed.lots,
          errors: parsed.errors,
          fileName: file.name,
        },
      });
    } catch {
      setError("Could not read the file. Try downloading the sample.");
    } finally {
      setReading(false);
    }
  };

  return { importFile, reading, error };
}
