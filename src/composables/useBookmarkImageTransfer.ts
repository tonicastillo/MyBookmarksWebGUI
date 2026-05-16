export const fetchImageAsDataUrl = async (
  url: string,
): Promise<{ dataUrl: string; mime: string } | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({ dataUrl: reader.result as string, mime: blob.type });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const dataUrlToFile = (
  dataUrl: string,
  mime: string,
  baseName: string = "pasted",
): File | null => {
  try {
    const [meta, b64] = dataUrl.split(",");
    if (!b64) return null;
    const actualMime = meta.match(/data:(.*?);base64/)?.[1] ?? mime;
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const ext = actualMime.split("/")[1]?.split("+")[0] ?? "bin";
    return new File([arr], `${baseName}.${ext}`, { type: actualMime });
  } catch {
    return null;
  }
};
